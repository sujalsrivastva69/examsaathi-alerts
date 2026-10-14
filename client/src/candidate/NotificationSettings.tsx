import { useEffect, useState } from "react";
import { Bell, BellOff } from "lucide-react";
import { useTranslation } from "react-i18next";
import { ApiError, apiRequest } from "../lib/api";
import { CandidateLayout } from "./CandidateLayout";

type Preferences = {
  email_consent: boolean;
  email_frequency: "immediate" | "daily" | "weekly";
  deadline_reminders_enabled: boolean;
  notify_needs_review: boolean;
  language: "en" | "hi";
};

const initialPreferences: Preferences = {
  email_consent: false,
  email_frequency: "immediate",
  deadline_reminders_enabled: true,
  notify_needs_review: false,
  language: "en",
};

export function NotificationSettings() {
  const { t, i18n } = useTranslation();
  const [preferences, setPreferences] = useState(initialPreferences);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const result = await apiRequest<{ preferences: Partial<Preferences> }>(
          "/notification-preferences",
        );
        if (!cancelled) setPreferences({ ...initialPreferences, ...result.preferences });
      } catch (caught) {
        if (!cancelled)
          setError(caught instanceof ApiError ? caught.message : t("candidateLoadError"));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [t]);

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      setSaving(true);
      setError("");
      setSaved(false);
      const result = await apiRequest<{ preferences: Preferences }>("/notification-preferences", {
        method: "PATCH",
        body: {
          email_consent: preferences.email_consent,
          email_frequency: preferences.email_frequency,
          deadline_reminders_enabled: preferences.deadline_reminders_enabled,
          notify_needs_review: preferences.notify_needs_review,
          language: preferences.language,
        },
      });
      setPreferences({ ...initialPreferences, ...result.preferences });
      setSaved(true);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t("candidateSaveError"));
    } finally {
      setSaving(false);
    }
  }

  async function unsubscribe() {
    try {
      setSaving(true);
      setError("");
      setSaved(false);
      const result = await apiRequest<{ preferences: Preferences }>("/notification-preferences", {
        method: "PATCH",
        body: { email_consent: false },
      });
      setPreferences({ ...initialPreferences, ...result.preferences });
      setSaved(true);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t("candidateSaveError"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <CandidateLayout>
      <div className="mx-auto max-w-2xl">
        <div className="mb-6">
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
            {t("candidateNotificationSettings")}
          </h1>
          <p className="mt-1 text-sm leading-6 text-muted">{t("candidateSettingsIntro")}</p>
        </div>
        {loading ? (
          <div className="animate-pulse space-y-3" aria-busy="true" aria-label={t("loading")}>
            <div className="h-28 rounded-2xl bg-white" />
            <div className="h-48 rounded-2xl bg-white" />
          </div>
        ) : (
          <form onSubmit={(event) => void save(event)} className="space-y-4">
            <section className="rounded-2xl border border-line bg-white p-5 shadow-card sm:p-6">
              <div className="flex gap-3">
                <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-mint text-forest">
                  {preferences.email_consent ? <Bell size={19} /> : <BellOff size={19} />}
                </span>
                <div>
                  <h2 className="font-bold">{t("candidateEmailAlerts")}</h2>
                  <p className="mt-1 text-sm leading-6 text-muted">
                    {t("candidateEmailAlertsHelp")}
                  </p>
                </div>
              </div>
              <label className="mt-5 flex min-h-11 items-center gap-3 rounded-lg border border-line px-3 py-2 text-sm font-medium">
                <input
                  type="checkbox"
                  checked={preferences.email_consent}
                  onChange={(event) =>
                    setPreferences((current) => ({
                      ...current,
                      email_consent: event.target.checked,
                    }))
                  }
                  className="size-4 accent-forest focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest"
                />
                {t("candidateEnableEmail")}
              </label>
              <label className="mt-3 block text-sm font-semibold">
                {t("candidateEmailFrequency")}
                <select
                  value={preferences.email_frequency}
                  onChange={(event) =>
                    setPreferences((current) => ({
                      ...current,
                      email_frequency: event.target.value as Preferences["email_frequency"],
                    }))
                  }
                  disabled={!preferences.email_consent}
                  className="mt-1.5 min-h-11 w-full rounded-lg border border-line bg-white px-3 text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-forest disabled:bg-canvas disabled:text-muted"
                >
                  <option value="immediate">{t("candidateFrequencyImmediate")}</option>
                  <option value="daily">{t("candidateFrequencyDaily")}</option>
                  <option value="weekly">{t("candidateFrequencyWeekly")}</option>
                </select>
              </label>
              <label className="mt-4 flex min-h-11 items-center gap-3 rounded-lg border border-line px-3 py-2 text-sm font-medium">
                <input
                  type="checkbox"
                  checked={preferences.deadline_reminders_enabled}
                  disabled={!preferences.email_consent}
                  onChange={(event) =>
                    setPreferences((current) => ({
                      ...current,
                      deadline_reminders_enabled: event.target.checked,
                    }))
                  }
                  className="size-4 accent-forest focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest"
                />
                {t("candidateDeadlineReminders")}
              </label>
              <label className="mt-3 flex min-h-11 items-center gap-3 rounded-lg border border-line px-3 py-2 text-sm font-medium">
                <input
                  type="checkbox"
                  checked={preferences.notify_needs_review}
                  disabled={!preferences.email_consent}
                  onChange={(event) =>
                    setPreferences((current) => ({
                      ...current,
                      notify_needs_review: event.target.checked,
                    }))
                  }
                  className="size-4 accent-forest focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest"
                />
                {t("needsReviewConsent")}
              </label>
              <label className="mt-4 block text-sm font-semibold">
                {t("candidateEmailLanguage")}
                <select
                  value={preferences.language}
                  onChange={(event) => {
                    const language = event.target.value as Preferences["language"];
                    setPreferences((current) => ({ ...current, language }));
                    void i18n.changeLanguage(language);
                  }}
                  className="mt-1.5 min-h-11 w-full rounded-lg border border-line bg-white px-3 text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-forest"
                >
                  <option value="en">English</option>
                  <option value="hi">हिन्दी</option>
                </select>
              </label>
            </section>
            {error && (
              <p
                role="alert"
                className="rounded-lg border border-[#e8c2bd] bg-[#fff1ef] p-3 text-sm text-[#76392f]"
              >
                {error}
              </p>
            )}
            {saved && (
              <p role="status" className="rounded-lg bg-[#e8f1eb] p-3 text-sm text-[#285b46]">
                {t("candidateSettingsSaved")}
              </p>
            )}
            <div className="flex flex-wrap gap-3">
              <button
                type="submit"
                disabled={saving}
                className="min-h-11 rounded-lg bg-forest px-5 py-2.5 text-sm font-semibold text-white hover:bg-forest-dark focus:outline-none focus-visible:ring-2 focus-visible:ring-forest focus-visible:ring-offset-2 disabled:opacity-60"
              >
                {saving ? t("working") : t("candidateSaveSettings")}
              </button>
              <button
                type="button"
                onClick={() => void unsubscribe()}
                disabled={saving || !preferences.email_consent}
                className="min-h-11 rounded-lg border border-line bg-white px-4 py-2.5 text-sm font-semibold text-[#76392f] hover:bg-[#fff1ef] focus:outline-none focus-visible:ring-2 focus-visible:ring-forest disabled:opacity-50"
              >
                {t("candidateUnsubscribe")}
              </button>
            </div>
          </form>
        )}
      </div>
    </CandidateLayout>
  );
}
