import { lazy, Suspense, useEffect } from "react";
import { NavLink, Navigate, Route, Routes, useLocation } from "react-router-dom";
import {
  ArrowRight,
  Bell,
  BriefcaseBusiness,
  CheckCircle2,
  CircleHelp,
  Clock3,
  FileCheck2,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { useAuth } from "./auth/AuthProvider";
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
      <header className="sticky top-0 z-10 border-b border-line bg-white/95 backdrop-blur">
        <div className="mx-auto flex min-h-[68px] max-w-7xl flex-wrap items-center justify-between gap-y-1 px-4 py-2 sm:px-6 lg:px-8">
          <NavLink
            to="/"
            className="order-1 flex items-center gap-2.5 rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-forest"
          >
            <span className="grid size-9 place-items-center rounded-xl bg-forest text-white">
              <BriefcaseBusiness size={19} strokeWidth={2.1} />
            </span>
            <span className="text-[17px] font-bold tracking-tight">
              {t("brand")}
              <span className="font-medium text-muted"> {t("brandSuffix")}</span>
            </span>
          </NavLink>

          <nav
            className="order-3 flex w-full flex-wrap items-center justify-center gap-1 md:order-2 md:w-auto"
            aria-label={t("mainNavigation")}
          >
            {user && (
              <NavLink
                to="/dashboard"
                className={({ isActive }) =>
                  `rounded-lg px-3.5 py-2 text-sm font-medium ${isActive ? "bg-mint text-forest" : "text-muted hover:bg-canvas hover:text-ink"}`
                }
              >
                {t("candidateMatches")}
              </NavLink>
            )}
            <NavLink
              to="/"
              className={({ isActive }) =>
                `rounded-lg px-3.5 py-2 text-sm font-medium ${isActive ? "bg-mint text-forest" : "text-muted hover:bg-canvas hover:text-ink"}`
              }
            >
              {t("alerts")}
            </NavLink>
            <NavLink
              to="/profile/setup"
              className={({ isActive }) =>
                `rounded-lg px-3.5 py-2 text-sm font-medium ${isActive ? "bg-mint text-forest" : "text-muted hover:bg-canvas hover:text-ink"}`
              }
            >
              {t("myProfile")}
            </NavLink>
            {user && (
              <NavLink
                to="/notification-settings"
                className={({ isActive }) =>
                  `rounded-lg px-3.5 py-2 text-sm font-medium ${isActive ? "bg-mint text-forest" : "text-muted hover:bg-canvas hover:text-ink"}`
                }
              >
                {t("candidateNotificationSettings")}
              </NavLink>
            )}
          </nav>

          <div className="order-2 flex items-center gap-2 md:order-3">
            <button
              type="button"
              onClick={() => void i18n.changeLanguage(language === "en" ? "hi" : "en")}
              className="rounded-lg px-3 py-2 text-sm font-semibold text-forest transition hover:bg-mint focus:outline-none focus-visible:ring-2 focus-visible:ring-forest"
            >
              {t("language")}
            </button>
            {user ? (
              <NavLink
                to="/dashboard"
                className="rounded-lg border border-line bg-white px-3 py-2 text-sm font-medium text-forest hover:bg-mint"
              >
                {t("candidateMatches")}
              </NavLink>
            ) : (
              <NavLink
                to="/login"
                className="rounded-lg border border-line bg-white px-3 py-2 text-sm font-medium text-muted hover:text-forest"
              >
                {t("login")}
              </NavLink>
            )}
          </div>
        </div>
      </header>

      <main id="home" className="mx-auto max-w-7xl px-4 pb-12 pt-8 sm:px-6 sm:pt-10 lg:px-8">
        <section className="mb-8 max-w-3xl" aria-labelledby="welcome-heading">
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-[#dce9df] bg-white px-3 py-1.5 text-xs font-semibold text-forest">
            <span className="size-1.5 rounded-full bg-[#4c956d]" />
            {t("homeTagline")}
          </div>
          <h1
            id="welcome-heading"
            className="text-3xl font-bold leading-tight tracking-[-0.035em] sm:text-[40px]"
          >
            {t("greeting")}
          </h1>
          <p className="mt-3 max-w-2xl text-[15px] leading-7 text-muted sm:text-base">
            {t("intro")}
          </p>
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
                  to="/profile/setup"
                  className="inline-flex shrink-0 items-center justify-center gap-2 self-start rounded-lg bg-white px-4 py-2.5 text-sm font-semibold text-forest transition hover:bg-[#f0f5f1] focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-forest sm:self-center"
                >
                  {t("setupProfile")}
                  <ArrowRight size={16} />
                </NavLink>
              </div>
              <div className="relative mt-5 flex items-center gap-2 border-t border-white/15 pt-4 text-xs text-white/70">
                <ShieldCheck size={15} />
                {t("comingSoon")}
              </div>
            </section>

            <section id="alerts" aria-labelledby="alerts-heading">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <h2 id="alerts-heading" className="text-lg font-bold tracking-tight">
                    {t("yourAlerts")}
                  </h2>
                  <p className="mt-1 text-sm text-muted">{t("alertFeedDescription")}</p>
                </div>
              </div>

              <div className="rounded-2xl border border-line bg-white px-5 py-10 text-center shadow-card sm:px-10 sm:py-14">
                <div className="mx-auto grid size-14 place-items-center rounded-2xl bg-mint text-forest">
                  <Bell size={24} strokeWidth={1.8} />
                </div>
                <h3 className="mt-5 text-lg font-semibold tracking-tight">{t("noAlertsTitle")}</h3>
                <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted">
                  {t("noAlertsBody")}
                </p>
                <NavLink
                  to="/signup"
                  className="mt-5 inline-flex items-center gap-2 rounded-lg bg-forest px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-forest-dark focus:outline-none focus-visible:ring-2 focus-visible:ring-forest focus-visible:ring-offset-2"
                >
                  {t("noAlertsAction")}
                  <ArrowRight size={16} />
                </NavLink>
              </div>
            </section>
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
              to="/signup"
              className="flex items-center gap-3 rounded-2xl border border-line bg-white p-4 text-sm font-medium text-muted shadow-card transition hover:text-forest"
            >
              <CircleHelp size={18} />
              {t("help")}
              <ArrowRight size={15} className="ml-auto" />
            </NavLink>
          </aside>
        </div>

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
      <Route path="/signup" element={<SignupPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/verify-email" element={<VerifyEmailPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />
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
