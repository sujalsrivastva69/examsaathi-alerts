import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, Check, CircleHelp, ExternalLink, Minus, RotateCw } from "lucide-react";
import { Link, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ApiError, apiRequest } from "../lib/api";
import { CandidateLayout } from "./CandidateLayout";
import type { ActionStatus, ExplanationItem, MatchDetail } from "./types";

const explanationKeys = ["qualification", "age", "discipline", "state", "experience"] as const;
const actionStatuses: ActionStatus[] = ["interested", "started", "applied", "not_interested"];

function dateTime(value: string | null, language: string) {
  if (!value) return "";
  return new Intl.DateTimeFormat(language === "hi" ? "hi-IN" : "en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function readableValue(value: unknown) {
  if (value === null || value === undefined) return "—";
  if (typeof value === "string") return value;
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function StatusIcon({ status }: { status: ExplanationItem["status"] }) {
  if (status === "matched") return <Check className="size-4" aria-hidden="true" />;
  if (status === "not_matched") return <Minus className="size-4" aria-hidden="true" />;
  return <CircleHelp className="size-4" aria-hidden="true" />;
}

export function VacancyDetail() {
  const { id = "" } = useParams();
  const { t, i18n } = useTranslation();
  const [detail, setDetail] = useState<MatchDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingAction, setSavingAction] = useState<ActionStatus | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const language = i18n.resolvedLanguage?.startsWith("hi") ? "hi" : "en";

  const loadDetail = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      setDetail(await apiRequest<MatchDetail>(`/matches/${encodeURIComponent(id)}`));
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : t("candidateLoadError"));
    } finally {
      setLoading(false);
    }
  }, [id, t]);

  useEffect(() => {
    void loadDetail();
  }, [loadDetail]);

  async function saveAction(status: ActionStatus) {
    try {
      setSavingAction(status);
      setError("");
      setSuccess("");
      await apiRequest(`/matches/${encodeURIComponent(id)}/action`, {
        method: "PUT",
        body: { status },
      });
      setSuccess(t("candidateActionSaved"));
      await loadDetail();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t("candidateSaveError"));
    } finally {
      setSavingAction(null);
    }
  }

  return (
    <CandidateLayout>
      <Link
        to="/dashboard"
        className="inline-flex min-h-10 items-center gap-2 rounded-lg text-sm font-semibold text-forest focus:outline-none focus-visible:ring-2 focus-visible:ring-forest"
      >
        <ArrowLeft size={16} aria-hidden="true" />
        {t("candidateBackToMatches")}
      </Link>
      {loading ? (
        <div className="mt-5 animate-pulse space-y-4" aria-busy="true" aria-label={t("loading")}>
          <div className="h-32 rounded-2xl bg-white" />
          <div className="h-60 rounded-2xl bg-white" />
          <div className="h-44 rounded-2xl bg-white" />
        </div>
      ) : error && !detail ? (
        <div
          role="alert"
          className="mt-5 rounded-xl border border-[#e8c2bd] bg-[#fff1ef] p-4 text-sm text-[#76392f]"
        >
          <p>{error}</p>
          <button
            type="button"
            onClick={() => void loadDetail()}
            className="mt-3 inline-flex min-h-10 items-center gap-2 font-semibold underline focus:outline-none focus-visible:ring-2 focus-visible:ring-forest"
          >
            <RotateCw size={15} aria-hidden="true" />
            {t("candidateRetry")}
          </button>
        </div>
      ) : detail ? (
        <div className="mt-4 grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="space-y-5">
            <div className="rounded-2xl border border-[#e8c885] bg-[#fff7e8] px-4 py-3 text-sm font-semibold text-[#6b4516]">
              {t("candidateDisclaimer")}
            </div>
            {error && (
              <p role="alert" className="rounded-lg bg-[#fff1ef] p-3 text-sm text-[#76392f]">
                {error}
              </p>
            )}
            {success && (
              <p role="status" className="rounded-lg bg-[#e8f1eb] p-3 text-sm text-[#285b46]">
                {success}
              </p>
            )}
            <section className="rounded-2xl border border-line bg-white p-5 shadow-card sm:p-7">
              <span
                className={`rounded-full px-2.5 py-1 text-xs font-semibold ${detail.match.status === "preliminary_match" ? "bg-[#e8f1eb] text-[#285b46]" : "bg-[#fff3df] text-[#8a571b]"}`}
              >
                {t(
                  detail.match.status === "preliminary_match" ? "preliminaryMatch" : "needsReview",
                )}
              </span>
              <h1 className="mt-3 text-2xl font-bold tracking-tight">
                {detail.match.vacancy.title}
              </h1>
              <p className="mt-1 text-muted">{detail.match.vacancy.recruiting_organization}</p>
              <div className="mt-5 flex flex-wrap gap-3">
                <a
                  href={detail.match.vacancy.official_source_url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-forest px-4 py-2 text-sm font-semibold text-forest hover:bg-mint focus:outline-none focus-visible:ring-2 focus-visible:ring-forest"
                >
                  {t("candidateOfficialNotice")}
                  <ExternalLink size={15} aria-hidden="true" />
                </a>
                <a
                  href={detail.match.vacancy.application_url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-forest px-4 py-2 text-sm font-semibold text-white hover:bg-forest-dark focus:outline-none focus-visible:ring-2 focus-visible:ring-forest focus-visible:ring-offset-2"
                >
                  {t("candidateApplicationLink")}
                  <ExternalLink size={15} aria-hidden="true" />
                </a>
              </div>
              <Link
                to={`/feedback?vacancy_id=${encodeURIComponent(detail.match.vacancy.id)}`}
                className="mt-4 inline-flex min-h-10 items-center rounded text-sm font-semibold text-forest underline underline-offset-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-forest"
              >
                {t("feedbackTitle")}
              </Link>
              <dl className="mt-5 grid gap-3 border-t border-line pt-4 text-sm sm:grid-cols-2">
                <div>
                  <dt className="text-xs font-semibold text-muted">{t("adminDeadline")}</dt>
                  <dd className="mt-1 font-medium">{detail.match.vacancy.deadline}</dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold text-muted">{t("candidateAgeCutoff")}</dt>
                  <dd className="mt-1 font-medium">{detail.match.vacancy.age_cutoff_date}</dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold text-muted">{t("candidateLastVerified")}</dt>
                  <dd className="mt-1 font-medium">
                    {detail.match.vacancy.last_verified_at
                      ? dateTime(detail.match.vacancy.last_verified_at, language)
                      : t("candidateNotAvailable")}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold text-muted">{t("candidateMatchUpdated")}</dt>
                  <dd className="mt-1 font-medium">
                    {dateTime(detail.match.evaluated_at, language)}
                  </dd>
                </div>
              </dl>
            </section>

            <section className="rounded-2xl border border-line bg-white p-5 shadow-card sm:p-6">
              <h2 className="text-lg font-bold">{t("candidateExplanationTitle")}</h2>
              <p className="mt-1 text-sm leading-6 text-muted">{t("candidateExplanationIntro")}</p>
              <ul className="mt-4 divide-y divide-line">
                {explanationKeys.map((key) => {
                  const item = detail.match.explanation[key];
                  const state = item?.status ?? "unknown";
                  const colors =
                    state === "matched"
                      ? "bg-[#e8f1eb] text-[#285b46]"
                      : state === "not_matched"
                        ? "bg-[#f7e9e8] text-[#98483e]"
                        : "bg-[#fff3df] text-[#8a571b]";
                  return (
                    <li key={key} className="flex items-start gap-3 py-3">
                      <span
                        className={`mt-0.5 grid size-7 shrink-0 place-items-center rounded-full ${colors}`}
                      >
                        <StatusIcon status={state} />
                      </span>
                      <div>
                        <h3 className="text-sm font-semibold">{t(`candidateCheck_${key}`)}</h3>
                        <p className="mt-1 text-sm leading-6 text-muted">
                          {item?.reason?.[language] ?? t("candidateExplanationMissing")}
                        </p>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>

            <section className="rounded-2xl border border-line bg-white p-5 shadow-card sm:p-6">
              <h2 className="text-lg font-bold">{t("candidateCorrectionHistory")}</h2>
              {detail.changes.length ? (
                <ol className="mt-4 space-y-4 border-l-2 border-line pl-4">
                  {detail.changes.map((change) => (
                    <li key={change.id} className="relative">
                      <span className="absolute -left-[21px] top-1 size-2.5 rounded-full bg-forest" />
                      <p className="text-sm font-semibold">
                        {change.field_name.replace(/_/g, " ")}
                      </p>
                      <p className="mt-1 break-words text-xs leading-5 text-muted">
                        {t("candidateOldValue")}: {readableValue(change.old_value)}
                      </p>
                      <p className="break-words text-xs leading-5 text-muted">
                        {t("candidateNewValue")}: {readableValue(change.new_value)}
                      </p>
                      <time className="mt-1 block text-xs text-muted" dateTime={change.changed_at}>
                        {dateTime(change.changed_at, language)}
                      </time>
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="mt-3 text-sm text-muted">{t("candidateNoCorrections")}</p>
              )}
            </section>
          </div>

          <aside className="space-y-5">
            <section className="rounded-2xl border border-line bg-white p-5 shadow-card">
              <h2 className="text-lg font-bold">{t("candidateTrackerTitle")}</h2>
              <p className="mt-1 text-sm leading-6 text-muted">{t("candidateTrackerIntro")}</p>
              <div className="mt-4 grid gap-2">
                {actionStatuses.map((status) => (
                  <button
                    key={status}
                    type="button"
                    onClick={() => void saveAction(status)}
                    disabled={savingAction !== null}
                    aria-pressed={detail.action?.status === status}
                    className={`min-h-11 rounded-lg border px-3 text-left text-sm font-semibold focus:outline-none focus-visible:ring-2 focus-visible:ring-forest disabled:opacity-60 ${detail.action?.status === status ? "border-forest bg-mint text-forest" : "border-line bg-white text-ink hover:bg-canvas"}`}
                  >
                    {savingAction === status ? t("working") : t(`candidateAction_${status}`)}
                  </button>
                ))}
              </div>
              {detail.action && (
                <p className="mt-3 text-xs text-muted">
                  {t("candidateCurrentStatus")}: {t(`candidateAction_${detail.action.status}`)} ·{" "}
                  {dateTime(detail.action.updated_at, language)}
                </p>
              )}
            </section>
            <section className="rounded-2xl border border-line bg-white p-5 shadow-card">
              <h2 className="text-lg font-bold">{t("candidateTrackerHistory")}</h2>
              {detail.actionHistory.length ? (
                <ol className="mt-3 space-y-3">
                  {detail.actionHistory.map((entry) => (
                    <li key={entry.id} className="border-l-2 border-forest pl-3">
                      <p className="text-sm font-semibold">
                        {t(`candidateAction_${entry.status}`)}
                      </p>
                      <time className="text-xs text-muted" dateTime={entry.changed_at}>
                        {dateTime(entry.changed_at, language)}
                      </time>
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="mt-2 text-sm text-muted">{t("candidateNoTrackerHistory")}</p>
              )}
            </section>
          </aside>
        </div>
      ) : null}
    </CandidateLayout>
  );
}
