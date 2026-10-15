import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  ArrowUpRight,
  BriefcaseBusiness,
  CalendarDays,
  CheckCircle2,
  GraduationCap,
  MapPin,
  Search,
  ShieldCheck,
} from "lucide-react";
import { Link, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { SiteHeader } from "../components/SiteHeader";
import { fetchPublicVacancies, type PublicVacancy } from "./public-vacancy-api";

const copy = {
  en: {
    jobs: "Latest vacancies",
    subtitle: "Browse open notices that have passed the platform's verification checklist.",
    search: "Search post, department, qualification...",
    allQualifications: "All qualifications",
    allStates: "All states",
    allRecruitingBodies: "All recruiting bodies",
    searchButton: "Search",
    loading: "Loading verified vacancies…",
    errorTitle: "Vacancies could not be loaded",
    apiUnavailable: "Vacancies could not load. Check that the API server is running.",
    retry: "Try again",
    emptyTitle: "No verified open vacancies listed yet",
    emptyBody:
      "Recruitment coverage is currently limited. We only show notices that have been reviewed and verified; check official recruitment websites for the latest announcements.",
    deadline: "Last date",
    qualification: "Qualification",
    location: "Location",
    official: "Official notice",
    apply: "Application site",
    details: "View vacancy details",
    verified: "Verified",
    matchNotice:
      "Preliminary match only. Please verify eligibility and all dates in the official notification.",
    count: "verified open notices",
    explore: "Browse all vacancies",
    heroEyebrow: "Government vacancies, made easier to review",
    heroTitle: "Find your next government job with more clarity.",
    heroDescription:
      "Browse verified notices, check key dates and eligibility rules, and keep track of applications—all with the official notification one click away.",
    createProfile: "Create your alert profile",
    howItWorks: "A clearer way to follow opportunities",
    howDescription:
      "The important details stay connected to the official notice, so you can review the source and decide for yourself.",
    steps: [
      ["Browse verified notices", "See the deadline, qualification and official source together."],
      [
        "Understand your match",
        "Review a transparent checklist based on your profile and notice rules.",
      ],
      [
        "Track your next step",
        "Save your application status and choose whether to receive alerts.",
      ],
    ],
    trust: "Important to know",
    trustBody:
      "A preliminary match is not an eligibility decision. The recruiting authority's official notice is final. Source coverage is limited and no automated source is enabled yet.",
    seeCoverage: "See coverage details",
    disclaimer: "We are independent and not affiliated with any government department.",
  },
  hi: {
    jobs: "नवीनतम भर्तियाँ",
    subtitle: "वे खुली सूचनाएँ देखें जिनकी प्लेटफ़ॉर्म पर जाँच और पुष्टि हुई है।",
    search: "पद, विभाग या योग्यता खोजें...",
    allQualifications: "सभी योग्यताएँ",
    allStates: "सभी राज्य",
    allRecruitingBodies: "सभी भर्ती संस्थाएँ",
    searchButton: "खोजें",
    loading: "सत्यापित भर्तियाँ लोड हो रही हैं…",
    errorTitle: "भर्तियाँ लोड नहीं हो सकीं",
    apiUnavailable: "भर्तियाँ लोड नहीं हो सकीं। API सर्वर चल रहा है, यह जाँचें।",
    retry: "फिर कोशिश करें",
    emptyTitle: "अभी कोई खुली सत्यापित भर्ती सूचीबद्ध नहीं है",
    emptyBody:
      "अभी भर्ती कवरेज सीमित है। हम केवल जाँची और सत्यापित सूचनाएँ दिखाते हैं; नई घोषणाओं के लिए आधिकारिक भर्ती वेबसाइटें भी देखें।",
    deadline: "अंतिम तारीख",
    qualification: "योग्यता",
    location: "स्थान",
    official: "आधिकारिक सूचना",
    apply: "आवेदन वेबसाइट",
    details: "भर्ती की जानकारी",
    verified: "सत्यापित",
    matchNotice: "यह केवल प्रारंभिक मिलान है। आधिकारिक सूचना में पात्रता और सभी तारीख़ें जाँचें।",
    count: "खुली सत्यापित सूचनाएँ",
    explore: "सभी भर्तियाँ देखें",
    heroEyebrow: "सरकारी भर्तियाँ, अब समझना आसान",
    heroTitle: "अगली सरकारी नौकरी खोजें—पूरी जानकारी के साथ।",
    heroDescription:
      "सत्यापित सूचनाएँ देखें, तारीख़ें और योग्यता समझें, आवेदन की स्थिति सँभालें—आधिकारिक सूचना के सीधे लिंक के साथ।",
    createProfile: "अलर्ट प्रोफ़ाइल बनाएँ",
    howItWorks: "अवसरों पर नज़र रखने का आसान तरीका",
    howDescription:
      "ज़रूरी जानकारी आधिकारिक सूचना से जुड़ी रहती है, ताकि आप स्रोत देखकर खुद फैसला कर सकें।",
    steps: [
      ["सत्यापित सूचना देखें", "अंतिम तारीख़, योग्यता और आधिकारिक स्रोत एक जगह देखें।"],
      ["मिलान समझें", "प्रोफ़ाइल और भर्ती नियमों पर आधारित स्पष्ट जाँच सूची देखें।"],
      ["अगला कदम दर्ज करें", "आवेदन की स्थिति सँभालें और चाहें तो अलर्ट चुनें।"],
    ],
    trust: "ज़रूरी जानकारी",
    trustBody:
      "प्रारंभिक मिलान पात्रता का फैसला नहीं है। भर्ती संस्था की आधिकारिक सूचना ही अंतिम है। कवरेज सीमित है और अभी कोई स्वचालित स्रोत चालू नहीं है।",
    seeCoverage: "कवरेज की जानकारी",
    disclaimer: "हम स्वतंत्र सेवा हैं और किसी सरकारी विभाग से संबद्ध नहीं हैं।",
  },
} as const;

const qualifications = [
  "secondary",
  "higher_secondary",
  "diploma",
  "iti",
  "undergraduate",
  "postgraduate",
  "doctoral",
];

function formatDate(value: string, language: "en" | "hi") {
  return new Intl.DateTimeFormat(language === "hi" ? "hi-IN" : "en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(`${value.slice(0, 10)}T00:00:00`));
}

function PublicVacancyList({ limit }: { limit?: number }) {
  const { i18n } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const language = i18n.resolvedLanguage?.startsWith("hi") ? "hi" : "en";
  const text = copy[language];
  const [vacancies, setVacancies] = useState<PublicVacancy[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState(() => searchParams.get("q") ?? "");
  const [qualification, setQualification] = useState(() => searchParams.get("qualification") ?? "");
  const [state, setState] = useState(() => searchParams.get("state") ?? "");
  const [organization, setOrganization] = useState(() => searchParams.get("organization") ?? "");

  useEffect(() => {
    setSearch(searchParams.get("q") ?? "");
    setQualification(searchParams.get("qualification") ?? "");
    setState(searchParams.get("state") ?? "");
    setOrganization(searchParams.get("organization") ?? "");
  }, [searchParams]);

  const loadVacancies = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const result = await fetchPublicVacancies();
      setVacancies(result.vacancies);
    } catch (loadError) {
      setError(loadError instanceof TypeError ? text.apiUnavailable : text.errorTitle);
    } finally {
      setLoading(false);
    }
  }, [text.apiUnavailable, text.errorTitle]);

  useEffect(() => {
    void loadVacancies();
  }, [loadVacancies]);

  const states = useMemo(
    () => [...new Set(vacancies.map((vacancy) => vacancy.location_state).filter(Boolean))].sort(),
    [vacancies],
  );
  const organizations = useMemo(
    () => [...new Set(vacancies.map((vacancy) => vacancy.recruiting_organization))].sort(),
    [vacancies],
  );
  const filtered = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    return vacancies.filter((vacancy) => {
      const searchable = [
        vacancy.title,
        vacancy.recruiting_organization,
        vacancy.location_state ?? "",
        vacancy.qualification_level ?? "",
        ...vacancy.allowed_disciplines,
      ]
        .join(" ")
        .toLocaleLowerCase();
      return (
        (!query || searchable.includes(query)) &&
        (!qualification || vacancy.qualification_level === qualification) &&
        (!state || vacancy.location_state === state) &&
        (!organization || vacancy.recruiting_organization === organization)
      );
    });
  }, [qualification, search, state, organization, vacancies]);
  const visible = limit ? filtered.slice(0, limit) : filtered;

  return (
    <div>
      <form
        className="mb-5 grid gap-3 rounded-2xl border border-line bg-white p-3 shadow-card md:grid-cols-[minmax(0,1fr)_170px_180px_190px_auto]"
        onSubmit={(event) => {
          event.preventDefault();
          const next = new URLSearchParams();
          if (search.trim()) next.set("q", search.trim());
          if (qualification) next.set("qualification", qualification);
          if (state) next.set("state", state);
          if (organization) next.set("organization", organization);
          setSearchParams(next);
        }}
        role="search"
      >
        <label className="flex min-w-0 items-center gap-2 rounded-xl border border-line px-3 focus-within:border-forest focus-within:ring-2 focus-within:ring-forest/15">
          <Search size={18} className="shrink-0 text-muted" aria-hidden="true" />
          <span className="sr-only">{text.search}</span>
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={text.search}
            className="w-full border-0 bg-transparent py-3 text-sm outline-none"
          />
        </label>
        <label className="sr-only" htmlFor="vacancy-qualification">
          {text.allQualifications}
        </label>
        <select
          id="vacancy-qualification"
          value={qualification}
          onChange={(event) => setQualification(event.target.value)}
          className="rounded-xl border border-line bg-white px-3 py-3 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-forest/25"
        >
          <option value="">{text.allQualifications}</option>
          {qualifications.map((level) => (
            <option value={level} key={level}>
              {level.replace(/_/g, " ")}
            </option>
          ))}
        </select>
        <label className="sr-only" htmlFor="vacancy-organization">
          {text.allRecruitingBodies}
        </label>
        <select
          id="vacancy-organization"
          value={organization}
          onChange={(event) => setOrganization(event.target.value)}
          className="rounded-xl border border-line bg-white px-3 py-3 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-forest/25"
        >
          <option value="">{text.allRecruitingBodies}</option>
          {organizations.map((option) => (
            <option value={option} key={option}>
              {option}
            </option>
          ))}
        </select>
        <label className="sr-only" htmlFor="vacancy-state">
          {text.allStates}
        </label>
        <select
          id="vacancy-state"
          value={state}
          onChange={(event) => setState(event.target.value)}
          className="rounded-xl border border-line bg-white px-3 py-3 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-forest/25"
        >
          <option value="">{text.allStates}</option>
          {states.map((option) => (
            <option value={option ?? ""} key={option}>
              {option}
            </option>
          ))}
        </select>
        <button
          type="submit"
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-forest px-5 py-3 text-sm font-semibold text-white hover:bg-forest-dark focus:outline-none focus-visible:ring-2 focus-visible:ring-forest focus-visible:ring-offset-2"
        >
          <Search size={16} aria-hidden="true" />
          {text.searchButton}
        </button>
      </form>

      {loading ? (
        <div className="grid gap-4 md:grid-cols-2">
          {[0, 1, 2, 3].slice(0, limit ? 2 : 4).map((item) => (
            <div
              key={item}
              className="h-52 animate-pulse rounded-2xl border border-line bg-white p-5"
              aria-label={text.loading}
            >
              <div className="h-4 w-2/3 rounded bg-canvas" />
              <div className="mt-4 h-3 w-1/2 rounded bg-canvas" />
              <div className="mt-8 h-10 rounded bg-canvas" />
            </div>
          ))}
        </div>
      ) : error ? (
        <div className="rounded-2xl border border-[#f1d4d0] bg-[#fff5f3] p-6 text-center">
          <p className="font-semibold text-[#98483e]">{error}</p>
          <button
            type="button"
            onClick={() => void loadVacancies()}
            className="mt-3 rounded-lg border border-[#e9c2bc] px-4 py-2 text-sm font-semibold text-[#98483e] hover:bg-white"
          >
            {text.retry}
          </button>
        </div>
      ) : visible.length === 0 ? (
        <div className="rounded-2xl border border-line bg-white px-6 py-10 text-center shadow-card sm:px-10">
          <span className="mx-auto grid size-12 place-items-center rounded-2xl bg-mint text-forest">
            <BriefcaseBusiness size={23} aria-hidden="true" />
          </span>
          <h3 className="mt-4 text-lg font-bold text-ink">{text.emptyTitle}</h3>
          <p className="mx-auto mt-2 max-w-2xl text-sm leading-6 text-muted">{text.emptyBody}</p>
          <a
            href="https://www.ncs.gov.in/"
            target="_blank"
            rel="noreferrer"
            className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-forest underline underline-offset-4"
          >
            {language === "hi" ? "राष्ट्रीय करियर सेवा देखें" : "Visit National Career Service"}
            <ArrowUpRight size={15} aria-hidden="true" />
          </a>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {visible.map((vacancy) => (
            <article
              key={vacancy.id}
              className="flex flex-col rounded-2xl border border-line bg-white p-5 shadow-card transition hover:-translate-y-0.5 hover:border-[#cad9ce] hover:shadow-lg"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs font-semibold uppercase tracking-wide text-forest">
                    {vacancy.recruiting_organization}
                  </p>
                  <h3 className="mt-2 text-lg font-bold leading-snug text-ink">{vacancy.title}</h3>
                </div>
                <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-mint px-2.5 py-1 text-[11px] font-semibold text-forest">
                  <CheckCircle2 size={13} aria-hidden="true" />
                  {text.verified}
                </span>
              </div>
              <div className="mt-4 grid gap-2 text-xs text-muted sm:grid-cols-2">
                <span className="flex items-center gap-2">
                  <CalendarDays size={15} aria-hidden="true" />
                  {text.deadline}:{" "}
                  <strong className="text-ink">{formatDate(vacancy.deadline, language)}</strong>
                </span>
                {vacancy.qualification_level && (
                  <span className="flex items-center gap-2">
                    <GraduationCap size={15} aria-hidden="true" />
                    {text.qualification}:{" "}
                    <strong className="capitalize text-ink">
                      {vacancy.qualification_level.replace(/_/g, " ")}
                    </strong>
                  </span>
                )}
                {vacancy.location_state && (
                  <span className="flex items-center gap-2">
                    <MapPin size={15} aria-hidden="true" />
                    {text.location}: <strong className="text-ink">{vacancy.location_state}</strong>
                  </span>
                )}
              </div>
              <p className="mt-4 flex items-start gap-2 rounded-lg bg-canvas p-3 text-xs leading-5 text-muted">
                <ShieldCheck size={15} className="mt-0.5 shrink-0 text-forest" aria-hidden="true" />
                {text.matchNotice}
              </p>
              <div className="mt-auto flex flex-wrap gap-2 pt-4">
                <Link
                  to={`/jobs/${encodeURIComponent(vacancy.id)}`}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-forest px-3 py-2 text-xs font-semibold text-white hover:bg-forest-dark focus:outline-none focus-visible:ring-2 focus-visible:ring-forest"
                >
                  {text.details}
                  <ArrowRight size={14} aria-hidden="true" />
                </Link>
                <a
                  href={vacancy.official_source_url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-lg border border-line px-3 py-2 text-xs font-semibold text-ink hover:bg-canvas focus:outline-none focus-visible:ring-2 focus-visible:ring-forest"
                >
                  {text.official}
                  <ArrowUpRight size={14} aria-hidden="true" />
                </a>
                <a
                  href={vacancy.application_url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-lg bg-forest px-3 py-2 text-xs font-semibold text-white hover:bg-forest-dark focus:outline-none focus-visible:ring-2 focus-visible:ring-forest"
                >
                  {text.apply}
                  <ArrowUpRight size={14} aria-hidden="true" />
                </a>
              </div>
              <p className="mt-3 text-[11px] text-muted">
                {text.verified}: {formatDate(vacancy.last_verified_at, language)}
              </p>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}

export function PublicVacancySection({ limit = 6 }: { limit?: number }) {
  const { i18n } = useTranslation();
  const language = i18n.resolvedLanguage?.startsWith("hi") ? "hi" : "en";
  const text = copy[language];
  return (
    <section
      id="latest-vacancies"
      className="scroll-mt-24"
      aria-labelledby="latest-vacancies-title"
    >
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-forest">{text.count}</p>
          <h2
            id="latest-vacancies-title"
            className="mt-2 text-2xl font-bold tracking-tight text-ink"
          >
            {text.jobs}
          </h2>
          <p className="mt-1 text-sm text-muted">{text.subtitle}</p>
        </div>
        <Link
          to="/jobs"
          className="inline-flex items-center gap-2 rounded-lg border border-line bg-white px-3.5 py-2.5 text-sm font-semibold text-forest hover:bg-mint"
        >
          {text.explore}
          <ArrowRight size={16} aria-hidden="true" />
        </Link>
      </div>
      <PublicVacancyList limit={limit} />
    </section>
  );
}

export function PublicVacanciesPage() {
  const { i18n } = useTranslation();
  const language = i18n.resolvedLanguage?.startsWith("hi") ? "hi" : "en";
  const text = copy[language];
  return (
    <div className="min-h-screen bg-canvas text-ink">
      <SiteHeader />
      <main className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <section className="mb-8 rounded-3xl bg-forest p-6 text-white sm:p-10">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-white/70">
            {text.heroEyebrow}
          </p>
          <h1 className="mt-3 max-w-3xl text-3xl font-bold leading-tight tracking-tight sm:text-4xl">
            {text.jobs}
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-white/80">{text.subtitle}</p>
        </section>
        <PublicVacancyList />
      </main>
      <footer className="border-t border-line bg-white py-6 text-center text-xs text-muted">
        {text.disclaimer}{" "}
        <Link to="/about" className="font-semibold text-forest underline underline-offset-2">
          {text.seeCoverage}
        </Link>
      </footer>
    </div>
  );
}
