import { useEffect, type ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";
import { ChevronRight } from "lucide-react";
import { useTranslation } from "react-i18next";
import { toolCopy, type ToolLanguage } from "./tool-copy";
import { SiteHeader } from "../components/SiteHeader";

export type ToolPageId = "tools" | "photo" | "age" | "salary" | "documents" | "fees";

export function ToolLayout({
  pageId,
  title,
  description,
  children,
}: {
  pageId: ToolPageId;
  title: string;
  description: string;
  children: ReactNode;
}) {
  const { i18n } = useTranslation();
  const location = useLocation();
  const language: ToolLanguage = i18n.resolvedLanguage?.startsWith("hi") ? "hi" : "en";
  const text = toolCopy[language];

  useEffect(() => {
    const titles: Record<ToolPageId, string> = toolCopy[language].pageTitles;
    const descriptions: Record<ToolPageId, string> = toolCopy[language].pageDescriptions;
    document.title = titles[pageId];
    document.documentElement.lang = language;
    let descriptionTag = document.querySelector<HTMLMetaElement>('meta[name="description"]');
    if (!descriptionTag) {
      descriptionTag = document.createElement("meta");
      descriptionTag.name = "description";
      document.head.append(descriptionTag);
    }
    descriptionTag.content = descriptions[pageId];

    let canonical = document.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (!canonical) {
      canonical = document.createElement("link");
      canonical.rel = "canonical";
      document.head.append(canonical);
    }
    canonical.href = `${window.location.origin}${location.pathname}`;
  }, [language, location.pathname, pageId]);

  return (
    <div className="min-h-screen bg-canvas text-ink">
      <SiteHeader />

      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-9 lg:px-8">
        <nav
          aria-label={language === "en" ? "Breadcrumb" : "ब्रेडक्रम्ब"}
          className="mb-5 flex items-center gap-2 text-sm text-muted"
        >
          <Link to="/tools" className="hover:text-forest">
            {text.tools}
          </Link>
          {pageId !== "tools" && (
            <>
              <ChevronRight size={15} aria-hidden="true" />
              <span aria-current="page" className="font-medium text-ink">
                {title}
              </span>
            </>
          )}
        </nav>
        <header className="mb-6 max-w-3xl">
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">{title}</h1>
          <p className="mt-3 text-sm leading-6 text-muted sm:text-base">{description}</p>
        </header>
        {children}
      </main>

      <footer className="border-t border-line bg-white">
        <div className="mx-auto grid max-w-7xl gap-4 px-4 py-6 sm:px-6 md:grid-cols-[1fr_auto] lg:px-8">
          <div>
            <h2 className="text-sm font-bold">{text.officialGuidance}</h2>
            <p className="mt-1 max-w-3xl text-xs leading-5 text-muted">{text.guidanceText}</p>
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
            <Link to="/feedback" className="font-semibold text-forest underline underline-offset-2">
              {text.reportError}
            </Link>
            <span className="text-xs text-muted">{text.reportNote}</span>
            <Link to="/about" className="font-semibold text-forest underline underline-offset-2">
              {language === "en" ? "About and coverage" : "परिचय और कवरेज"}
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
