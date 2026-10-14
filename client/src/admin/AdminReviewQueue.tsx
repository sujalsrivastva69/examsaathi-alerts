import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ApiError, apiRequest } from "../lib/api";

type ExtractedField = { value: unknown; source_quote: string | null; confidence: number };
type ReviewVacancy = {
  id: string;
  title: string | null;
  recruiting_organization: string | null;
  official_source_url: string;
  pdf_url: string | null;
  application_start_date: string | null;
  deadline: string | null;
  age_cutoff_date: string | null;
  rule_json: Record<string, unknown> | null;
  verification_checklist: {
    source_checked: boolean;
    dates_checked: boolean;
    rules_checked: boolean;
  };
  source_notice_url: string | null;
  source_quotes: {
    quotes?: Record<string, string | null>;
    confidence?: Record<string, number>;
    overall?: number;
  };
  extraction_payload: { post?: Record<string, ExtractedField> };
  extraction_confidence: number;
  ingestion_status: string;
  review_reasons: string[];
};

type IngestionRun = {
  started_at: string;
  dry_run: boolean;
  sources_checked: Array<{ source_id: string; notice_items?: number; failed?: boolean }>;
  new_notices_found: number;
  failures: Array<{ source_id: string; message: string }>;
  run_summary?: {
    skipped_sources?: Array<{ source_id: string; reason: string }>;
    sample_notices_processed?: number;
  };
};

const confidenceThreshold = 0.75;

function displayValue(value: unknown, t: (key: string) => string) {
  if (value === null || value === undefined || value === "") return t("adminNotEntered");
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

export function AdminReviewQueue() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [vacancies, setVacancies] = useState<ReviewVacancy[]>([]);
  const [checklists, setChecklists] = useState<
    Record<string, ReviewVacancy["verification_checklist"]>
  >({});
  const [runs, setRuns] = useState<IngestionRun[]>([]);
  const [lastRun, setLastRun] = useState<IngestionRun | null>(null);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const errorMessage = useCallback(
    (reason: unknown) =>
      reason instanceof ApiError
        ? reason.message
        : reason instanceof Error
          ? reason.message
          : t("adminUnexpected"),
    [t],
  );

  const loadQueue = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const result = await apiRequest<{ vacancies: ReviewVacancy[] }>(
        "/admin/vacancies/ingestion/review-queue",
      );
      setVacancies(result.vacancies);
      setChecklists((current) => {
        const next = { ...current };
        for (const vacancy of result.vacancies) {
          if (!next[vacancy.id]) next[vacancy.id] = vacancy.verification_checklist;
        }
        return next;
      });
    } catch (reason) {
      setError(errorMessage(reason));
    } finally {
      setLoading(false);
    }
  }, [errorMessage]);

  const loadRuns = useCallback(async () => {
    try {
      const result = await apiRequest<{ runs: IngestionRun[] }>("/admin/vacancies/ingestion/runs");
      setRuns(result.runs);
    } catch (reason) {
      setError(errorMessage(reason));
    }
  }, [errorMessage]);

  useEffect(() => {
    void loadQueue();
    void loadRuns();
  }, [loadQueue, loadRuns]);

  async function runNow() {
    setWorking(true);
    setError("");
    setNotice("");
    try {
      const result = await apiRequest<IngestionRun>("/admin/vacancies/ingestion/run", {
        method: "POST",
      });
      setLastRun(result);
      setNotice(result.dry_run ? t("adminDryRunComplete") : t("adminRunComplete"));
      await loadQueue();
      await loadRuns();
    } catch (reason) {
      setError(errorMessage(reason));
    } finally {
      setWorking(false);
    }
  }

  async function approveAndPublish(vacancy: ReviewVacancy) {
    if (!window.confirm(t("adminApproveConfirm"))) return;
    setWorking(true);
    setError("");
    setNotice("");
    try {
      const checklist = checklists[vacancy.id];
      await apiRequest(`/admin/vacancies/${vacancy.id}`, {
        method: "PATCH",
        body: { verification_checklist: checklist },
      });
      await apiRequest(`/admin/vacancies/${vacancy.id}/approve-publish`, {
        method: "POST",
      });
      setNotice(t("adminApproved"));
      await loadQueue();
    } catch (reason) {
      setError(errorMessage(reason));
    } finally {
      setWorking(false);
    }
  }

  async function reject(vacancy: ReviewVacancy) {
    if (!window.confirm(t("adminRejectConfirm"))) return;
    setWorking(true);
    setError("");
    setNotice("");
    try {
      await apiRequest(`/admin/vacancies/${vacancy.id}/reject`, { method: "POST" });
      setNotice(t("adminRejected"));
      await loadQueue();
    } catch (reason) {
      setError(errorMessage(reason));
    } finally {
      setWorking(false);
    }
  }

  function setChecklist(
    vacancyId: string,
    key: keyof ReviewVacancy["verification_checklist"],
    value: boolean,
  ) {
    setChecklists((current) => ({
      ...current,
      [vacancyId]: { ...current[vacancyId], [key]: value },
    }));
  }

  return (
    <main className="min-h-screen bg-canvas px-4 py-6 text-ink sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-forest">
              {t("brand")} {t("brandSuffix")}
            </p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">
              {t("adminReviewQueue")}
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">{t("adminReviewIntro")}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void runNow()}
              disabled={working}
              className="rounded-lg border border-forest px-4 py-2.5 text-sm font-semibold text-forest disabled:opacity-50"
            >
              {working ? t("working") : t("adminRunIngestion")}
            </button>
            <button
              type="button"
              onClick={() => navigate("/admin")}
              className="rounded-lg bg-forest px-4 py-2.5 text-sm font-semibold text-white"
            >
              {t("adminVacancies")}
            </button>
          </div>
        </header>

        {error && (
          <div
            role="alert"
            className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800"
          >
            {error}
          </div>
        )}
        {notice && (
          <div
            role="status"
            className="mb-4 rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-900"
          >
            {notice}
          </div>
        )}
        {lastRun?.run_summary?.skipped_sources?.map((source) => (
          <div
            key={source.source_id}
            className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900"
          >
            {source.source_id}: {source.reason}
          </div>
        ))}

        {loading ? (
          <p className="py-10 text-center text-sm text-muted">{t("loading")}</p>
        ) : vacancies.length === 0 ? (
          <section className="rounded-2xl border border-line bg-white p-8 text-center shadow-card">
            <h2 className="text-lg font-semibold">{t("adminQueueEmpty")}</h2>
            <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-muted">
              {t("adminQueueEmptyBody")}
            </p>
          </section>
        ) : (
          <div className="space-y-5">
            {vacancies.map((vacancy) => {
              const checklist = checklists[vacancy.id] ?? vacancy.verification_checklist;
              const fields = vacancy.extraction_payload?.post ?? {};
              const complete =
                Boolean(vacancy.title) &&
                Boolean(vacancy.recruiting_organization) &&
                Boolean(vacancy.application_start_date) &&
                Boolean(vacancy.deadline) &&
                Boolean(vacancy.age_cutoff_date) &&
                Boolean(vacancy.rule_json);
              const checklistComplete = Object.values(checklist).every(Boolean);
              const sourceDocument =
                vacancy.pdf_url ?? vacancy.source_notice_url ?? vacancy.official_source_url;

              return (
                <article
                  key={vacancy.id}
                  className="overflow-hidden rounded-2xl border border-line bg-white shadow-card"
                >
                  <header className="flex flex-wrap items-start justify-between gap-3 border-b border-line p-4 sm:p-5">
                    <div>
                      <h2 className="text-lg font-bold">{vacancy.title ?? t("adminNotEntered")}</h2>
                      <p className="mt-1 text-sm text-muted">
                        {vacancy.recruiting_organization ?? t("adminNotEntered")}
                      </p>
                      <p className="mt-1 text-xs text-muted">
                        {t("adminIngestionStatus")}:{" "}
                        {t(`adminIngestion_${vacancy.ingestion_status}`)}
                        {" · "}
                        {t("adminOverallConfidence")}:{" "}
                        {Math.round(vacancy.extraction_confidence * 100)}%
                      </p>
                    </div>
                    <a
                      href={sourceDocument}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded-lg border border-line px-3 py-2 text-sm font-semibold text-forest hover:bg-canvas"
                    >
                      {t("adminOpenSourceDocument")}
                    </a>
                  </header>

                  {vacancy.review_reasons.length > 0 && (
                    <ul className="space-y-1 border-b border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 sm:px-5">
                      {vacancy.review_reasons.map((reason) => (
                        <li key={reason}>• {reason}</li>
                      ))}
                    </ul>
                  )}

                  <div className="grid divide-y divide-line lg:grid-cols-2 lg:divide-x lg:divide-y-0">
                    <section className="p-4 sm:p-5">
                      <h3 className="mb-3 font-semibold">{t("adminExtractedFields")}</h3>
                      {Object.keys(fields).length === 0 ? (
                        <p className="text-sm text-muted">{t("adminNoExtractedFields")}</p>
                      ) : (
                        <dl className="space-y-2">
                          {Object.entries(fields).map(([name, field]) => {
                            const confidence =
                              vacancy.source_quotes.confidence?.[name] ?? field.confidence ?? 0;
                            const low = confidence < confidenceThreshold;
                            return (
                              <div
                                key={name}
                                className={`rounded-lg border p-3 ${low ? "border-red-300 bg-red-50" : "border-line bg-white"}`}
                              >
                                <dt className="flex items-center justify-between gap-2 text-xs font-semibold uppercase tracking-wide text-muted">
                                  <span>{name.replace(/_/g, " ")}</span>
                                  <span className={low ? "text-red-700" : "text-muted"}>
                                    {Math.round(confidence * 100)}%
                                  </span>
                                </dt>
                                <dd className="mt-1 break-words text-sm">
                                  {displayValue(field.value, t)}
                                </dd>
                              </div>
                            );
                          })}
                        </dl>
                      )}
                    </section>

                    <section className="p-4 sm:p-5">
                      <h3 className="mb-3 font-semibold">{t("adminSourceQuotes")}</h3>
                      {Object.keys(fields).length === 0 ? (
                        <p className="text-sm text-muted">{t("adminNoQuotes")}</p>
                      ) : (
                        <dl className="space-y-2">
                          {Object.entries(fields).map(([name, field]) => {
                            const quote =
                              vacancy.source_quotes.quotes?.[name] ?? field.source_quote;
                            const confidence =
                              vacancy.source_quotes.confidence?.[name] ?? field.confidence ?? 0;
                            const low = confidence < confidenceThreshold || !quote;
                            return (
                              <div
                                key={name}
                                className={`rounded-lg border p-3 ${low ? "border-red-300 bg-red-50" : "border-line bg-canvas"}`}
                              >
                                <dt
                                  className={`text-xs font-semibold uppercase tracking-wide ${low ? "text-red-700" : "text-muted"}`}
                                >
                                  {name.replace(/_/g, " ")}
                                </dt>
                                <dd className="mt-1 text-sm leading-6">
                                  {quote || t("adminNoSourceQuote")}
                                </dd>
                              </div>
                            );
                          })}
                        </dl>
                      )}
                    </section>
                  </div>

                  <section className="border-t border-line bg-canvas/50 p-4 sm:p-5">
                    <h3 className="font-semibold">{t("adminVerificationChecklist")}</h3>
                    <div className="mt-3 grid gap-2 sm:grid-cols-3">
                      {(
                        [
                          ["source_checked", "adminSourceChecked"],
                          ["dates_checked", "adminDatesChecked"],
                          ["rules_checked", "adminRulesChecked"],
                        ] as const
                      ).map(([key, labelKey]) => (
                        <label
                          key={key}
                          className="flex items-start gap-2 rounded-lg border border-line bg-white p-3 text-sm"
                        >
                          <input
                            type="checkbox"
                            checked={checklist[key]}
                            onChange={(event) =>
                              setChecklist(vacancy.id, key, event.target.checked)
                            }
                          />
                          {t(labelKey)}
                        </label>
                      ))}
                    </div>
                    <div className="mt-4 flex flex-wrap gap-2">
                      <button
                        type="button"
                        disabled={working || !complete || !checklistComplete}
                        onClick={() => void approveAndPublish(vacancy)}
                        className="rounded-lg bg-forest px-4 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {t("adminApprovePublish")}
                      </button>
                      <button
                        type="button"
                        disabled={working}
                        onClick={() => navigate(`/admin?edit=${encodeURIComponent(vacancy.id)}`)}
                        className="rounded-lg border border-line px-4 py-2.5 text-sm font-semibold text-ink disabled:opacity-50"
                      >
                        {t("adminEdit")}
                      </button>
                      <button
                        type="button"
                        disabled={working}
                        onClick={() => void reject(vacancy)}
                        className="rounded-lg border border-red-300 px-4 py-2.5 text-sm font-semibold text-red-700 disabled:opacity-50"
                      >
                        {t("adminReject")}
                      </button>
                    </div>
                    {!complete && (
                      <p className="mt-2 text-xs text-muted">{t("adminCompleteBeforePublish")}</p>
                    )}
                    <p className="mt-2 text-xs leading-5 text-muted">{t("adminCutoffNotice")}</p>
                  </section>
                </article>
              );
            })}
          </div>
        )}

        <section className="mt-8 rounded-2xl border border-line bg-white p-4 shadow-card sm:p-5">
          <h2 className="font-bold">{t("adminIngestionRuns")}</h2>
          {runs.length === 0 ? (
            <p className="mt-2 text-sm text-muted">{t("adminNoIngestionRuns")}</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {runs.map((run) => (
                <li
                  key={run.started_at}
                  className="flex flex-wrap justify-between gap-2 border-t border-line pt-2 text-sm"
                >
                  <span>
                    {new Date(run.started_at).toLocaleString()} · {run.sources_checked.length}{" "}
                    {t("adminSourcesChecked")}
                  </span>
                  <span className={run.failures.length ? "text-red-700" : "text-muted"}>
                    {run.new_notices_found} {t("adminNewNotices")} · {run.failures.length}{" "}
                    {t("adminFailures")}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </main>
  );
}
