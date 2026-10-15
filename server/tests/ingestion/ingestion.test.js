import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { parseLlmJson, validateExtractedPost } from "../../services/ingestion/extraction-schema.js";
import { classifyContentChange } from "../../services/ingestion/notice-change.js";
import { isPathDisallowed, parseSourceList } from "../../services/ingestion/source-fetcher.js";
import { assertRobotsAllows } from "../../services/ingestion/source-fetcher.js";
import {
  getEnabledSources,
  isSourceEnabled,
  sources,
} from "../../services/ingestion/sources.config.js";
import { processDryRunFixtures } from "../../services/ingestion/dry-run.service.js";
import { extractScannedPdfText } from "../../services/ingestion/vision-ocr.service.js";
import { extractPdfDocument } from "../../services/ingestion/pdf-text.js";
import { vacancyImportSchema } from "../../utils/vacancy-schema.js";
import { expectedExtraction } from "./fixtures/expected-extractions.js";

const fixtureDirectory = fileURLToPath(new URL("./fixtures/", import.meta.url));
const confidenceThreshold = 0.75;

for (let index = 0; index < 5; index += 1) {
  test(`fake sample notice ${index + 1} matches its expected extraction`, async () => {
    const text = await readFile(`${fixtureDirectory}\\notice-${index + 1}.txt`, "utf8");
    const expected = expectedExtraction(index, text);
    const parsed = parseLlmJson(JSON.stringify(expected));

    assert.deepEqual(parsed, expected);
    assert.deepEqual(validateExtractedPost(parsed.posts[0], text, confidenceThreshold).reasons, []);
  });
}

test("invalid LLM JSON is rejected", () => {
  assert.throws(() => parseLlmJson('{"posts": ['), /invalid JSON/i);
});

test("invalid calendar dates and insecure application links are rejected by the schema", async () => {
  const text = await readFile(`${fixtureDirectory}\\notice-1.txt`, "utf8");
  const post = expectedExtraction(0, text).posts[0];
  post.publication_date.value = "2026-02-30";
  assert.throws(
    () => parseLlmJson(JSON.stringify({ posts: [post] })),
    /valid YYYY-MM-DD calendar date/i,
  );

  const validPost = expectedExtraction(0, text).posts[0];
  validPost.application_url.value = "http://jobs.gov.in/apply";
  validPost.application_url.source_quote = "Apply at http://jobs.gov.in/apply.";
  assert.throws(
    () => parseLlmJson(JSON.stringify({ posts: [validPost] })),
    /Application URL must use HTTPS/i,
  );
});

test("one notice can contain multiple independently validated posts", async () => {
  const firstText = await readFile(`${fixtureDirectory}\\notice-1.txt`, "utf8");
  const secondText = await readFile(`${fixtureDirectory}\\notice-2.txt`, "utf8");
  const posts = [
    expectedExtraction(0, firstText).posts[0],
    expectedExtraction(1, secondText).posts[0],
  ];
  assert.equal(parseLlmJson(JSON.stringify({ posts })).posts.length, 2);
});

test("deadline earlier than application start is flagged for review", async () => {
  const text = await readFile(`${fixtureDirectory}\\notice-1.txt`, "utf8");
  const post = expectedExtraction(0, text).posts[0];
  post.application_deadline.value = "2026-10-09";
  const assessment = validateExtractedPost(post, text, confidenceThreshold);
  assert.equal(assessment.status, "needs_review");
  assert.ok(
    assessment.reasons.includes("Application deadline is before the application start date"),
  );
});

test("publication after application start is flagged as a conflicting date", async () => {
  const text = await readFile(`${fixtureDirectory}\\notice-1.txt`, "utf8");
  const post = expectedExtraction(0, text).posts[0];
  post.publication_date.value = "2026-10-12";
  post.publication_date.source_quote =
    "The Public Works Department published the Junior Engineer notice on 1 October 2026.";
  const assessment = validateExtractedPost(post, text, confidenceThreshold);
  assert.ok(
    assessment.reasons.includes("Application start date is before the notice publication date"),
  );
});

test("age requirements without an official cutoff date are flagged for review", async () => {
  const text = await readFile(`${fixtureDirectory}\\notice-1.txt`, "utf8");
  const post = expectedExtraction(0, text).posts[0];
  post.age_cutoff_date = {
    value: null,
    source_quote: null,
    page_or_section: null,
    confidence: 0.98,
  };
  const assessment = validateExtractedPost(post, text, confidenceThreshold);
  assert.ok(
    assessment.reasons.includes("Age rules are present but the age cutoff date is missing"),
  );
});

test("unsupported page or section evidence is flagged for review", async () => {
  const text = await readFile(`${fixtureDirectory}\\notice-1.txt`, "utf8");
  const post = expectedExtraction(0, text).posts[0];
  post.post_title.page_or_section = "Section 99 - Unsupported";
  const assessment = validateExtractedPost(post, text, confidenceThreshold);
  assert.ok(assessment.reasons.some((reason) => reason.includes("post_title location")));
});

test("same content hash is detected as a duplicate and changed hash as a correction", () => {
  assert.equal(classifyContentChange(null, "abc"), "new");
  assert.equal(classifyContentChange("abc", "abc"), "unchanged");
  assert.equal(classifyContentChange("abc", "def"), "changed");
});

test("robots disallow is respected, with more-specific allow taking precedence", () => {
  const robots = ["User-agent: *", "Disallow: /notices/", "Allow: /notices/current/"].join("\n");
  assert.equal(isPathDisallowed(robots, "/notices/old.pdf"), true);
  assert.equal(isPathDisallowed(robots, "/notices/current/1.pdf"), false);
});

test("missing robots.txt fails closed instead of enabling an unreviewed source", async () => {
  const source = sources.find(({ id }) => id === "employment-news");
  assert.ok(source);
  await assert.rejects(
    assertRobotsAllows(source, source.url, async () => ({ status: 404, text: "" })),
    /robots\.txt is unavailable; automated access permission is unverified/,
  );
});

test("SSC and Employment News remain disabled until access permission is confirmed", () => {
  assert.deepEqual(
    sources.map(({ id }) => id),
    ["ssc", "employment-news"],
  );
  assert.deepEqual(getEnabledSources(), []);
  assert.equal(
    isSourceEnabled({
      ...sources.find(({ id }) => id === "ssc"),
      enabled: true,
      access_permission: "confirmed",
      terms_reviewed: true,
    }),
    false,
  );
});

test("Employment News source discovers only official web-advertisement PDFs", () => {
  const source = sources.find(({ id }) => id === "employment-news");
  assert.ok(source);
  const html = `
    <a href="/writereaddata/header.pdf">Header document</a>
    <table id="ContentPlaceHolder1_RepEditorial">
      <tr><td><a href="../../writereaddata/notice.pdf">Recruitment Notice</a></td></tr>
      <tr><td><a href="../../writereaddata/notice.pdf">Duplicate listing</a></td></tr>
      <tr><td><a href="https://example.com/external.pdf">External Notice</a></td></tr>
    </table>`;

  const items = parseSourceList(source, html);
  assert.equal(items.length, 1);
  assert.deepEqual(
    { title: items[0].title, url: items[0].url, pdf_url: items[0].pdf_url },
    {
      title: "Recruitment Notice",
      url: "https://employmentnews.gov.in/writereaddata/notice.pdf",
      pdf_url: "https://employmentnews.gov.in/writereaddata/notice.pdf",
    },
  );
  assert.match(items[0].content_hash, /^[a-f0-9]{64}$/);
});

test("Google Vision OCR batches scanned PDF pages and joins extracted text", async () => {
  const requests = [];
  const result = await extractScannedPdfText(Buffer.from("%PDF-test"), 6, {
    apiKey: "test-key",
    fetcher: async (_url, options) => {
      requests.push(JSON.parse(options.body));
      const pages = requests.at(-1).requests[0].pages;
      return {
        ok: true,
        json: async () => ({
          responses: [
            {
              responses: pages.map((page) => ({
                fullTextAnnotation: { text: `Extracted page ${page} with more than enough text.` },
              })),
            },
          ],
        }),
      };
    },
  });

  assert.equal(requests.length, 2);
  assert.deepEqual(
    requests.map((request) => request.requests[0].pages),
    [[1, 2, 3, 4, 5], [6]],
  );
  assert.equal(requests[0].requests[0].inputConfig.mimeType, "application/pdf");
  assert.equal(result.reason, null);
  assert.match(result.text, /Extracted page 6/);
});

test("Google Vision OCR falls back explicitly when unconfigured or over the page limit", async () => {
  const buffer = Buffer.from("%PDF-test");
  assert.equal(
    (await extractScannedPdfText(buffer, 1, { apiKey: "" })).reason,
    "ocr_not_configured",
  );
  assert.equal(
    (await extractScannedPdfText(buffer, 11, { apiKey: "test-key" })).reason,
    "ocr_page_limit",
  );
  await assert.rejects(
    extractScannedPdfText(buffer, 1, {
      apiKey: "test-key",
      fetcher: async () => ({ ok: false, status: 403 }),
    }),
    /HTTP 403/,
  );
});

test("scanned PDF extraction preserves the document for manual review", async () => {
  const document = await extractPdfDocument(
    Buffer.from("%PDF-scanned"),
    "https://employmentnews.gov.in/notice.pdf",
    "a".repeat(64),
    async () => ({ text: "", reason: "needs_manual_entry" }),
  );
  assert.equal(document.reason, "needs_manual_entry");
  assert.equal(document.text, "");
  assert.equal(document.pdfUrl, "https://employmentnews.gov.in/notice.pdf");
});

test("admin vacancy import validates a bounded batch of strict vacancy records", () => {
  const vacancy = {
    title: "Example recruitment notice",
    recruiting_organization: "Example department",
    official_source_url: "https://official.gov.in/recruitment/notice",
    pdf_url: null,
    application_start_date: "2026-10-14",
    deadline: "2026-11-14",
    age_cutoff_date: "2026-01-01",
    rule_json: {
      qualification_level: "secondary",
      allowed_disciplines: [],
      min_age: 18,
      max_age: 40,
      age_relaxations: { sc: 0, st: 0, obc: 0, ews: 0, pwd: 0, ex_serviceman: 0 },
      domicile_states: [],
      min_experience_years: 0,
    },
    verification_checklist: { source_checked: false, dates_checked: false, rules_checked: false },
  };

  assert.equal(vacancyImportSchema.safeParse({ vacancies: [vacancy] }).success, true);
  assert.equal(
    vacancyImportSchema.safeParse({ vacancies: Array(21).fill(vacancy) }).success,
    false,
  );
  assert.equal(
    vacancyImportSchema.safeParse({
      vacancies: [{ ...vacancy, official_source_url: "http://bad" }],
    }).success,
    false,
  );
});

test("dry-run processes all sample notices without enabling network sources", async () => {
  const result = await processDryRunFixtures();
  assert.equal(result.dry_run, true);
  assert.equal(result.run_summary.sample_notices_processed, 5);
  assert.deepEqual(
    result.run_summary.skipped_sources.map(({ source_id }) => source_id),
    ["ssc", "employment-news"],
  );
  assert.deepEqual(result.sources_checked, []);
  assert.deepEqual(result.failures, []);
  assert.ok(
    result.run_summary.fixture_results.every((fixture) => fixture.status === "ready_for_review"),
  );
});
