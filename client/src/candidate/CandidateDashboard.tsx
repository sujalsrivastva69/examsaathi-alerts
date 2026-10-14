import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, ArrowRight, BriefcaseBusiness, RotateCw } from "lucide-react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ApiError, apiRequest } from "../lib/api";
import { CandidateLayout } from "./CandidateLayout";
import type { ActionStatus, CandidateMatch } from "./types";

function todayInIndia() {
  const values = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Kolkata",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    })
      .formatToParts(new Date())
      .map(({ type, value }) => [type, value]),
  );
  return `${values.year}-${values.month}-${values.day}`;
}

function daysRemaining(deadline: string) {
  const today = new Date(`${todayInIndia()}T00:00:00Z`);
  const due = new Date(`${deadline.slice(0, 10)}T00:00:00Z`);
  return Math.ceil((due.getTime() - today.getTime()) / 86_400_000);
}

function dateLabel(value: string, language: string) {
  return new Intl.DateTimeFormat(language === "hi" ? "hi-IN" : "en-IN", {
    dateStyle: "medium",
    timeZone: "UTC",
  }).format(new Date(`${value.slice(0, 10)}T00:00:00Z`));
}

const trackerStatuses: ActionStatus[] = ["interested", "started", "applied", "not_interested"];

function SkeletonCards() {
  return (
    <div className="space-y-3" aria-label="Loading matches" aria-busy="true">
      {[0, 1, 2].map((item) => (
        <div key={item} className="animate-pulse rounded-2xl border border-line bg-white p-5">
          <div className="h-4 w-2/3 rounded bg-line" />
          <div className="mt-4 h-3 w-1/2 rounded bg-canvas" />
          <div className="mt-6 h-9 w-28 rounded-lg bg-canvas" />
        </div>
      ))}
    </div>
  );
}

export function CandidateDashboard() {
  const { t, i18n } = useTranslation();
  const [matches, setMatches] = useState<CandidateMatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [deadlineFilter, setDeadlineFilter] = useState("all");
  const [stateFilter, setStateFilter] = useState("all");
  const [sectorFilter, setSectorFilter] = useState("all");
  const [trackerFilter, setTrackerFilter] = useState("all");

  const loadMatches = useCallback(async () => {
    try {
      setError("");
      setLoading(true);
      const result = await apiRequest<{ matches: CandidateMatch[] }>("/matches");
      setMatches(result.matches);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : t("candidateLoadError"));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void loadMatches();
  }, [loadMatches]);

  const states = useMemo(
    () =>
      [
        ...new Set(
          matches.flatMap((match) => [
            ...(match.vacancy.rule_json.domicile_states ?? []),
            ...(match.vacancy.location_state ? [match.vacancy.location_state] : []),
          ]),
        ),
      ].sort(),
    [matches],
  );
  const sectors = useMemo(
    () => [...new Set(matches.flatMap((match) => match.vacancy.sectors ?? []))].sort(),
    [matches],
  );
  const visibleMatches = matches.filter((match) => {
    const remaining = daysRemaining(match.vacancy.deadline);
    const rule = match.vacancy.rule_json;
    return (
      (deadlineFilter === "all" ||
        (deadlineFilter === "open" && remaining >= 0) ||
        (deadlineFilter === "soon" && remaining >= 0 && remaining < 3) ||
        (deadlineFilter === "week" && remaining >= 0 && remaining <= 7)) &&
      (stateFilter === "all" ||
        rule.domicile_states?.includes(stateFilter) ||
        match.vacancy.location_state === stateFilter) &&
      (sectorFilter === "all" || match.vacancy.sectors?.includes(sectorFilter)) &&
      (trackerFilter === "all" ||
        (trackerFilter === "not_started" && !match.action) ||
        match.action?.status === trackerFilter)
    );
  });
  const language = i18n.resolvedLanguage?.startsWith("hi") ? "hi" : "en";

  return (
    <CandidateLayout>
      <div className="mb-5 rounded-xl border border-[#e8c885] bg-[#fff7e8] px-4 py-3 text-sm font-semibold text-[#6b4516]">
        <AlertTriangle className="mr-2 inline-block size-4 align-[-3px]" aria-hidden="true" />
        {t("candidateDisclaimer")}
      </div>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{t("candidateMatches")}</h1>
          <p className="mt-1 text-sm leading-6 text-muted">{t("candidateMatchesIntro")}</p>
        </div>
        <button
          type="button"
          onClick={() => void loadMatches()}
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-lg border border-line bg-white px-3 py-2 text-sm font-semibold text-forest focus:outline-none focus-visible:ring-2 focus-visible:ring-forest disabled:opacity-60"
        >
          <RotateCw size={15} aria-hidden="true" />
          {t("candidateRefresh")}
        </button>
      </div>

      <section
        aria-label={t("candidateFilters")}
        className="mb-5 grid gap-3 rounded-2xl border border-line bg-white p-4 sm:grid-cols-2 lg:grid-cols-4"
      >
        <label className="text-xs font-semibold text-muted">
          {t("candidateDeadlineFilter")}
          <select
            value={deadlineFilter}
            onChange={(event) => setDeadlineFilter(event.target.value)}
            className="mt-1.5 min-h-11 w-full rounded-lg border border-line bg-white px-3 text-sm text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-forest"
          >
            <option value="all">{t("candidateFilterAll")}</option>
            <option value="open">{t("candidateDeadlineOpen")}</option>
            <option value="soon">{t("candidateDeadlineThreeDays")}</option>
            <option value="week">{t("candidateDeadlineWeek")}</option>
          </select>
        </label>
        <label className="text-xs font-semibold text-muted">
          {t("state")}
          <select
            value={stateFilter}
            onChange={(event) => setStateFilter(event.target.value)}
            className="mt-1.5 min-h-11 w-full rounded-lg border border-line bg-white px-3 text-sm text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-forest"
          >
            <option value="all">{t("candidateFilterAll")}</option>
            {states.map((state) => (
              <option key={state} value={state}>
                {state}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs font-semibold text-muted">
          {t("candidateSectorFilter")}
          <select
            value={sectorFilter}
            onChange={(event) => setSectorFilter(event.target.value)}
            className="mt-1.5 min-h-11 w-full rounded-lg border border-line bg-white px-3 text-sm text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-forest"
          >
            <option value="all">{t("candidateFilterAll")}</option>
            {sectors.map((sector) => (
              <option key={sector} value={sector}>
                {sector}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs font-semibold text-muted">
          {t("candidateTrackerFilter")}
          <select
            value={trackerFilter}
            onChange={(event) => setTrackerFilter(event.target.value)}
            className="mt-1.5 min-h-11 w-full rounded-lg border border-line bg-white px-3 text-sm text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-forest"
          >
            <option value="all">{t("candidateFilterAll")}</option>
            <option value="not_started">{t("candidateTrackerNotStarted")}</option>
            {trackerStatuses.map((status) => (
              <option key={status} value={status}>
                {t(`candidateAction_${status}`)}
              </option>
            ))}
          </select>
        </label>
      </section>

      {error && (
        <div
          role="alert"
          className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#e8c2bd] bg-[#fff1ef] p-4 text-sm text-[#76392f]"
        >
          {error}
          <button
            type="button"
            onClick={() => void loadMatches()}
            className="font-semibold underline focus:outline-none focus-visible:ring-2 focus-visible:ring-forest"
          >
            {t("candidateRetry")}
          </button>
        </div>
      )}

      {loading ? (
        <SkeletonCards />
      ) : visibleMatches.length === 0 ? (
        <section className="rounded-2xl border border-line bg-white px-5 py-12 text-center shadow-card">
          <BriefcaseBusiness className="mx-auto size-9 text-forest" aria-hidden="true" />
          <h2 className="mt-4 text-lg font-bold">
            {t(matches.length ? "candidateNoFilterResults" : "candidateEmptyTitle")}
          </h2>
          <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-muted">
            {t(matches.length ? "candidateNoFilterResultsBody" : "candidateEmptyBody")}
          </p>
          {!matches.length && (
            <Link
              to="/profile/setup"
              className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-lg bg-forest px-4 py-2.5 text-sm font-semibold text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-forest focus-visible:ring-offset-2"
            >
              {t("setupProfile")}
              <ArrowRight size={16} aria-hidden="true" />
            </Link>
          )}
        </section>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {visibleMatches.map((match) => {
            const days = daysRemaining(match.vacancy.deadline);
            const badge =
              match.status === "preliminary_match"
                ? "bg-[#e8f1eb] text-[#285b46]"
                : "bg-[#fff3df] text-[#8a571b]";
            return (
              <article
                key={match.vacancy_id}
                className="rounded-2xl border border-line bg-white p-5 shadow-card sm:p-6"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${badge}`}>
                      {t(match.status === "preliminary_match" ? "preliminaryMatch" : "needsReview")}
                    </span>
                    <h2 className="mt-3 text-lg font-bold leading-snug">{match.vacancy.title}</h2>
                    <p className="mt-1 text-sm text-muted">
                      {match.vacancy.recruiting_organization}
                    </p>
                    {match.vacancy.location_state && (
                      <p className="mt-1 text-xs text-muted">{match.vacancy.location_state}</p>
                    )}
                  </div>
                  <p
                    className={`rounded-lg px-3 py-2 text-right text-xs font-bold ${days >= 0 && days < 3 ? "bg-[#fff0e8] text-[#a13d17]" : "bg-canvas text-muted"}`}
                  >
                    {days < 0
                      ? t("candidateDeadlinePassed")
                      : t(days === 1 ? "candidateDayLeft" : "candidateDaysLeft", { count: days })}
                  </p>
                </div>
                <p className="mt-4 text-sm text-muted">
                  {t("adminDeadline")}: {dateLabel(match.vacancy.deadline, language)}
                  {match.action && (
                    <span className="ml-2 rounded-full bg-canvas px-2 py-1 text-xs font-medium text-ink">
                      {t(`candidateAction_${match.action.status}`)}
                    </span>
                  )}
                </p>
                <Link
                  to={`/matches/${match.vacancy_id}`}
                  className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-lg bg-forest px-4 py-2.5 text-sm font-semibold text-white hover:bg-forest-dark focus:outline-none focus-visible:ring-2 focus-visible:ring-forest focus-visible:ring-offset-2"
                >
                  {t("candidateViewDetails")}
                  <ArrowRight size={16} aria-hidden="true" />
                </Link>
              </article>
            );
          })}
        </div>
      )}
    </CandidateLayout>
  );
}
