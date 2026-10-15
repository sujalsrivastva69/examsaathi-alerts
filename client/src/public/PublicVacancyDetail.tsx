import { useEffect, useState } from "react";
import {
  ArrowLeft,
  ArrowUpRight,
  CalendarDays,
  CheckCircle2,
  GraduationCap,
  MapPin,
  ShieldCheck,
} from "lucide-react";
import { Link, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { SiteHeader } from "../components/SiteHeader";
import { fetchPublicVacancy, type PublicVacancy } from "./public-vacancy-api";

function formatDate(value: string | null, language: "en" | "hi") {
  if (!value) return null;
  return new Intl.DateTimeFormat(language === "hi" ? "hi-IN" : "en-IN", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${value.slice(0, 10)}T00:00:00Z`));
}

export function PublicVacancyDetail() {
  const { id = "" } = useParams();
  const { i18n } = useTranslation();
  const hindi = i18n.resolvedLanguage?.startsWith("hi") ?? false;
  const language = hindi ? "hi" : "en";
  const [vacancy, setVacancy] = useState<PublicVacancy | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    void fetchPublicVacancy(id)
      .then(({ vacancy: record }) => {
        if (active) setVacancy(record);
      })
      .catch((reason: unknown) => {
        if (!active) return;
        setError(
          reason instanceof Error && reason.message === "VACANCY_NOT_FOUND"
            ? hindi
              ? "यह सत्यापित भर्ती अब उपलब्ध नहीं है।"
              : "This verified vacancy is no longer available."
            : hindi
              ? "भर्ती की जानकारी लोड नहीं हो सकी। API सर्वर चल रहा है, यह जाँचें।"
              : "Vacancy details could not load. Check that the API server is running.",
        );
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [id, hindi]);

  const title = hindi ? "भर्ती की जानकारी" : "Vacancy details";

  return (
    <div className="min-h-screen bg-canvas text-ink">
      <SiteHeader />
      <main className="mx-auto max-w-4xl px-4 py-7 sm:px-6 sm:py-10">
        <Link
          to="/jobs"
          className="inline-flex items-center gap-2 text-sm font-semibold text-forest hover:underline"
        >
          <ArrowLeft size={16} aria-hidden="true" />
          {hindi ? "सभी भर्तियाँ" : "All vacancies"}
        </Link>
        {loading ? (
          <div
            className="mt-6 animate-pulse rounded-3xl border border-line bg-white p-7"
            aria-busy="true"
          >
            <div className="h-5 w-1/3 rounded bg-canvas" />
            <div className="mt-4 h-8 w-3/4 rounded bg-canvas" />
            <div className="mt-8 h-40 rounded bg-canvas" />
          </div>
        ) : error ? (
          <section role="alert" className="mt-6 rounded-2xl border border-red-200 bg-white p-6">
            <h1 className="text-xl font-bold">{title}</h1>
            <p className="mt-2 text-sm text-red-800">{error}</p>
            <Link
              to="/jobs"
              className="mt-4 inline-flex rounded-lg bg-forest px-4 py-2.5 text-sm font-semibold text-white"
            >
              {hindi ? "सूची पर लौटें" : "Return to listings"}
            </Link>
          </section>
        ) : vacancy ? (
          <>
            <header className="mt-5 rounded-3xl bg-forest p-6 text-white shadow-card sm:p-9">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1.5 text-xs font-semibold">
                <CheckCircle2 size={14} aria-hidden="true" />
                {hindi ? "सत्यापित और खुली भर्ती" : "Verified open vacancy"}
              </span>
              <p className="mt-5 text-sm font-semibold text-white/75">
                {vacancy.recruiting_organization}
              </p>
              <h1 className="mt-2 text-3xl font-bold leading-tight tracking-tight sm:text-4xl">
                {vacancy.title}
              </h1>
              <p className="mt-4 flex items-center gap-2 text-sm text-white/80">
                <MapPin size={16} aria-hidden="true" />
                {vacancy.location_state ??
                  (hindi ? "स्थान सूचना में निर्दिष्ट नहीं" : "Location not specified in listing")}
              </p>
            </header>

            <section className="mt-5 grid gap-4 sm:grid-cols-2" aria-label={title}>
              <DateCard
                label={hindi ? "आवेदन शुरू" : "Applications open"}
                value={
                  formatDate(vacancy.application_start_date, language) ??
                  (hindi ? "सूचीबद्ध नहीं" : "Not listed")
                }
              />
              <DateCard
                label={hindi ? "अंतिम तारीख़" : "Application deadline"}
                value={
                  formatDate(vacancy.deadline, language) ?? (hindi ? "सूचीबद्ध नहीं" : "Not listed")
                }
              />
              <DateCard
                label={hindi ? "आयु कटऑफ़" : "Age cutoff date"}
                value={
                  formatDate(vacancy.age_cutoff_date, language) ??
                  (hindi ? "सूचना में उपलब्ध नहीं" : "Not available in listing")
                }
              />
              <DateCard
                label={hindi ? "आख़िरी बार सत्यापित" : "Last verified"}
                value={
                  formatDate(vacancy.last_verified_at, language) ??
                  (hindi ? "उपलब्ध नहीं" : "Unavailable")
                }
              />
            </section>

            <section className="mt-5 rounded-2xl border border-line bg-white p-5 shadow-card sm:p-7">
              <h2 className="flex items-center gap-2 text-lg font-bold">
                <GraduationCap className="text-forest" size={20} aria-hidden="true" />
                {hindi ? "सूचीबद्ध योग्यता नियम" : "Listed eligibility rules"}
              </h2>
              <dl className="mt-4 grid gap-4 text-sm sm:grid-cols-2">
                <Rule
                  label={hindi ? "शिक्षा" : "Education"}
                  value={vacancy.qualification_level?.replace(/_/g, " ") ?? null}
                  unknown={hindi ? "सूचीबद्ध नहीं" : "Not listed"}
                />
                <Rule
                  label={hindi ? "स्वीकृत विषय" : "Accepted disciplines"}
                  value={
                    vacancy.allowed_disciplines.length
                      ? vacancy.allowed_disciplines.join(", ")
                      : null
                  }
                  unknown={hindi ? "विशिष्ट विषय सूचीबद्ध नहीं" : "No specific disciplines listed"}
                />
                <Rule
                  label={hindi ? "आयु सीमा" : "Age range"}
                  value={
                    vacancy.eligibility.min_age !== null && vacancy.eligibility.max_age !== null
                      ? `${vacancy.eligibility.min_age}–${vacancy.eligibility.max_age}`
                      : null
                  }
                  unknown={hindi ? "उपलब्ध नहीं" : "Not available"}
                />
                <Rule
                  label={hindi ? "न्यूनतम अनुभव" : "Minimum experience"}
                  value={
                    vacancy.eligibility.min_experience_years !== null
                      ? `${vacancy.eligibility.min_experience_years} ${hindi ? "वर्ष" : "years"}`
                      : null
                  }
                  unknown={hindi ? "उपलब्ध नहीं" : "Not available"}
                />
                <Rule
                  label={hindi ? "निवास शर्त" : "Domicile requirement"}
                  value={
                    vacancy.eligibility.domicile_states.length
                      ? vacancy.eligibility.domicile_states.join(", ")
                      : null
                  }
                  unknown={
                    hindi ? "कोई विशेष राज्य सूचीबद्ध नहीं" : "No state-specific requirement listed"
                  }
                />
                <Rule
                  label={hindi ? "श्रेणी के अनुसार आयु छूट" : "Category age relaxations"}
                  value={formatRelaxations(vacancy.eligibility.age_relaxations, hindi)}
                  unknown={hindi ? "उपलब्ध नहीं" : "Not available"}
                />
              </dl>
              <p className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm leading-6 text-amber-950">
                <ShieldCheck
                  className="mr-1.5 inline-block size-4 align-[-3px]"
                  aria-hidden="true"
                />
                {hindi
                  ? "यह सूची केवल प्रारंभिक जानकारी है, पात्रता का निर्णय नहीं। सभी शर्तें आधिकारिक सूचना में जाँचें।"
                  : "This listing is informational, not an eligibility decision. Confirm every condition in the official notice."}
              </p>
            </section>

            <section className="mt-5 rounded-2xl border border-line bg-white p-5 shadow-card sm:p-7">
              <h2 className="text-lg font-bold">{hindi ? "आधिकारिक लिंक" : "Official links"}</h2>
              <div className="mt-4 flex flex-wrap gap-3">
                <a
                  href={vacancy.official_source_url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-line px-4 py-2.5 text-sm font-semibold text-forest hover:bg-mint"
                >
                  {hindi ? "आधिकारिक सूचना खोलें" : "Open official notice"}
                  <ArrowUpRight size={16} aria-hidden="true" />
                </a>
                {vacancy.pdf_url && (
                  <a
                    href={vacancy.pdf_url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-line px-4 py-2.5 text-sm font-semibold text-forest hover:bg-mint"
                  >
                    {hindi ? "सूचना PDF" : "Notice PDF"}
                    <ArrowUpRight size={16} aria-hidden="true" />
                  </a>
                )}
                <a
                  href={vacancy.application_url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-forest px-4 py-2.5 text-sm font-semibold text-white hover:bg-forest-dark"
                >
                  {hindi ? "आधिकारिक आवेदन साइट" : "Official application site"}
                  <ArrowUpRight size={16} aria-hidden="true" />
                </a>
              </div>
              <p className="mt-4 text-xs text-muted">
                {hindi
                  ? "ExamSaathi स्वतंत्र सेवा है। तारीख़ें और पात्रता भर्ती संस्था की आधिकारिक सूचना से दोबारा जाँचें।"
                  : "ExamSaathi is an independent service. Recheck dates and eligibility in the recruiting authority’s official notice."}
              </p>
            </section>
          </>
        ) : null}
      </main>
    </div>
  );
}

function DateCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-line bg-white p-5 shadow-card">
      <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted">
        <CalendarDays size={15} aria-hidden="true" />
        {label}
      </p>
      <p className="mt-2 text-lg font-bold text-ink">{value}</p>
    </div>
  );
}

function Rule({ label, value, unknown }: { label: string; value: string | null; unknown: string }) {
  return (
    <div className="rounded-xl bg-canvas p-3">
      <dt className="text-xs font-semibold text-muted">{label}</dt>
      <dd className="mt-1 font-semibold capitalize text-ink">{value ?? unknown}</dd>
    </div>
  );
}

function formatRelaxations(relaxations: Record<string, number> | null, hindi: boolean) {
  if (!relaxations) return null;
  const defined = Object.entries(relaxations).filter(([, years]) => years > 0);
  if (!defined.length)
    return hindi ? "कोई स्पष्ट छूट सूचीबद्ध नहीं" : "No explicit relaxation listed";
  return defined
    .map(([category, years]) => `${category.toUpperCase()}: ${years} ${hindi ? "वर्ष" : "years"}`)
    .join(" · ");
}
