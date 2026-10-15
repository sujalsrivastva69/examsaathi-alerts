import { lazy, Suspense, useEffect } from "react";
import { NavLink, Navigate, Route, Routes, useLocation } from "react-router-dom";
import {
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  CircleHelp,
  Clock3,
  FileCheck2,
  GraduationCap,
  Search,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { useAuth } from "./auth/AuthProvider";
import { SiteHeader } from "./components/SiteHeader";
import { localViewMode } from "./lib/local-view-mode";
import {
  ForgotPasswordPage,
  LoginPage,
  ResetPasswordPage,
  SignupPage,
  VerifyEmailPage,
} from "./auth/AuthPages";
import { ProfileWizard } from "./profile/ProfileWizard";
import type { Language } from "./i18n";

const AdminVacancies = lazy(() =>
  import("./admin/AdminVacancies").then((module) => ({ default: module.AdminVacancies })),
);
const AdminReviewQueue = lazy(() =>
  import("./admin/AdminReviewQueue").then((module) => ({ default: module.AdminReviewQueue })),
);
const AdminNotifications = lazy(() =>
  import("./admin/AdminNotifications").then((module) => ({ default: module.AdminNotifications })),
);
const CandidateDashboard = lazy(() =>
  import("./candidate/CandidateDashboard").then((module) => ({
    default: module.CandidateDashboard,
  })),
);
const VacancyDetail = lazy(() =>
  import("./candidate/VacancyDetail").then((module) => ({ default: module.VacancyDetail })),
);
const NotificationSettings = lazy(() =>
  import("./candidate/NotificationSettings").then((module) => ({
    default: module.NotificationSettings,
  })),
);
const BetaFeedback = lazy(() =>
  import("./candidate/BetaFeedback").then((module) => ({ default: module.BetaFeedback })),
);
const PublicPage = lazy(() =>
  import("./public/PublicPages").then((module) => ({ default: module.PublicPage })),
);
const PublicVacancySection = lazy(() =>
  import("./public/PublicVacancies").then((module) => ({
    default: module.PublicVacancySection,
  })),
);
const PublicVacanciesPage = lazy(() =>
  import("./public/PublicVacancies").then((module) => ({
    default: module.PublicVacanciesPage,
  })),
);
const PublicVacancyDetail = lazy(() =>
  import("./public/PublicVacancyDetail").then((module) => ({
    default: module.PublicVacancyDetail,
  })),
);
const PublicCalendar = lazy(() =>
  import("./public/PublicCalendar").then((module) => ({ default: module.PublicCalendar })),
);
const PreparationPage = lazy(() =>
  import("./public/PreparationPage").then((module) => ({ default: module.PreparationPage })),
);
const ToolsIndexPage = lazy(() =>
  import("./tools/ToolsPages").then((module) => ({ default: module.ToolsIndexPage })),
);
const PhotoResizerPage = lazy(() =>
  import("./tools/ToolsPages").then((module) => ({ default: module.PhotoResizerPage })),
);
const AgeCalculatorPage = lazy(() =>
  import("./tools/ToolsPages").then((module) => ({ default: module.AgeCalculatorPage })),
);
const SalaryEstimatorPage = lazy(() =>
  import("./tools/ToolsPages").then((module) => ({ default: module.SalaryEstimatorPage })),
);
const DocumentChecklistPage = lazy(() =>
  import("./tools/ToolsPages").then((module) => ({ default: module.DocumentChecklistPage })),
);
const FeeCalculatorPage = lazy(() =>
  import("./tools/ToolsPages").then((module) => ({ default: module.FeeCalculatorPage })),
);

const statusKeys = [
  ["preliminaryMatch", "bg-[#e8f1eb] text-[#285b46]"],
  ["needsReview", "bg-[#fff3df] text-[#8a571b]"],
  ["notMatched", "bg-[#f1f2f1] text-[#59655e]"],
  ["expired", "bg-[#f7e9e8] text-[#98483e]"],
  ["underVerification", "bg-[#eaf0f6] text-[#416281]"],
] as const;

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (localViewMode) {
    return <Navigate to="/" replace />;
  }

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center text-muted">Loading…</div>;
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  return <>{children}</>;
}

function AppShell() {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const language: Language = i18n.resolvedLanguage?.startsWith("hi") ? "hi" : "en";

  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);

  return (
    <div className="min-h-screen bg-canvas text-ink">
      <SiteHeader />

      <main id="home" className="mx-auto max-w-7xl px-4 pb-12 pt-8 sm:px-6 sm:pt-10 lg:px-8">
        <section
          className="relative mb-8 overflow-hidden rounded-[28px] bg-forest px-6 py-8 text-white shadow-card sm:px-10 sm:py-12 lg:px-14"
          aria-labelledby="welcome-heading"
        >
          <div className="pointer-events-none absolute -right-24 -top-36 size-[28rem] rounded-full border border-white/10" />
          <div className="pointer-events-none absolute -right-8 -top-20 size-[21rem] rounded-full border border-white/10" />
          <div className="relative grid items-center gap-8 lg:grid-cols-[minmax(0,1fr)_300px]">
            <div className="max-w-3xl">
              <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-semibold text-white">
                <span className="size-1.5 rounded-full bg-[#b9e2c4]" />
                {t("homeTagline")}
              </div>
              <h1
                id="welcome-heading"
                className="text-3xl font-bold leading-tight tracking-[-0.035em] sm:text-5xl"
              >
                {language === "hi"
                  ? "सरकारी नौकरी की तलाश, अब थोड़ी आसान।"
                  : "Your government job search, a little clearer."}
              </h1>
              <p className="mt-4 max-w-2xl text-sm leading-7 text-white/80 sm:text-base">
                {language === "hi"
                  ? "भर्ती सूचनाएँ खोजें, ज़रूरी तारीख़ें समझें और आधिकारिक स्रोत से खुद पुष्टि करें।"
                  : "Find recruitment notices, understand key dates, and verify every detail at the official source."}
              </p>
              <form
                action="/jobs"
                method="get"
                role="search"
                className="mt-6 flex max-w-2xl flex-col gap-2 rounded-2xl bg-white p-2 sm:flex-row"
              >
                <label className="flex min-w-0 flex-1 items-center gap-2 rounded-xl px-3 text-forest focus-within:ring-2 focus-within:ring-forest/30">
                  <Search size={18} aria-hidden="true" />
                  <span className="sr-only">
                    {language === "hi" ? "पद या विभाग खोजें" : "Search post or department"}
                  </span>
                  <input
                    type="search"
                    name="q"
                    placeholder={
                      language === "hi"
                        ? "पद, विभाग या योग्यता खोजें"
                        : "Search post, department, or qualification"
                    }
                    className="min-h-11 w-full bg-transparent text-sm text-ink outline-none placeholder:text-muted"
                  />
                </label>
                <button
                  type="submit"
                  className="min-h-11 rounded-xl bg-forest px-5 text-sm font-bold text-white hover:bg-forest-dark focus:outline-none focus-visible:ring-2 focus-visible:ring-forest focus-visible:ring-offset-2"
                >
                  {language === "hi" ? "भर्ती खोजें" : "Search vacancies"}
                </button>
              </form>
              <div className="mt-6 flex flex-wrap gap-3">
                <NavLink
                  to="/jobs"
                  className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-3 text-sm font-bold text-forest hover:bg-[#f0f5f1] focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-forest"
                >
                  <Search size={17} aria-hidden="true" />
                  {language === "hi" ? "खुली भर्तियाँ खोजें" : "Explore open vacancies"}
                </NavLink>
                <NavLink
                  to={localViewMode ? "/jobs" : user ? "/profile/setup" : "/signup"}
                  className="inline-flex items-center gap-2 rounded-xl border border-white/25 bg-white/10 px-4 py-3 text-sm font-semibold text-white hover:bg-white/15 focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
                >
                  <UserRound size={17} aria-hidden="true" />
                  {localViewMode
                    ? language === "hi"
                      ? "सत्यापित भर्तियाँ देखें"
                      : "Browse verified vacancies"
                    : language === "hi"
                      ? "अपना अलर्ट प्रोफ़ाइल बनाएँ"
                      : "Create your alert profile"}
                </NavLink>
                <NavLink
                  to="/tools"
                  className="inline-flex items-center gap-2 rounded-xl border border-white/25 bg-white/10 px-4 py-3 text-sm font-semibold text-white hover:bg-white/15 focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
                >
                  {language === "hi" ? "आवेदन के मुफ़्त टूल" : "Free application tools"}
                </NavLink>
              </div>
              <div className="mt-7 flex flex-wrap gap-x-5 gap-y-2 border-t border-white/15 pt-5 text-xs font-medium text-white/75">
                <span className="inline-flex items-center gap-2">
                  <ShieldCheck size={15} aria-hidden="true" />
                  {language === "hi" ? "आधिकारिक स्रोत के लिंक" : "Official-source links"}
                </span>
                <span className="inline-flex items-center gap-2">
                  <GraduationCap size={16} aria-hidden="true" />
                  {language === "hi" ? "समझने योग्य योग्यता नियम" : "Clear eligibility criteria"}
                </span>
                <span className="inline-flex items-center gap-2">
                  <CheckCircle2 size={15} aria-hidden="true" />
                  {language === "hi" ? "हिंदी और English" : "Hindi and English"}
                </span>
              </div>
            </div>
            <div className="relative rounded-2xl border border-white/15 bg-white/10 p-5 backdrop-blur-sm">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-white/65">
                {language === "hi" ? "हमारा वादा" : "Our promise"}
              </p>
              <p className="mt-3 text-lg font-semibold leading-7">
                {language === "hi"
                  ? "कोई भी मिलान पात्रता की गारंटी नहीं है।"
                  : "A match is never a promise of eligibility."}
              </p>
              <p className="mt-2 text-sm leading-6 text-white/75">
                {language === "hi"
                  ? "हर सूचना को आधिकारिक नोटिस में जाँचें।"
                  : "Always confirm requirements in the official notification."}
              </p>
              <NavLink
                to="/about"
                className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-white underline underline-offset-4 hover:text-white/80"
              >
                {language === "hi" ? "सेवा के बारे में" : "How the service works"}
                <ArrowRight size={15} aria-hidden="true" />
              </NavLink>
            </div>
          </div>
        </section>

        <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="space-y-6">
            <section
              id="profile"
              className="relative overflow-hidden rounded-2xl bg-forest p-5 text-white shadow-card sm:p-7"
              aria-labelledby="profile-heading"
            >
              <div className="pointer-events-none absolute -right-8 -top-20 size-64 rounded-full border border-white/10" />
              <div className="pointer-events-none absolute -right-2 -top-14 size-48 rounded-full border border-white/10" />
              <div className="relative flex flex-col justify-between gap-5 sm:flex-row sm:items-center">
                <div className="max-w-xl">
                  <div className="mb-3 flex size-10 items-center justify-center rounded-xl bg-white/12">
                    <UserRound size={20} />
                  </div>
                  <h2 id="profile-heading" className="text-xl font-semibold tracking-tight">
                    {t("profileTitle")}
                  </h2>
                  <p className="mt-2 text-sm leading-6 text-white/75">{t("profileBody")}</p>
                </div>
                <NavLink
                  to={localViewMode ? "/jobs" : "/profile/setup"}
                  className="inline-flex shrink-0 items-center justify-center gap-2 self-start rounded-lg bg-white px-4 py-2.5 text-sm font-semibold text-forest transition hover:bg-[#f0f5f1] focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-forest sm:self-center"
                >
                  {localViewMode
                    ? language === "hi"
                      ? "भर्तियाँ देखें"
                      : "Browse vacancies"
                    : t("setupProfile")}
                  <ArrowRight size={16} />
                </NavLink>
              </div>
              <div className="relative mt-5 flex items-center gap-2 border-t border-white/15 pt-4 text-xs text-white/70">
                <ShieldCheck size={15} />
                {t("profilePrivacyNote")}
              </div>
            </section>

            <Suspense fallback={<div className="h-80 animate-pulse rounded-2xl bg-white" />}>
              <PublicVacancySection />
            </Suspense>
          </div>

          <aside className="space-y-4" aria-label={t("howMatchesWork")}>
            <section className="rounded-2xl border border-line bg-white p-5 shadow-card">
              <div className="flex items-start gap-3">
                <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-mint text-forest">
                  <FileCheck2 size={18} />
                </span>
                <div>
                  <h2 className="text-sm font-semibold">{t("howMatchesWork")}</h2>
                  <p className="mt-1.5 text-xs leading-5 text-muted">{t("matchNote")}</p>
                </div>
              </div>
            </section>

            <section className="rounded-2xl border border-line bg-white p-5 shadow-card">
              <div className="flex items-start gap-3">
                <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-[#fff3df] text-saffron">
                  <CheckCircle2 size={18} />
                </span>
                <div>
                  <h2 className="text-sm font-semibold">{t("verifiedTitle")}</h2>
                  <p className="mt-1.5 text-xs leading-5 text-muted">{t("verifiedBody")}</p>
                </div>
              </div>
            </section>

            <section className="rounded-2xl border border-line bg-white p-5 shadow-card">
              <div className="flex items-start gap-3">
                <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-[#edf1f7] text-[#527194]">
                  <ShieldCheck size={18} />
                </span>
                <div>
                  <h2 className="text-sm font-semibold">{t("privateTitle")}</h2>
                  <p className="mt-1.5 text-xs leading-5 text-muted">{t("privateBody")}</p>
                </div>
              </div>
            </section>

            <section className="rounded-2xl border border-line bg-white p-5 shadow-card">
              <h2 className="mb-3 text-sm font-semibold">{t("statusTitle")}</h2>
              <ul className="space-y-2">
                {statusKeys.map(([key, color]) => (
                  <li key={key} className="flex items-center justify-between gap-2">
                    <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${color}`}>
                      {t(key)}
                    </span>
                    {key === "preliminaryMatch" && (
                      <span className="text-[10px] text-muted">
                        <Clock3 size={12} className="mr-1 inline-block align-[-2px]" />
                        {t("statusNotFinal")}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </section>

            <NavLink
              to="/about"
              className="flex items-center gap-3 rounded-2xl border border-line bg-white p-4 text-sm font-medium text-muted shadow-card transition hover:text-forest"
            >
              <CircleHelp size={18} />
              {t("aboutCoverage")}
              <ArrowRight size={15} className="ml-auto" />
            </NavLink>
          </aside>
        </div>

        <section className="mt-12" aria-labelledby="steps-heading">
          <div className="mx-auto mb-6 max-w-2xl text-center">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-forest">
              {language === "hi" ? "कैसे काम करता है" : "How it works"}
            </p>
            <h2 id="steps-heading" className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">
              {language === "hi"
                ? "खोज से आवेदन तक, हर कदम पर स्पष्टता"
                : "Clarity from discovery to application"}
            </h2>
            <p className="mt-2 text-sm leading-6 text-muted">
              {language === "hi"
                ? "ज़रूरी जानकारी, बिना पात्रता का झूठा वादा किए।"
                : "Useful information, without pretending to make the eligibility decision."}
            </p>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            {[
              {
                icon: Search,
                title: language === "hi" ? "भर्ती खोजें" : "Discover vacancies",
                body:
                  language === "hi"
                    ? "पद, योग्यता और अंतिम तारीख़ देखकर खुली सूचनाएँ छाँटें।"
                    : "Browse open notices by role, qualification and deadline.",
              },
              {
                icon: FileCheck2,
                title: language === "hi" ? "नियम समझें" : "Review the criteria",
                body:
                  language === "hi"
                    ? "आयु कटऑफ़ तारीख़ और नियमों के साथ पारदर्शी प्रारंभिक मिलान देखें।"
                    : "See a transparent preliminary match with the notice's age cutoff and rules.",
              },
              {
                icon: CalendarDays,
                title: language === "hi" ? "आवेदन सँभालें" : "Stay on top of dates",
                body:
                  language === "hi"
                    ? "आवेदन की स्थिति दर्ज करें और सहमति से रिमाइंडर पाएँ।"
                    : "Track application progress and choose whether to receive reminders.",
              },
            ].map(({ icon: Icon, title, body }, index) => (
              <article
                key={title}
                className="rounded-2xl border border-line bg-white p-5 shadow-card"
              >
                <span className="grid size-10 place-items-center rounded-xl bg-mint text-forest">
                  <Icon size={19} aria-hidden="true" />
                </span>
                <p className="mt-4 text-xs font-bold uppercase tracking-wider text-muted">
                  {language === "hi" ? `कदम ${index + 1}` : `Step ${index + 1}`}
                </p>
                <h3 className="mt-1 font-bold">{title}</h3>
                <p className="mt-2 text-sm leading-6 text-muted">{body}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="mt-8 grid gap-5 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="rounded-2xl border border-line bg-white p-6 shadow-card sm:p-8">
            <h2 className="text-xl font-bold">
              {language === "hi"
                ? "सरकारी भर्ती की ज़रूरी जानकारी एक जगह"
                : "The details that matter, together"}
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">
              {language === "hi"
                ? "सूचना का आधिकारिक लिंक, आवेदन की तारीख़ें, योग्यता और आयु-कटऑफ़ देखें। आवेदन करने से पहले भर्ती संस्था के नोटिस से हर बात की पुष्टि करें।"
                : "Review the official notice, application dates, qualification rules and age cutoff together. Confirm every requirement with the recruiting authority before applying."}
            </p>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              {[
                language === "hi"
                  ? "आधिकारिक नोटिस और आवेदन लिंक"
                  : "Official notice and application links",
                language === "hi"
                  ? "अंतिम तारीख़ और तारीख़ बढ़ने की जानकारी"
                  : "Deadlines and deadline-change history",
                language === "hi" ? "योग्यता और आयु के नियम" : "Qualification and age rules",
                language === "hi" ? "आवेदन स्थिति ट्रैकर" : "Application status tracker",
              ].map((item) => (
                <p key={item} className="flex items-start gap-2 text-sm text-muted">
                  <CheckCircle2
                    size={16}
                    className="mt-0.5 shrink-0 text-forest"
                    aria-hidden="true"
                  />
                  {item}
                </p>
              ))}
            </div>
            <NavLink
              to="/jobs"
              className="mt-6 inline-flex items-center gap-2 text-sm font-bold text-forest hover:underline"
            >
              {language === "hi" ? "सभी सत्यापित भर्तियाँ देखें" : "Browse verified vacancies"}
              <ArrowRight size={16} aria-hidden="true" />
            </NavLink>
          </div>
          <div className="rounded-2xl border border-[#ead8bf] bg-[#fff8ed] p-6 sm:p-8">
            <span className="grid size-10 place-items-center rounded-xl bg-white text-saffron">
              <ShieldCheck size={19} aria-hidden="true" />
            </span>
            <h2 className="mt-4 text-lg font-bold">
              {language === "hi"
                ? "स्रोत जाँचें, फैसला खुद करें"
                : "Check the source. Decide for yourself."}
            </h2>
            <p className="mt-2 text-sm leading-6 text-muted">
              {language === "hi"
                ? "ExamSaathi Alerts किसी सरकारी विभाग से संबद्ध नहीं है। प्रारंभिक मिलान पात्रता की गारंटी नहीं है; आधिकारिक अधिसूचना ही अंतिम है।"
                : "ExamSaathi Alerts is independent, not a government website. A preliminary match never guarantees eligibility; the official notification is final."}
            </p>
            <NavLink
              to="/about"
              className="mt-5 inline-flex items-center gap-2 text-sm font-bold text-forest hover:underline"
            >
              {language === "hi" ? "कवरेज सीमाएँ पढ़ें" : "Read about coverage limits"}
              <ArrowRight size={16} aria-hidden="true" />
            </NavLink>
          </div>
        </section>

        <footer
          id="help"
          className="mt-8 border-t border-line pt-5 text-center text-xs leading-5 text-muted"
        >
          {t("footer")}
          <nav
            className="mt-3 flex flex-wrap justify-center gap-x-4 gap-y-2"
            aria-label={t("footerLinks")}
          >
            <NavLink to="/privacy" className="underline underline-offset-2 hover:text-forest">
              {t("privacyPolicy")}
            </NavLink>
            <NavLink to="/terms" className="underline underline-offset-2 hover:text-forest">
              {t("termsOfUse")}
            </NavLink>
            <NavLink to="/tools" className="underline underline-offset-2 hover:text-forest">
              {language === "hi" ? "मुफ़्त टूल" : "Free tools"}
            </NavLink>
            <NavLink to="/about" className="underline underline-offset-2 hover:text-forest">
              {t("aboutCoverage")}
            </NavLink>
            {user && (
              <NavLink to="/feedback" className="underline underline-offset-2 hover:text-forest">
                {t("feedbackTitle")}
              </NavLink>
            )}
          </nav>
        </footer>
      </main>
    </div>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<AppShell />} />
      <Route
        path="/jobs"
        element={
          <Suspense fallback={<div className="p-8 text-center text-muted">Loading…</div>}>
            <PublicVacanciesPage />
          </Suspense>
        }
      />
      <Route
        path="/jobs/:id"
        element={
          <Suspense fallback={<div className="p-8 text-center text-muted">Loading…</div>}>
            <PublicVacancyDetail />
          </Suspense>
        }
      />
      <Route
        path="/calendar"
        element={
          <Suspense fallback={<div className="p-8 text-center text-muted">Loading…</div>}>
            <PublicCalendar />
          </Suspense>
        }
      />
      <Route
        path="/preparation"
        element={
          <Suspense fallback={<div className="p-8 text-center text-muted">Loading…</div>}>
            <PreparationPage />
          </Suspense>
        }
      />
      <Route
        path="/tools"
        element={
          <Suspense fallback={<div className="p-8 text-center text-muted">Loading…</div>}>
            <ToolsIndexPage />
          </Suspense>
        }
      />
      <Route
        path="/tools/photo-resizer"
        element={
          <Suspense fallback={<div className="p-8 text-center text-muted">Loading…</div>}>
            <PhotoResizerPage />
          </Suspense>
        }
      />
      <Route
        path="/tools/age-calculator"
        element={
          <Suspense fallback={<div className="p-8 text-center text-muted">Loading…</div>}>
            <AgeCalculatorPage />
          </Suspense>
        }
      />
      <Route
        path="/tools/salary-estimator"
        element={
          <Suspense fallback={<div className="p-8 text-center text-muted">Loading…</div>}>
            <SalaryEstimatorPage />
          </Suspense>
        }
      />
      <Route
        path="/tools/document-checklist"
        element={
          <Suspense fallback={<div className="p-8 text-center text-muted">Loading…</div>}>
            <DocumentChecklistPage />
          </Suspense>
        }
      />
      <Route
        path="/tools/fee-calculator"
        element={
          <Suspense fallback={<div className="p-8 text-center text-muted">Loading…</div>}>
            <FeeCalculatorPage />
          </Suspense>
        }
      />
      <Route
        path="/signup"
        element={localViewMode ? <Navigate to="/" replace /> : <SignupPage />}
      />
      <Route path="/login" element={localViewMode ? <Navigate to="/" replace /> : <LoginPage />} />
      <Route
        path="/verify-email"
        element={localViewMode ? <Navigate to="/" replace /> : <VerifyEmailPage />}
      />
      <Route
        path="/forgot-password"
        element={localViewMode ? <Navigate to="/" replace /> : <ForgotPasswordPage />}
      />
      <Route
        path="/reset-password"
        element={localViewMode ? <Navigate to="/" replace /> : <ResetPasswordPage />}
      />
      <Route
        path="/privacy"
        element={
          <Suspense fallback={<div className="p-8 text-center text-muted">Loading…</div>}>
            <PublicPage />
          </Suspense>
        }
      />
      <Route
        path="/terms"
        element={
          <Suspense fallback={<div className="p-8 text-center text-muted">Loading…</div>}>
            <PublicPage />
          </Suspense>
        }
      />
      <Route
        path="/about"
        element={
          <Suspense fallback={<div className="p-8 text-center text-muted">Loading…</div>}>
            <PublicPage />
          </Suspense>
        }
      />
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <Suspense fallback={<div className="p-8 text-center text-muted">Loading…</div>}>
              <CandidateDashboard />
            </Suspense>
          </ProtectedRoute>
        }
      />
      <Route
        path="/matches/:id"
        element={
          <ProtectedRoute>
            <Suspense fallback={<div className="p-8 text-center text-muted">Loading…</div>}>
              <VacancyDetail />
            </Suspense>
          </ProtectedRoute>
        }
      />
      <Route
        path="/feedback"
        element={
          <ProtectedRoute>
            <Suspense fallback={<div className="p-8 text-center text-muted">Loading…</div>}>
              <BetaFeedback />
            </Suspense>
          </ProtectedRoute>
        }
      />
      <Route
        path="/notification-settings"
        element={
          <ProtectedRoute>
            <Suspense fallback={<div className="p-8 text-center text-muted">Loading…</div>}>
              <NotificationSettings />
            </Suspense>
          </ProtectedRoute>
        }
      />
      <Route
        path="/profile/setup"
        element={
          <ProtectedRoute>
            <ProfileWizard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin"
        element={
          <ProtectedRoute>
            <Suspense fallback={<div className="p-8 text-center text-muted">Loading…</div>}>
              <AdminVacancies />
            </Suspense>
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/review"
        element={
          <ProtectedRoute>
            <Suspense fallback={<div className="p-8 text-center text-muted">Loading…</div>}>
              <AdminReviewQueue />
            </Suspense>
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/notifications"
        element={
          <ProtectedRoute>
            <Suspense fallback={<div className="p-8 text-center text-muted">Loading…</div>}>
              <AdminNotifications />
            </Suspense>
          </ProtectedRoute>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
