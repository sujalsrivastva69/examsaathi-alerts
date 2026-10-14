import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ApiError, apiRequest } from "../lib/api";
import { CandidateLayout } from "./CandidateLayout";

type FeedbackType = "wrong_match" | "missed_vacancy" | "irrelevant_alert";

export function BetaFeedback() {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const vacancyId = searchParams.get("vacancy_id");
  const [feedbackType, setFeedbackType] = useState<FeedbackType>("wrong_match");
  const [details, setDetails] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [submitted, setSubmitted] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      await apiRequest("/beta-feedback", {
        method: "POST",
        body: {
          feedback_type: feedbackType,
          vacancy_id: vacancyId,
          details: details.trim(),
        },
      });
      setSubmitted(true);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : t("feedbackError"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <CandidateLayout>
      <div className="mx-auto max-w-2xl">
        <h1 className="text-2xl font-bold tracking-tight">{t("feedbackTitle")}</h1>
        <p className="mt-2 text-sm leading-6 text-muted">{t("feedbackIntro")}</p>
        {submitted ? (
          <div className="mt-5 rounded-2xl border border-[#c8dccd] bg-white p-6" role="status">
            <h2 className="font-bold text-forest">{t("feedbackThanks")}</h2>
            <button
              type="button"
              onClick={() => navigate("/dashboard")}
              className="mt-4 min-h-11 rounded-lg bg-forest px-4 py-2 text-sm font-semibold text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-forest focus-visible:ring-offset-2"
            >
              {t("candidateBackToMatches")}
            </button>
          </div>
        ) : (
          <form
            onSubmit={(event) => void submit(event)}
            className="mt-5 space-y-4 rounded-2xl border border-line bg-white p-5 shadow-card sm:p-6"
          >
            <fieldset>
              <legend className="text-sm font-semibold">{t("feedbackTypeLabel")}</legend>
              <div className="mt-2 grid gap-2">
                {(
                  [
                    ["wrong_match", "feedbackWrongMatch"],
                    ["missed_vacancy", "feedbackMissedVacancy"],
                    ["irrelevant_alert", "feedbackIrrelevantAlert"],
                  ] as const
                ).map(([value, label]) => (
                  <label
                    key={value}
                    className="flex min-h-11 items-center gap-3 rounded-lg border border-line px-3 py-2 text-sm"
                  >
                    <input
                      type="radio"
                      name="feedback_type"
                      value={value}
                      checked={feedbackType === value}
                      onChange={() => setFeedbackType(value)}
                      className="size-4 accent-forest focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest"
                    />
                    {t(label)}
                  </label>
                ))}
              </div>
            </fieldset>
            {vacancyId && <p className="text-xs text-muted">{t("feedbackAttachedVacancy")}</p>}
            <label className="block text-sm font-semibold">
              {t("feedbackDetails")}
              <textarea
                required
                minLength={10}
                maxLength={3000}
                rows={6}
                value={details}
                onChange={(event) => setDetails(event.target.value)}
                className="mt-1.5 w-full rounded-lg border border-line px-3 py-2 text-sm font-normal focus:outline-none focus-visible:ring-2 focus-visible:ring-forest"
              />
              <span className="mt-1 block text-xs font-normal text-muted">
                {t("feedbackPrivacy")}
              </span>
            </label>
            {error && (
              <p role="alert" className="rounded-lg bg-[#fff1ef] p-3 text-sm text-[#76392f]">
                {error}
              </p>
            )}
            <button
              type="submit"
              disabled={saving}
              className="min-h-11 rounded-lg bg-forest px-5 py-2.5 text-sm font-semibold text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-forest focus-visible:ring-offset-2 disabled:opacity-60"
            >
              {saving ? t("working") : t("feedbackSubmit")}
            </button>
          </form>
        )}
      </div>
    </CandidateLayout>
  );
}
