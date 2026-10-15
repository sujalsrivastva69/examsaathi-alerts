import { ArrowRight, BookOpenCheck, FileCheck2, UserRound } from "lucide-react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { SiteHeader } from "../components/SiteHeader";

export function PreparationPage() {
  const { i18n } = useTranslation();
  const hindi = i18n.resolvedLanguage?.startsWith("hi") ?? false;
  const cards = [
    {
      icon: FileCheck2,
      title: hindi ? "पहले आधिकारिक सूचना पढ़ें" : "Start with the official notice",
      body: hindi
        ? "पात्रता, आयु कटऑफ़, शुल्क और तारीख़ें भर्ती संस्था की सूचना में जाँचें।"
        : "Check eligibility, age cutoff, fees, and dates in the recruiting authority’s notice.",
      to: "/jobs",
      action: hindi ? "सत्यापित भर्तियाँ देखें" : "Browse verified vacancies",
    },
    {
      icon: BookOpenCheck,
      title: hindi ? "आवेदन की तैयारी करें" : "Prepare your application",
      body: hindi
        ? "दस्तावेज़ों की निजी, प्रिंट करने योग्य सूची बनाएँ; फ़ाइलें अपलोड करने की ज़रूरत नहीं।"
        : "Make a private, printable document checklist. No files need to be uploaded.",
      to: "/tools/document-checklist",
      action: hindi ? "दस्तावेज़ सूची खोलें" : "Open document checklist",
    },
    {
      icon: UserRound,
      title: hindi ? "आवेदन की स्थिति सँभालें" : "Keep track of your application",
      body: hindi
        ? "अपनी प्रोफ़ाइल बनाएँ और उपलब्ध होने पर मिलान तथा आवेदन प्रगति देखें।"
        : "Create a profile to see preliminary matches and track application progress when available.",
      to: "/profile/setup",
      action: hindi ? "प्रोफ़ाइल खोलें" : "Open profile",
    },
  ];

  return (
    <div className="min-h-screen bg-canvas text-ink">
      <SiteHeader />
      <main className="mx-auto max-w-5xl px-4 py-7 sm:px-6 sm:py-10">
        <header className="rounded-3xl bg-forest p-6 text-white sm:p-9">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-white/70">
            {hindi ? "आवेदन के अगले कदम" : "Your application next steps"}
          </p>
          <h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
            {hindi ? "भर्ती की तैयारी, सही जानकारी से" : "Prepare with reliable information"}
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-white/80">
            {hindi
              ? "यहाँ आधिकारिक सूचना और आवेदन प्रक्रिया पर केंद्रित व्यावहारिक साधन हैं। अभी इस साइट पर पाठ्यक्रम, मॉक टेस्ट या अध्ययन योजना उपलब्ध नहीं है।"
              : "Find practical support for notices and applications. Syllabi, mock tests, and study plans are not currently provided on this site."}
          </p>
        </header>
        <section
          className="mt-6 grid gap-4 md:grid-cols-3"
          aria-label={hindi ? "तैयारी के कदम" : "Preparation steps"}
        >
          {cards.map(({ icon: Icon, title, body, to, action }, index) => (
            <article
              key={title}
              className="flex flex-col rounded-2xl border border-line bg-white p-5 shadow-card sm:p-6"
            >
              <span className="grid size-11 place-items-center rounded-xl bg-mint text-forest">
                <Icon size={21} aria-hidden="true" />
              </span>
              <p className="mt-4 text-xs font-bold uppercase tracking-wide text-muted">
                {hindi ? `कदम ${index + 1}` : `Step ${index + 1}`}
              </p>
              <h2 className="mt-2 text-lg font-bold">{title}</h2>
              <p className="mt-2 flex-1 text-sm leading-6 text-muted">{body}</p>
              <Link
                to={to}
                className="mt-5 inline-flex items-center gap-2 text-sm font-bold text-forest hover:underline"
              >
                {action}
                <ArrowRight size={16} aria-hidden="true" />
              </Link>
            </article>
          ))}
        </section>
        <Link
          to="/tools"
          className="mt-6 inline-flex min-h-11 items-center rounded-lg border border-forest px-4 py-2.5 text-sm font-semibold text-forest hover:bg-mint"
        >
          {hindi ? "सभी मुफ़्त टूल देखें" : "Explore all free tools"}
        </Link>
      </main>
    </div>
  );
}
