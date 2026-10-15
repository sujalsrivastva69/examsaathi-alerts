import { supabaseAdmin } from "../../config/supabase.js";
import { env } from "../../config/env.js";
import { vacancyFieldsSchema } from "../../utils/vacancy-schema.js";
import { extractNoticePosts } from "./llm-client.js";
import {
  contentHash,
  fetchSourceResource,
  parseSourceList,
  assertRobotsAllows,
} from "./source-fetcher.js";
import { extractPdfDocument } from "./pdf-text.js";
import { getDisabledSources, getEnabledSources } from "./sources.config.js";
import { classifyContentChange } from "./notice-change.js";
import { validateExtractedPost } from "./extraction-schema.js";
import { processDryRunFixtures } from "./dry-run.service.js";
import { reevaluateMatchesForVacancy } from "../matching/match-persistence.service.js";

const confidenceThreshold = 0.75;
const adminVacancyFields = vacancyFieldsSchema;
let activeRun = null;

function logRun(event, details) {
  console.info(JSON.stringify({ event, at: new Date().toISOString(), ...details }));
}

async function extractOfficialPdf(buffer, pdfUrl) {
  return extractPdfDocument(buffer, pdfUrl, contentHash(buffer));
}

async function extractItemDocument(source, item) {
  const pdfUrl = item.pdf_url ?? item.url;
  const response = await fetchSourceResource(source, pdfUrl);
  const isPdf =
    response.contentType.toLowerCase().includes("pdf") ||
    response.buffer.subarray(0, 5).toString("ascii") === "%PDF-";
  if (isPdf) return extractOfficialPdf(response.buffer, pdfUrl);

  const $ = (await import("cheerio")).load(response.text);
  const text = $("body").text().replace(/\s+/g, " ").trim();
  const discoveredPdf = $("a[href$='.pdf'], a[href*='.pdf?']").first().attr("href");
  if (discoveredPdf) {
    const pdfUrl = new URL(discoveredPdf, item.url).href;
    const pdfResponse = await fetchSourceResource(source, pdfUrl);
    return extractOfficialPdf(pdfResponse.buffer, pdfUrl);
  }
  return {
    text,
    pdfUrl: null,
    reason: text.length >= 80 ? null : "needs_manual_entry",
    hash: contentHash(response.buffer),
  };
}

function makeRuleJson(post) {
  const relaxation = post.age_relaxations.value;
  const relaxationKeys = ["sc", "st", "obc", "ews", "pwd", "ex_serviceman"];
  const requiredValues = [
    post.education_level.value,
    post.allowed_disciplines.value,
    post.min_age.value,
    post.max_age.value,
    post.experience.value,
    relaxation,
    post.domicile_states.value,
  ];
  if (
    requiredValues.some((value) => value === null) ||
    relaxationKeys.some((key) => relaxation[key] === null)
  ) {
    return null;
  }

  const candidate = {
    qualification_level: post.education_level.value,
    allowed_disciplines: post.allowed_disciplines.value,
    min_age: post.min_age.value,
    max_age: post.max_age.value,
    age_relaxations: relaxation,
    domicile_states: post.domicile_states.value,
    min_experience_years: post.experience.value,
  };
  return candidate;
}

function toVacancyPayload(post, source, item, document, assessment) {
  const title = post?.post_title?.value ?? null;
  const organization = post?.recruiting_body?.value ?? post?.department?.value ?? null;
  let ruleJson = post ? makeRuleJson(post) : null;
  const candidate = {
    title: title || "Needs manual entry",
    recruiting_organization: organization || "Needs manual entry",
    official_source_url: item.url,
    pdf_url: document.pdfUrl,
    application_start_date: post?.application_start_date?.value ?? null,
    deadline: post?.application_deadline?.value ?? null,
    age_cutoff_date: post?.age_cutoff_date?.value ?? null,
    rule_json: ruleJson,
    verification_checklist: {
      source_checked: false,
      dates_checked: false,
      rules_checked: false,
    },
  };
  const validated = adminVacancyFields.safeParse(candidate);
  if (!validated.success) {
    assessment.reasons.push("Some extracted fields need editing to match the admin vacancy form");
    ruleJson = null;
  }
  const requiredFields = [
    "post_title",
    "recruiting_body",
    "application_start_date",
    "application_deadline",
  ];
  for (const field of requiredFields) {
    if (!post || post[field]?.value === null) assessment.reasons.push(`${field} is missing`);
  }
  if (!ruleJson) assessment.reasons.push("Structured eligibility rules need manual completion");
  if (document.reason)
    assessment.reasons.push(`Notice text needs manual entry (${document.reason})`);

  const quotes = post
    ? {
        quotes: Object.fromEntries(
          Object.entries(post).map(([key, entry]) => [key, entry.source_quote]),
        ),
        locations: Object.fromEntries(
          Object.entries(post).map(([key, entry]) => [key, entry.page_or_section]),
        ),
        confidence: Object.fromEntries(
          Object.entries(post).map(([key, entry]) => [key, entry.confidence]),
        ),
        overall: assessment.confidence,
      }
    : { quotes: {}, confidence: {}, overall: 0 };
  const reasons = [...new Set(assessment.reasons)];

  return {
    title,
    recruiting_organization: organization,
    pdf_url: document.pdfUrl,
    application_start_date: candidate.application_start_date,
    deadline: candidate.deadline,
    age_cutoff_date: candidate.age_cutoff_date,
    rule_json: ruleJson,
    source_quotes: quotes,
    extraction_payload: post ? { post } : {},
    extraction_confidence: assessment.confidence,
    ingestion_status: document.reason
      ? "needs_manual_entry"
      : reasons.length
        ? "needs_review"
        : "ready_for_review",
    review_reasons: reasons,
  };
}

async function getExistingNotice(sourceId, noticeUrl) {
  const { data, error } = await supabaseAdmin
    .from("source_notices")
    .select("id, content_hash, last_checked_at")
    .eq("source_id", sourceId)
    .eq("notice_url", noticeUrl)
    .maybeSingle();
  if (error) throw error;
  return data;
}

async function saveNotice(source, item, hash, vacancyPayloads, retryConflict = true) {
  const { data, error } = await supabaseAdmin.rpc("ingest_source_notice", {
    p_source_id: source.id,
    p_notice_url: item.url,
    p_content_hash: hash,
    p_vacancies: vacancyPayloads,
  });
  if (error?.code === "23505" && retryConflict) {
    const existing = await getExistingNotice(source.id, item.url);
    if (existing?.content_hash === hash) {
      const { data: links, error: linksError } = await supabaseAdmin
        .from("source_notice_vacancies")
        .select("vacancy_id")
        .eq("source_notice_id", existing.id);
      if (linksError) throw linksError;
      return { outcome: "unchanged", vacancy_ids: links.map(({ vacancy_id }) => vacancy_id) };
    }
    if (existing) return saveNotice(source, item, hash, vacancyPayloads, false);
  }
  if (error) throw error;
  return data;
}

async function processNotice(source, item) {
  const document = await extractItemDocument(source, item);
  const existing = await getExistingNotice(source.id, item.url);
  const classification = classifyContentChange(existing?.content_hash, document.hash);
  if (classification === "unchanged") {
    const { error } = await supabaseAdmin
      .from("source_notices")
      .update({ last_checked_at: new Date().toISOString() })
      .eq("id", existing.id);
    if (error) throw error;
    return { outcome: "unchanged", notices: 0 };
  }

  let posts = [];
  let extractionError = null;
  if (document.text && !document.reason) {
    try {
      posts = (await extractNoticePosts(document.text)).posts;
    } catch (error) {
      extractionError = error instanceof Error ? error.message : "LLM extraction failed";
      logRun("ingestion_extraction_failed", {
        source_id: source.id,
        notice_url: item.url,
        message: extractionError,
      });
    }
  }

  if (posts.length === 0) {
    posts = [null];
  }

  const payloads = posts.map((post) => {
    const assessment = post
      ? validateExtractedPost(post, document.text, confidenceThreshold)
      : {
          confidence: 0,
          reasons: extractionError ? [extractionError] : ["No extractable notice text"],
          status: "needs_review",
        };
    return toVacancyPayload(post, source, item, document, assessment);
  });
  const saved = await saveNotice(source, item, document.hash, payloads);
  for (const vacancyId of saved.vacancy_ids ?? []) {
    await reevaluateMatchesForVacancy(vacancyId);
  }
  const count = saved.outcome === "new" ? payloads.length : 0;
  return { outcome: saved.outcome, notices: count, vacancy_ids: saved.vacancy_ids ?? [] };
}

async function sourceHealth(sourceId) {
  const { data, error } = await supabaseAdmin
    .from("ingestion_source_health")
    .select("consecutive_failures, last_checked_at, alert_sent_at")
    .eq("source_id", sourceId)
    .maybeSingle();
  if (error) throw error;
  return data ?? { consecutive_failures: 0, last_checked_at: null, alert_sent_at: null };
}

async function markSourceSuccess(sourceId) {
  const now = new Date().toISOString();
  const { error } = await supabaseAdmin.from("ingestion_source_health").upsert({
    source_id: sourceId,
    consecutive_failures: 0,
    last_checked_at: now,
    last_success_at: now,
    last_error: null,
    alert_sent_at: null,
    updated_at: now,
  });
  if (error) throw error;
}

async function notifyAdminSourceFailure(source, message) {
  if (!env.ADMIN_ALERT_EMAIL || !env.RESEND_FROM_EMAIL) {
    console.error(
      `Ingestion source ${source.id} failed three times; admin alert recipient or sender is not configured`,
    );
    return false;
  }
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: `ExamSaathi Alerts <${env.RESEND_FROM_EMAIL}>`,
      to: [env.ADMIN_ALERT_EMAIL],
      subject: `ExamSaathi ingestion source failed: ${source.name}`,
      text: `The ${source.name} ingestion source has failed three consecutive runs.\n\nLast error: ${message}\n\nNo access restrictions were bypassed. Check the official source manually before re-enabling ingestion.`,
    }),
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) throw new Error(`Resend returned HTTP ${response.status}`);
  return true;
}

async function markSourceFailure(source, message) {
  const current = await sourceHealth(source.id);
  const failures = current.consecutive_failures + 1;
  const alertSent = Boolean(current.alert_sent_at);
  const now = new Date().toISOString();
  const { error } = await supabaseAdmin.from("ingestion_source_health").upsert({
    source_id: source.id,
    consecutive_failures: failures,
    last_checked_at: now,
    last_error: message.slice(0, 1000),
    alert_sent_at: current.alert_sent_at,
    updated_at: now,
  });
  if (error) throw error;

  if (failures >= 3 && !alertSent) {
    try {
      if (await notifyAdminSourceFailure(source, message)) {
        const { error: alertError } = await supabaseAdmin
          .from("ingestion_source_health")
          .update({ alert_sent_at: now, updated_at: now })
          .eq("source_id", source.id);
        if (alertError) throw alertError;
      }
    } catch (error) {
      console.error(`Could not send failure alert for source ${source.id}`, error);
    }
  }
}

async function persistRun(run) {
  const { error } = await supabaseAdmin.from("ingestion_runs").insert({
    started_at: run.started_at,
    completed_at: new Date().toISOString(),
    dry_run: false,
    sources_checked: run.sources_checked,
    new_notices_found: run.new_notices_found,
    failures: run.failures,
    run_summary: run.run_summary,
  });
  if (error) throw error;
}

async function runDryRun() {
  const startedAt = new Date().toISOString();
  const dryRun = await processDryRunFixtures();
  const result = {
    started_at: startedAt,
    ...dryRun,
  };
  logRun("ingestion_dry_run_complete", result);
  return result;
}

async function sourceDue(source) {
  const health = await sourceHealth(source.id);
  if (!health.last_checked_at) return true;
  return (
    Date.now() - Date.parse(health.last_checked_at) >= source.check_interval_hours * 60 * 60 * 1000
  );
}

async function performIngestionOnce({ force = false } = {}) {
  if (env.INGESTION_DRY_RUN) return runDryRun();

  const startedAt = new Date().toISOString();
  const run = {
    started_at: startedAt,
    sources_checked: [],
    new_notices_found: 0,
    failures: [],
    run_summary: {},
  };
  const skipped = getDisabledSources().map(({ id, url, disabled_reason, access_review_note }) => ({
    source_id: id,
    source_url: url,
    reason: disabled_reason ?? "Source is not enabled",
    access_review_note,
  }));

  for (const source of getEnabledSources()) {
    try {
      if (!force && !(await sourceDue(source))) continue;
      await assertRobotsAllows(source, source.url);
      const listing = await fetchSourceResource(source, source.url);
      const items = parseSourceList(source, listing.text);
      for (const item of items) {
        const result = await processNotice(source, item);
        run.new_notices_found += result.notices;
      }
      run.sources_checked.push({
        source_id: source.id,
        source_url: source.url,
        notice_items: items.length,
      });
      await markSourceSuccess(source.id);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown source failure";
      run.failures.push({ source_id: source.id, message });
      run.sources_checked.push({ source_id: source.id, source_url: source.url, failed: true });
      try {
        await markSourceFailure(source, message);
      } catch (healthError) {
        console.error(`Could not persist source failure state for ${source.id}`, healthError);
        run.failures.push({
          source_id: source.id,
          message: "Failed to persist source health state",
        });
      }
    }
  }

  run.run_summary = { skipped_sources: skipped };
  try {
    await persistRun(run);
  } catch (error) {
    console.error("Could not persist ingestion run", error);
    throw error;
  }
  logRun("ingestion_run_complete", run);
  return run;
}

export function runIngestionOnce(options = {}) {
  if (activeRun) return activeRun;
  activeRun = performIngestionOnce(options).finally(() => {
    activeRun = null;
  });
  return activeRun;
}

export async function getIngestionRuns(limit = 20) {
  const { data, error } = await supabaseAdmin
    .from("ingestion_runs")
    .select(
      "id, started_at, completed_at, dry_run, sources_checked, new_notices_found, failures, run_summary",
    )
    .order("started_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return { runs: data };
}
