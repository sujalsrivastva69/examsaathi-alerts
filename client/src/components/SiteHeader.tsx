import { useState } from "react";
import { BriefcaseBusiness, CalendarDays, Menu, X } from "lucide-react";
import { Link, NavLink, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "../auth/AuthProvider";
import { localViewMode } from "../lib/local-view-mode";

const linkClass = ({ isActive }: { isActive: boolean }) =>
  `rounded-lg px-3 py-2 text-sm font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-forest ${
    isActive ? "bg-mint text-forest" : "text-muted hover:bg-canvas hover:text-ink"
  }`;

export function SiteHeader() {
  const { i18n, t } = useTranslation();
  const { user } = useAuth();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const hindi = i18n.resolvedLanguage?.startsWith("hi") ?? false;

  function closeMenu() {
    setMenuOpen(false);
  }

  return (
    <header className="sticky top-0 z-20 border-b border-line bg-white/95 backdrop-blur">
      <div className="mx-auto flex min-h-[68px] max-w-7xl items-center justify-between gap-3 px-4 py-2 sm:px-6 lg:px-8">
        <Link
          to="/"
          onClick={closeMenu}
          className="flex shrink-0 items-center gap-2 rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-forest"
        >
          <span className="grid size-9 place-items-center rounded-xl bg-forest text-white">
            <BriefcaseBusiness size={19} aria-hidden="true" />
          </span>
          <span className="text-[16px] font-bold tracking-tight">
            {t("brand")}
            <span className="font-medium text-muted"> {t("brandSuffix")}</span>
          </span>
        </Link>

        <button
          type="button"
          aria-label={
            menuOpen
              ? hindi
                ? "मेन्यू बंद करें"
                : "Close menu"
              : hindi
                ? "मेन्यू खोलें"
                : "Open menu"
          }
          aria-expanded={menuOpen}
          aria-controls="primary-navigation"
          onClick={() => setMenuOpen((open) => !open)}
          className="grid size-10 place-items-center rounded-lg border border-line text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-forest md:hidden"
        >
          {menuOpen ? <X size={19} aria-hidden="true" /> : <Menu size={19} aria-hidden="true" />}
        </button>

        <nav
          id="primary-navigation"
          aria-label={hindi ? "मुख्य नेविगेशन" : "Main navigation"}
          className={`${menuOpen ? "flex" : "hidden"} absolute left-0 right-0 top-full flex-col gap-1 border-b border-line bg-white p-3 shadow-lg md:static md:flex md:flex-row md:items-center md:border-0 md:bg-transparent md:p-0 md:shadow-none`}
        >
          <NavLink to="/jobs" onClick={closeMenu} className={linkClass}>
            {hindi ? "भर्तियाँ देखें" : "Browse jobs"}
          </NavLink>
          <NavLink to="/calendar" onClick={closeMenu} className={linkClass}>
            <CalendarDays className="mr-1.5 inline-block size-4 align-[-3px]" aria-hidden="true" />
            {hindi ? "भर्ती कैलेंडर" : "Exam calendar"}
          </NavLink>
          <NavLink to="/preparation" onClick={closeMenu} className={linkClass}>
            {hindi ? "तैयारी" : "Preparation"}
          </NavLink>
          <NavLink
            to="/tools"
            onClick={closeMenu}
            className={({ isActive }) =>
              linkClass({ isActive: isActive || location.pathname.startsWith("/tools/") })
            }
          >
            {hindi ? "मुफ़्त टूल" : "Free tools"}
          </NavLink>
          {user && !localViewMode && (
            <NavLink to="/dashboard" onClick={closeMenu} className={linkClass}>
              {hindi ? "डैशबोर्ड" : "Dashboard"}
            </NavLink>
          )}
          <button
            type="button"
            onClick={() => void i18n.changeLanguage(hindi ? "en" : "hi")}
            className="min-h-10 rounded-lg px-3 py-2 text-left text-sm font-semibold text-forest hover:bg-mint focus:outline-none focus-visible:ring-2 focus-visible:ring-forest md:ml-1"
          >
            {t("language")}
          </button>
          {!localViewMode && (
            <Link
              to={user ? "/dashboard" : "/login"}
              onClick={closeMenu}
              className="mt-1 rounded-lg bg-forest px-4 py-2.5 text-center text-sm font-bold text-white hover:bg-forest-dark focus:outline-none focus-visible:ring-2 focus-visible:ring-forest md:ml-1 md:mt-0"
            >
              {user ? (hindi ? "मेरा डैशबोर्ड" : "My dashboard") : t("login")}
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}
