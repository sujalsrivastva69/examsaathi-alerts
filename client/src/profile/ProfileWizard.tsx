import { useEffect, useMemo, useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  LoaderCircle,
  ShieldAlert,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { useAuth } from "../auth/AuthProvider";
import { apiRequest, ApiError } from "../lib/api";

type ProfileFormState = {
  education: string;
  date_of_birth: string;
  state: string;
  job_preferences: string[];
  email_consent: boolean;
  notify_needs_review: boolean;
  sms_consent: boolean;
};

const educationOptions = [
  "secondary",
  "higher_secondary",
  "diploma",
  "undergraduate",
  "postgraduate",
  "doctoral",
  "other",
] as const;

const stateOptions = [
  "Andhra Pradesh",
  "Arunachal Pradesh",
  "Assam",
  "Bihar",
  "Chhattisgarh",
  "Goa",
  "Gujarat",
  "Haryana",
  "Himachal Pradesh",
  "Jharkhand",
  "Karnataka",
  "Kerala",
  "Madhya Pradesh",
  "Maharashtra",
  "Manipur",
  "Meghalaya",
  "Mizoram",
  "Nagaland",
  "Odisha",
  "Punjab",
  "Rajasthan",
  "Sikkim",
  "Tamil Nadu",
  "Telangana",
  "Tripura",
  "Uttar Pradesh",
  "Uttarakhand",
  "West Bengal",
  "Andaman and Nicobar Islands",
  "Chandigarh",
  "Dadra and Nagar Haveli and Daman and Diu",
  "Delhi",
  "Jammu and Kashmir",
  "Ladakh",
  "Lakshadweep",
  "Puducherry",
] as const;

const jobAreas = [
  "administration",
  "banking",
  "defence",
  "education",
  "engineering",
  "healthcare",
  "police",
  "railways",
  "research",
  "other",
] as const;

const emptyProfile: ProfileFormState = {
  education: "",
  date_of_birth: "",
  state: "",
  job_preferences: [],
  email_consent: false,
  notify_needs_review: false,
  sms_consent: false,
};

function getMaxDate() {
  const today = new Date();
  const year = today.getFullYear() - 14;
  return `${year}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
}

function getMinDate() {
  const today = new Date();
  const year = today.getFullYear() - 70;
  return `${year}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
}

function PrivacyNote({ text }: { text: string }) {
  return <span className="mt-1 block text-[11px] leading-5 text-muted">{text}</span>;
}

function StepIndicator({ current, total }: { current: number; total: number }) {
  const { t } = useTranslation();
  return (
    <div className="mb-6 flex items-center gap-2 text-xs font-semibold text-muted">
      <span>{t("stepOf", { current, total })}</span>
      <div className="h-1 flex-1 overflow-hidden rounded-full bg-line">
        <div
          className="h-full rounded-full bg-forest"
          style={{ width: `${(current / total) * 100}%` }}
        />
      </div>
    </div>
  );
}

export function ProfileWizard() {
  const { user, loading: authLoading, configurationError, signOut } = useAuth();
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [form, setForm] = useState<ProfileFormState>(emptyProfile);
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState("");
  const [deleteToken, setDeleteToken] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  const totalSteps = 4;
  const language = i18n.resolvedLanguage?.startsWith("hi") ? "hi" : "en";

  useEffect(() => {
    if (!user) return;

    let ignored = false;
    async function loadProfile() {
      try {
        setFetching(true);

        const profileResult = (await apiRequest<{ profile?: Partial<ProfileFormState> }>(
          "/profile",
        )) as {
          profile?: Partial<ProfileFormState>;
        };

        const preferencesResult = (await apiRequest<{ preferences?: Partial<ProfileFormState> }>(
          "/notification-preferences",
        )) as {
          preferences?: Partial<ProfileFormState>;
        };

        if (ignored) return;

        setForm((current) => ({
          ...current,
          education: profileResult.profile?.education ?? current.education,
          date_of_birth: profileResult.profile?.date_of_birth ?? current.date_of_birth,
          state: profileResult.profile?.state ?? current.state,
          job_preferences: Array.isArray(profileResult.profile?.job_preferences)
            ? (profileResult.profile!.job_preferences as string[])
            : current.job_preferences,
          email_consent: Boolean(preferencesResult.preferences?.email_consent ?? false),
          notify_needs_review: Boolean(preferencesResult.preferences?.notify_needs_review ?? false),
          sms_consent: Boolean(preferencesResult.preferences?.sms_consent ?? false),
        }));
      } catch (loadError) {
        if (!ignored && !(loadError instanceof ApiError && loadError.status === 404)) {
          setError(loadError instanceof Error ? loadError.message : t("profileSaveError"));
        }
      } finally {
        if (!ignored) setFetching(false);
      }
    }

    void loadProfile();
    return () => {
      ignored = true;
    };
  }, [user, t]);

  const stepLabels = [t("stepEducation"), t("stepLocation"), t("stepJobs"), t("stepNotifications")];
  const currentStepTitle = stepLabels[Math.min(step - 1, stepLabels.length - 1)] ?? stepLabels[0];

  const canProceed = useMemo(() => {
    if (step === 1) return Boolean(form.education);
    if (step === 2) return Boolean(form.date_of_birth && form.state);
    if (step === 3) return form.job_preferences.length > 0;
    return true;
  }, [form, step]);

  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-muted">
        <LoaderCircle className="mr-2 animate-spin" size={18} />
        {t("loading")}
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (configurationError) {
    return (
      <div className="mx-auto flex min-h-screen max-w-lg items-center justify-center px-4">
        <div className="rounded-2xl border border-[#f1d4d0] bg-[#fff5f3] p-5 text-sm text-[#98483e]">
          {configurationError}
        </div>
      </div>
    );
  }

  function updateField<K extends keyof ProfileFormState>(field: K, value: ProfileFormState[K]) {
    setForm((current) => ({ ...current, [field]: value }));
    setError("");
  }

  function nextStep() {
    if (!canProceed) {
      const messages = {
        1: t("educationRequired"),
        2: t("dateOfBirthRequired"),
        3: t("jobPreferencesRequired"),
      };
      setError(messages[step as keyof typeof messages] ?? "");
      return;
    }
    setError("");
    setStep((current) => Math.min(current + 1, totalSteps));
  }

  function previousStep() {
    setError("");
    setStep((current) => Math.max(current - 1, 1));
  }

  async function submitProfile() {
    setLoading(true);
    setError("");
    try {
      await apiRequest("/profile", {
        method: "PATCH",
        body: {
          education: form.education,
          date_of_birth: form.date_of_birth,
          state: form.state,
          job_preferences: form.job_preferences,
        },
      });
      await apiRequest("/notification-preferences", {
        method: "PATCH",
        body: {
          email_consent: form.email_consent,
          email_enabled: form.email_consent,
          notify_needs_review: form.notify_needs_review,
          sms_consent: false,
          language,
        },
      });
      setStep(totalSteps + 1);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : t("profileSaveError"));
    } finally {
      setLoading(false);
    }
  }

  async function handleAccountDeletion() {
    if (deleteToken !== "DELETE") {
      setDeleteError(t("confirmDeleteMismatch"));
      return;
    }
    setDeleting(true);
    setDeleteError("");
    try {
      await apiRequest("/account", { method: "DELETE" });
      await signOut();
      navigate("/signup", { replace: true });
    } catch (deleteFailure) {
      setDeleteError(
        deleteFailure instanceof Error ? deleteFailure.message : t("deleteAccountError"),
      );
    } finally {
      setDeleting(false);
    }
  }

  const renderStep = () => {
    if (step === totalSteps + 1) {
      return (
        <div className="space-y-5">
          <div className="rounded-2xl border border-line bg-[#f7f8f6] p-4">
            <div className="flex items-center gap-2 text-forest">
              <BadgeCheck size={18} />
              <span className="font-semibold">{t("profileSaved")}</span>
            </div>
            <p className="mt-2 text-sm leading-6 text-muted">{t("reviewIntro")}</p>
          </div>
          <div className="rounded-2xl border border-line bg-white p-4">
            <h3 className="text-base font-semibold">{t("profileSummary")}</h3>
            <dl className="mt-3 space-y-2 text-sm text-muted">
              <div className="flex justify-between gap-3">
                <dt>{t("education")}</dt>
                <dd className="font-medium text-ink">{t(form.education || "other")}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt>{t("dateOfBirth")}</dt>
                <dd className="font-medium text-ink">{form.date_of_birth || "—"}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt>{t("state")}</dt>
                <dd className="font-medium text-ink">{form.state || "—"}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt>{t("jobPreferences")}</dt>
                <dd className="font-medium text-ink">
                  {form.job_preferences.length
                    ? form.job_preferences
                        .map((item) =>
                          t(
                            item === "education"
                              ? "educationJobs"
                              : item === "other"
                                ? "otherJobs"
                                : item,
                          ),
                        )
                        .join(", ")
                    : "—"}
                </dd>
              </div>
            </dl>
          </div>
          <div className="rounded-2xl border border-line bg-white p-4">
            <h3 className="text-base font-semibold">{t("notificationChoices")}</h3>
            <p className="mt-2 text-sm text-muted">
              {form.email_consent ? t("emailAlertsOn") : t("emailAlertsOff")}
            </p>
            <p className="mt-1 text-sm text-muted">{t("smsAlertsOff")}</p>
          </div>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => navigate("/", { replace: true })}
              className="flex-1 rounded-lg border border-line bg-white px-4 py-3 text-sm font-semibold text-ink"
            >
              {t("backToLogin")}
            </button>
            <button
              type="button"
              onClick={() => setStep(1)}
              className="flex-1 rounded-lg bg-forest px-4 py-3 text-sm font-semibold text-white"
            >
              {t("edit")}
            </button>
          </div>
        </div>
      );
    }

    return (
      <div className="space-y-5">
        {step === 1 && (
          <div className="space-y-4">
            <label className="block text-sm font-medium">
              {t("education")}
              <select
                className="mt-1.5 w-full rounded-lg border border-line bg-white px-3.5 py-3 text-sm text-ink focus:border-forest focus:ring-2 focus:ring-forest/15"
                value={form.education}
                onChange={(event) => updateField("education", event.target.value)}
              >
                <option value="">{t("chooseEducation")}</option>
                {educationOptions.map((option) => (
                  <option key={option} value={option}>
                    {t(option)}
                  </option>
                ))}
              </select>
              <PrivacyNote text={t("educationPrivacy")} />
            </label>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <label className="block text-sm font-medium">
              {t("dateOfBirth")}
              <input
                type="date"
                min={getMinDate()}
                max={getMaxDate()}
                className="mt-1.5 w-full rounded-lg border border-line bg-white px-3.5 py-3 text-sm text-ink focus:border-forest focus:ring-2 focus:ring-forest/15"
                value={form.date_of_birth}
                onChange={(event) => updateField("date_of_birth", event.target.value)}
              />
              <PrivacyNote text={t("dateOfBirthPrivacy")} />
            </label>
            <label className="block text-sm font-medium">
              {t("state")}
              <select
                className="mt-1.5 w-full rounded-lg border border-line bg-white px-3.5 py-3 text-sm text-ink focus:border-forest focus:ring-2 focus:ring-forest/15"
                value={form.state}
                onChange={(event) => updateField("state", event.target.value)}
              >
                <option value="">{t("chooseState")}</option>
                {stateOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
              <PrivacyNote text={t("statePrivacy")} />
            </label>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">{t("jobPreferences")}</label>
              <p className="mt-1 text-xs text-muted">{t("jobPreferencesPrivacy")}</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {jobAreas.map((job) => {
                const checked = form.job_preferences.includes(job);
                return (
                  <label
                    key={job}
                    className="flex items-center gap-2 rounded-xl border border-line bg-white p-3 text-sm text-ink"
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => {
                        setForm((current) => ({
                          ...current,
                          job_preferences: checked
                            ? current.job_preferences.filter((item) => item !== job)
                            : [...current.job_preferences, job],
                        }));
                      }}
                    />
                    <span>
                      {job === "education"
                        ? t("educationJobs")
                        : job === "other"
                          ? t("otherJobs")
                          : t(job)}
                    </span>
                  </label>
                );
              })}
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="space-y-4">
            <div className="rounded-xl border border-line bg-white p-3">
              <label className="flex items-start gap-3 text-sm text-ink">
                <input
                  type="checkbox"
                  checked={form.email_consent}
                  onChange={(event) => updateField("email_consent", event.target.checked)}
                />
                <span>
                  <span className="font-medium">{t("emailConsent")}</span>
                  <PrivacyNote text={t("emailConsentPrivacy")} />
                </span>
              </label>
            </div>
            <div className="rounded-xl border border-line bg-white p-3">
              <label className="flex items-start gap-3 text-sm text-ink">
                <input
                  type="checkbox"
                  checked={form.notify_needs_review}
                  onChange={(event) => updateField("notify_needs_review", event.target.checked)}
                />
                <span>
                  <span className="font-medium">{t("needsReviewConsent")}</span>
                  <PrivacyNote text={t("needsReviewConsentPrivacy")} />
                </span>
              </label>
            </div>
            <div className="rounded-xl border border-dashed border-line bg-[#f8faf8] p-3 opacity-70">
              <div className="flex items-start gap-3 text-sm text-muted">
                <input type="checkbox" checked={false} readOnly disabled />
                <span>
                  <span className="font-medium">{t("smsConsent")}</span>
                  <PrivacyNote text={t("smsComingSoon")} />
                </span>
              </div>
            </div>
          </div>
        )}

        {error && (
          <div className="rounded-lg border border-[#f1d4d0] bg-[#fff5f3] p-3 text-sm text-[#98483e]">
            <div className="flex items-start gap-2">
              <ShieldAlert size={16} className="mt-0.5" />
              <span>{error}</span>
            </div>
          </div>
        )}

        <div className="flex gap-3 pt-2">
          {step > 1 && step <= totalSteps && (
            <button
              type="button"
              onClick={previousStep}
              className="flex items-center justify-center gap-2 rounded-lg border border-line bg-white px-4 py-3 text-sm font-semibold text-ink"
            >
              <ArrowLeft size={16} />
              {t("back")}
            </button>
          )}
          {step <= totalSteps ? (
            <button
              type="button"
              onClick={step === totalSteps ? submitProfile : nextStep}
              className="ml-auto flex items-center justify-center gap-2 rounded-lg bg-forest px-4 py-3 text-sm font-semibold text-white disabled:opacity-60"
              disabled={loading || !canProceed}
            >
              {loading ? <LoaderCircle className="animate-spin" size={16} /> : null}
              {step === totalSteps ? t("saveProfile") : t("next")}
              {step !== totalSteps && <ArrowRight size={16} />}
            </button>
          ) : null}
        </div>
      </div>
    );
  };

  return (
    <main className="min-h-screen bg-canvas px-4 py-6 text-ink sm:px-6">
      <div className="mx-auto max-w-2xl">
        <div className="mb-5 flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.15em] text-muted">
              ExamSaathi
            </p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight">{t("profileSetupTitle")}</h1>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => void i18n.changeLanguage(language === "en" ? "hi" : "en")}
              className="rounded-lg px-3 py-2 text-sm font-semibold text-forest hover:bg-mint"
            >
              {t("language")}
            </button>
            <button
              type="button"
              onClick={() => void signOut()}
              className="rounded-lg border border-line bg-white px-3 py-2 text-sm font-medium text-muted"
            >
              {t("signOut")}
            </button>
          </div>
        </div>
        <p className="mb-4 text-sm leading-6 text-muted">{t("profileSetupIntro")}</p>
        {fetching ? (
          <div className="rounded-2xl border border-line bg-white p-6 text-center text-sm text-muted">
            <LoaderCircle className="mx-auto animate-spin" size={18} />
            <p className="mt-2">{t("loading")}</p>
          </div>
        ) : (
          <section className="rounded-2xl border border-line bg-white p-5 shadow-card sm:p-7">
            {step <= totalSteps && <StepIndicator current={step} total={totalSteps} />}
            <h2 className="mb-4 text-lg font-semibold">{currentStepTitle}</h2>
            {renderStep()}
          </section>
        )}
        <section className="mt-6 rounded-2xl border border-line bg-white p-5 shadow-card">
          <div className="flex items-start gap-3">
            <AlertCircle size={18} className="mt-0.5 text-forest" />
            <p className="text-xs leading-5 text-muted">{t("applicationPrivacy")}</p>
          </div>
          <div className="mt-4 rounded-xl border border-[#f1d4d0] bg-[#fff5f3] p-3">
            <p className="text-sm font-medium text-[#98483e]">{t("deleteAccount")}</p>
            <p className="mt-1 text-xs leading-5 text-muted">{t("deleteAccountWarning")}</p>
            <input
              type="text"
              value={deleteToken}
              onChange={(event) => setDeleteToken(event.target.value)}
              placeholder={t("deleteAccountConfirm")}
              className="mt-3 w-full rounded-lg border border-[#f1d4d0] bg-white px-3 py-2.5 text-sm text-ink focus:border-[#98483e] focus:ring-2 focus:ring-[#e7b0a8]"
            />
            {deleteError && <p className="mt-2 text-xs text-[#98483e]">{deleteError}</p>}
            <button
              type="button"
              disabled={deleting}
              onClick={() => void handleAccountDeletion()}
              className="mt-3 w-full rounded-lg bg-[#98483e] px-4 py-3 text-sm font-semibold text-white disabled:opacity-60"
            >
              {deleting ? (
                <LoaderCircle className="mr-2 inline-block animate-spin" size={16} />
              ) : null}
              {t("deleteAccountAction")}
            </button>
          </div>
        </section>
      </div>
    </main>
  );
}

export function ProfileHomeLink() {
  return (
    <Link
      to="/profile/setup"
      className="inline-flex items-center gap-2 rounded-lg bg-forest px-4 py-2.5 text-sm font-semibold text-white"
    >
      Continue to profile
    </Link>
  );
}
