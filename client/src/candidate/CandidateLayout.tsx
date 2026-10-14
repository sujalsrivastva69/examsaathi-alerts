import { NavLink, Link } from "react-router-dom";
import { BriefcaseBusiness } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useAuth } from "../auth/AuthProvider";
import type { Language } from "../i18n";

export function CandidateLayout({ children }: { children: React.ReactNode }) {
  const { t, i18n } = useTranslation();
  const { signOut } = useAuth();
  const language: Language = i18n.resolvedLanguage?.startsWith("hi") ? "hi" : "en";
  const navClass = ({ isActive }: { isActive: boolean }) =>
    `rounded-lg px-3 py-2 text-sm font-semibold focus:outline-none focus-visible:ring-2 focus-visible:ring-forest ${isActive ? "bg-mint text-forest" : "text-muted hover:bg-canvas hover:text-ink"}`;

  return (
    <div className="min-h-screen bg-canvas text-ink">
      <header className="sticky top-0 z-10 border-b border-line bg-white/95 backdrop-blur">
        <div className="mx-auto flex min-h-[68px] max-w-7xl flex-wrap items-center justify-between gap-2 px-4 py-2 sm:px-6 lg:px-8">
          <Link
            to="/dashboard"
            className="flex items-center gap-2 rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-forest"
          >
            <span className="grid size-9 place-items-center rounded-xl bg-forest text-white">
              <BriefcaseBusiness size={19} />
            </span>
            <span className="font-bold">
              {t("brand")} <span className="font-medium text-muted">{t("brandSuffix")}</span>
            </span>
          </Link>
          <nav className="flex flex-wrap items-center gap-1" aria-label={t("mainNavigation")}>
            <NavLink to="/dashboard" className={navClass}>
              {t("candidateMatches")}
            </NavLink>
            <NavLink to="/notification-settings" className={navClass}>
              {t("candidateNotificationSettings")}
            </NavLink>
            <NavLink to="/feedback" className={navClass}>
              {t("feedbackTitle")}
            </NavLink>
            <NavLink to="/profile/setup" className={navClass}>
              {t("myProfile")}
            </NavLink>
            <button
              type="button"
              onClick={() => void i18n.changeLanguage(language === "en" ? "hi" : "en")}
              className="rounded-lg px-3 py-2 text-sm font-semibold text-forest hover:bg-mint focus:outline-none focus-visible:ring-2 focus-visible:ring-forest"
            >
              {t("language")}
            </button>
            <button
              type="button"
              onClick={() => void signOut()}
              className="rounded-lg px-3 py-2 text-sm font-semibold text-muted hover:bg-canvas hover:text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-forest"
            >
              {t("signOut")}
            </button>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-9 lg:px-8">{children}</main>
    </div>
  );
}
