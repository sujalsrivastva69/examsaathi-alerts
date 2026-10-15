import { useState, type FormEvent } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { BriefcaseBusiness, LoaderCircle } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useAuth } from "./AuthProvider";
import { supabase } from "../lib/supabase";

const fieldClass =
  "mt-1.5 w-full rounded-lg border border-line bg-white px-3.5 py-3 text-sm text-ink outline-none transition placeholder:text-[#9aa39e] focus:border-forest focus:ring-2 focus:ring-forest/15";
const buttonClass =
  "inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-forest px-4 py-3 text-sm font-semibold text-white transition hover:bg-forest-dark focus:outline-none focus-visible:ring-2 focus-visible:ring-forest focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60";

function AuthLayout({ title, children }: { title: string; children: React.ReactNode }) {
  const { t, i18n } = useTranslation();
  const language = i18n.resolvedLanguage?.startsWith("hi") ? "hi" : "en";

  return (
    <main className="mx-auto flex min-h-screen max-w-lg flex-col justify-center px-4 py-10 sm:px-6">
      <div className="mb-6 flex items-center justify-between">
        <Link to="/" className="inline-flex items-center gap-2 font-bold tracking-tight">
          <span className="grid size-9 place-items-center rounded-xl bg-forest text-white">
            <BriefcaseBusiness size={18} />
          </span>
          ExamSaathi <span className="font-medium text-muted">Alerts</span>
        </Link>
        <div className="flex items-center gap-2">
          <Link
            to="/jobs"
            className="rounded-lg px-3 py-2 text-sm font-semibold text-forest hover:bg-mint"
          >
            {language === "hi" ? "भर्तियाँ" : "Browse jobs"}
          </Link>
          <button
            type="button"
            onClick={() => void i18n.changeLanguage(language === "en" ? "hi" : "en")}
            className="rounded-lg px-3 py-2 text-sm font-semibold text-forest hover:bg-mint"
          >
            {t("language")}
          </button>
        </div>
      </div>
      <section className="rounded-2xl border border-line bg-white p-5 shadow-card sm:p-8">
        <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
        {children}
      </section>
      <p className="mt-5 text-center text-xs leading-5 text-muted">{t("authPrivacy")}</p>
    </main>
  );
}

function FormError({ children }: { children: React.ReactNode }) {
  return (
    <p
      role="alert"
      className="rounded-lg border border-[#f1d4d0] bg-[#fff5f3] px-3 py-2.5 text-sm text-[#98483e]"
    >
      {children}
    </p>
  );
}

function SubmitButton({ loading, label }: { loading: boolean; label: string }) {
  const { t } = useTranslation();
  return (
    <button type="submit" className={buttonClass} disabled={loading}>
      {loading && <LoaderCircle size={16} className="animate-spin" />}
      {loading ? t("working") : label}
    </button>
  );
}

export function SignupPage() {
  const { t } = useTranslation();
  const { user, configurationError } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  if (user) return <Navigate to="/profile/setup" replace />;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setLoading(true);
    try {
      if (configurationError) throw new Error(configurationError);
      const { data, error: authError } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: { emailRedirectTo: `${window.location.origin}/verify-email` },
      });
      if (authError) throw authError;
      if (data.session) navigate("/profile/setup", { replace: true });
      else navigate(`/verify-email?email=${encodeURIComponent(email.trim())}`, { replace: true });
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : t("authUnexpectedError"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthLayout title={t("signupTitle")}>
      <p className="mt-2 text-sm leading-6 text-muted">{t("signupIntro")}</p>
      <form className="mt-6 space-y-4" onSubmit={submit}>
        <label className="block text-sm font-medium">
          {t("email")}
          <input
            className={fieldClass}
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
          <span className="mt-1 block text-xs font-normal text-muted">{t("emailPrivacy")}</span>
        </label>
        <label className="block text-sm font-medium">
          {t("password")}
          <input
            className={fieldClass}
            type="password"
            autoComplete="new-password"
            minLength={8}
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
          <span className="mt-1 block text-xs font-normal text-muted">{t("passwordPrivacy")}</span>
        </label>
        {error && <FormError>{error}</FormError>}
        <SubmitButton loading={loading} label={t("createAccount")} />
      </form>
      <p className="mt-5 text-center text-sm text-muted">
        {t("alreadyAccount")}{" "}
        <Link className="font-semibold text-forest hover:underline" to="/login">
          {t("login")}
        </Link>
      </p>
    </AuthLayout>
  );
}

export function LoginPage() {
  const { t } = useTranslation();
  const { user, configurationError } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  if (user) return <Navigate to="/profile/setup" replace />;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setLoading(true);
    try {
      if (configurationError) throw new Error(configurationError);
      const { error: authError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (authError) throw authError;
      const destination = (location.state as { from?: string } | null)?.from ?? "/profile/setup";
      navigate(destination, { replace: true });
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : t("authUnexpectedError"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthLayout title={t("loginTitle")}>
      <p className="mt-2 text-sm leading-6 text-muted">{t("loginIntro")}</p>
      <form className="mt-6 space-y-4" onSubmit={submit}>
        <label className="block text-sm font-medium">
          {t("email")}
          <input
            className={fieldClass}
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
          <span className="mt-1 block text-xs font-normal text-muted">{t("emailPrivacy")}</span>
        </label>
        <label className="block text-sm font-medium">
          {t("password")}
          <input
            className={fieldClass}
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
          <span className="mt-1 block text-xs font-normal text-muted">{t("passwordPrivacy")}</span>
        </label>
        {error && <FormError>{error}</FormError>}
        <SubmitButton loading={loading} label={t("login")} />
      </form>
      <Link
        to="/forgot-password"
        className="mt-4 block text-center text-sm font-medium text-forest hover:underline"
      >
        {t("forgotPassword")}
      </Link>
      <p className="mt-5 text-center text-sm text-muted">
        {t("needAccount")}{" "}
        <Link className="font-semibold text-forest hover:underline" to="/signup">
          {t("signup")}
        </Link>
      </p>
    </AuthLayout>
  );
}

export function VerifyEmailPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [email, setEmail] = useState(
    new URLSearchParams(window.location.search).get("email") ?? user?.email ?? "",
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);

  async function resend() {
    setError("");
    setSent(false);
    setLoading(true);
    try {
      const { error: authError } = await supabase.auth.resend({
        type: "signup",
        email: email.trim(),
        options: { emailRedirectTo: `${window.location.origin}/verify-email` },
      });
      if (authError) throw authError;
      setSent(true);
    } catch (resendError) {
      setError(resendError instanceof Error ? resendError.message : t("authUnexpectedError"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthLayout title={t("verifyTitle")}>
      <p className="mt-2 text-sm leading-6 text-muted">{t("verifyIntro")}</p>
      {user && (
        <p className="mt-4 rounded-lg bg-mint px-3 py-2.5 text-sm text-forest" role="status">
          {t("verifyComplete")}
        </p>
      )}
      <label className="mt-5 block text-sm font-medium">
        {t("email")}
        <input
          className={fieldClass}
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />
        <span className="mt-1 block text-xs font-normal text-muted">{t("emailPrivacy")}</span>
      </label>
      {error && (
        <div className="mt-4">
          <FormError>{error}</FormError>
        </div>
      )}
      {sent && (
        <p className="mt-4 text-sm text-forest" role="status">
          {t("verificationResent")}
        </p>
      )}
      <button
        type="button"
        onClick={() => void resend()}
        className={`${buttonClass} mt-5`}
        disabled={loading}
      >
        {loading && <LoaderCircle size={16} className="animate-spin" />}
        {loading ? t("working") : t("resendVerification")}
      </button>
      <Link
        to={user ? "/profile/setup" : "/login"}
        className="mt-5 block text-center text-sm font-semibold text-forest hover:underline"
      >
        {user ? t("continueToProfile") : t("backToLogin")}
      </Link>
    </AuthLayout>
  );
}

export function ForgotPasswordPage() {
  const { t } = useTranslation();
  const { user, configurationError } = useAuth();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);

  if (user) return <Navigate to="/profile/setup" replace />;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setLoading(true);
    try {
      if (configurationError) throw new Error(configurationError);
      const { error: authError } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (authError) throw authError;
      setSent(true);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : t("authUnexpectedError"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthLayout title={t("forgotTitle")}>
      <p className="mt-2 text-sm leading-6 text-muted">{t("forgotIntro")}</p>
      <form className="mt-6 space-y-4" onSubmit={submit}>
        <label className="block text-sm font-medium">
          {t("email")}
          <input
            className={fieldClass}
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
          <span className="mt-1 block text-xs font-normal text-muted">{t("emailPrivacy")}</span>
        </label>
        {error && <FormError>{error}</FormError>}
        {sent && (
          <p className="text-sm text-forest" role="status">
            {t("resetLinkSent")}
          </p>
        )}
        <SubmitButton loading={loading} label={t("sendResetLink")} />
      </form>
      <Link
        to="/login"
        className="mt-5 block text-center text-sm font-semibold text-forest hover:underline"
      >
        {t("backToLogin")}
      </Link>
    </AuthLayout>
  );
}

export function ResetPasswordPage() {
  const { t } = useTranslation();
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [complete, setComplete] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setLoading(true);
    try {
      const { error: authError } = await supabase.auth.updateUser({ password });
      if (authError) throw authError;
      setComplete(true);
      window.setTimeout(() => navigate("/profile/setup", { replace: true }), 1200);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : t("authUnexpectedError"));
    } finally {
      setLoading(false);
    }
  }

  if (!authLoading && !user) {
    return (
      <AuthLayout title={t("resetTitle")}>
        <p className="mt-2 text-sm leading-6 text-muted">{t("resetExpired")}</p>
        <Link
          to="/forgot-password"
          className="mt-5 block text-center text-sm font-semibold text-forest hover:underline"
        >
          {t("sendResetLink")}
        </Link>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout title={t("resetTitle")}>
      <p className="mt-2 text-sm leading-6 text-muted">{t("resetIntro")}</p>
      <form className="mt-6 space-y-4" onSubmit={submit}>
        <label className="block text-sm font-medium">
          {t("newPassword")}
          <input
            className={fieldClass}
            type="password"
            autoComplete="new-password"
            minLength={8}
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
          <span className="mt-1 block text-xs font-normal text-muted">{t("passwordPrivacy")}</span>
        </label>
        {error && <FormError>{error}</FormError>}
        {complete && (
          <p className="text-sm text-forest" role="status">
            {t("passwordUpdated")}
          </p>
        )}
        <SubmitButton loading={loading} label={t("updatePassword")} />
      </form>
    </AuthLayout>
  );
}
