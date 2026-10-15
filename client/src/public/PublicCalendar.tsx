import { useEffect, useMemo, useState } from "react";
import { CalendarDays, CircleAlert } from "lucide-react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { SiteHeader } from "../components/SiteHeader";
import { fetchPublicVacancies, type PublicVacancy } from "./public-vacancy-api";

type CalendarItem = { date: string; kind: "start" | "deadline"; vacancy: PublicVacancy };

function localDate(value: string, language: "en" | "hi") {
  return new Intl.DateTimeFormat(language === "hi" ? "hi-IN" : "en-IN", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${value.slice(0, 10)}T00:00:00Z`));
}

export function PublicCalendar() {
  const { i18n } = useTranslation();
  const hindi = i18n.resolvedLanguage?.startsWith("hi") ?? false;
  const language = hindi ? "hi" : "en";
  const [vacancies, setVacancies] = useState<PublicVacancy[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let active = true;
    void fetchPublicVacancies()
      .then(({ vacancies: records }) => {
        if (active) setVacancies(records);
      })
      .catch(() => {
        if (active) setError(true);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const items = useMemo(
    () =>
      vacancies
        .flatMap((vacancy) => [
          ...(vacancy.application_start_date
            ? [{ date: vacancy.application_start_date, kind: "start" as const, vacancy }]
            : []),
          { date: vacancy.deadline, kind: "deadline" as const, vacancy },
        ])
        .sort((first, second) => first.date.localeCompare(second.date)),
    [vacancies],
  );

  return (
    <div className="min-h-screen bg-canvas text-ink">
      <SiteHeader />
      <main className="mx-auto max-w-5xl px-4 py-7 sm:px-6 sm:py-10">
        <header className="rounded-3xl bg-forest p-6 text-white sm:p-9">
          <span className="inline-flex items-center gap-2 text-sm font-semibold text-white/75">
            <CalendarDays size={17} aria-hidden="true" />
            {hindi ? "सत्यापित भर्ती तारीख़ें" : "Verified recruitment dates"}
          </span>
          <h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
            {hindi ? "भर्ती कैलेंडर" : "Exam calendar"}
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-white/80">
            {hindi
              ? "यह कैलेंडर केवल सत्यापित खुली भर्तियों की आवेदन शुरू और अंतिम तारीख़ दिखाता है। व्यक्तिगत या परीक्षा की तारीख़ें यहाँ शामिल नहीं हैं।"
              : "This calendar shows application opening and closing dates only for verified open vacancies. Personal and examination dates are not included."}
          </p>
        </header>

        {loading ? (
          <div className="mt-6 space-y-3" aria-busy="true">
            {[1, 2, 3].map((item) => (
              <div key={item} className="h-20 animate-pulse rounded-2xl bg-white" />
            ))}
          </div>
        ) : error ? (
          <div
            role="alert"
            className="mt-6 rounded-2xl border border-red-200 bg-white p-5 text-sm text-red-800"
          >
            {hindi
              ? "कैलेंडर लोड नहीं हो सका। API सर्वर चल रहा है, यह जाँचें।"
              : "Calendar could not load. Check that the API server is running."}
          </div>
        ) : items.length === 0 ? (
          <div className="mt-6 rounded-2xl border border-line bg-white px-6 py-12 text-center">
            <CircleAlert className="mx-auto text-forest" size={28} aria-hidden="true" />
            <h2 className="mt-3 text-lg font-bold">
              {hindi ? "अभी तारीख़ें उपलब्ध नहीं हैं" : "No dates available yet"}
            </h2>
            <p className="mt-2 text-sm text-muted">
              {hindi
                ? "नई भर्ती के लिए आधिकारिक वेबसाइट देखें।"
                : "Check official recruitment websites for new notices."}
            </p>
          </div>
        ) : (
          <ol className="mt-6 space-y-3">
            {items.map((item: CalendarItem) => (
              <li
                key={`${item.vacancy.id}-${item.kind}`}
                className="grid gap-3 rounded-2xl border border-line bg-white p-4 shadow-card sm:grid-cols-[160px_minmax(0,1fr)_auto] sm:items-center sm:p-5"
              >
                <div>
                  <p className="text-xs font-bold uppercase tracking-wide text-forest">
                    {item.kind === "start"
                      ? hindi
                        ? "आवेदन शुरू"
                        : "Applications open"
                      : hindi
                        ? "अंतिम तारीख़"
                        : "Deadline"}
                  </p>
                  <time className="mt-1 block text-sm font-semibold">
                    {localDate(item.date, language)}
                  </time>
                </div>
                <div className="min-w-0">
                  <p className="truncate text-xs font-semibold text-muted">
                    {item.vacancy.recruiting_organization}
                  </p>
                  <Link
                    to={`/jobs/${item.vacancy.id}`}
                    className="mt-1 inline-block font-bold text-ink hover:text-forest hover:underline"
                  >
                    {item.vacancy.title}
                  </Link>
                </div>
                <Link
                  to={`/jobs/${item.vacancy.id}`}
                  className="text-sm font-semibold text-forest underline underline-offset-2"
                >
                  {hindi ? "सूचना देखें" : "View notice"}
                </Link>
              </li>
            ))}
          </ol>
        )}
      </main>
    </div>
  );
}
