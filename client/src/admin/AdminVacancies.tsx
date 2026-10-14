import { useCallback, useEffect, useState } from "react";
import { NavLink, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ApiError, apiRequest } from "../lib/api";

const states = [
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
];
const educationLevels = [
  "secondary",
  "higher_secondary",
  "diploma",
  "iti",
  "undergraduate",
  "postgraduate",
  "doctoral",
  "other",
];
const categories = ["sc", "st", "obc", "ews", "pwd", "ex_serviceman"] as const;
const statuses = ["draft", "awaiting_verification", "verified_open", "closed"] as const;
const indiaDateParts = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Kolkata",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
}).formatToParts(new Date());
const todayParts = Object.fromEntries(indiaDateParts.map(({ type, value }) => [type, value]));
const today = `${todayParts.year}-${todayParts.month}-${todayParts.day}`;
const nextMonthDate = new Date(`${today}T00:00:00Z`);
nextMonthDate.setUTCDate(nextMonthDate.getUTCDate() + 30);
const nextMonth = nextMonthDate.toISOString().slice(0, 10);
const blankChecklist = { source_checked: false, dates_checked: false, rules_checked: false };
const dayAfter = (date: string) =>
  new Date(Date.parse(`${date}T00:00:00Z`) + 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

type Status = (typeof statuses)[number];
type Checklist = typeof blankChecklist;
type RuleSet = {
  qualification_level: string;
  equivalent_qualifications?: string[];
  allowed_disciplines: string[];
  min_age: number;
  max_age: number;
  age_relaxations: Record<(typeof categories)[number], number>;
  domicile_states: string[];
  min_experience_years: number;
};
type Vacancy = {
  id: string;
  title: string | null;
  recruiting_organization: string | null;
  official_source_url: string;
  pdf_url: string | null;
  application_start_date: string | null;
  deadline: string | null;
  age_cutoff_date: string | null;
  rule_json: RuleSet | null;
  status: Status;
  verification_status: "pending" | "verified";
  verification_checklist: Checklist;
  last_verified_at: string | null;
  source_id: string | null;
  source_notice_url: string | null;
  source_quotes: {
    quotes?: Record<string, string | null>;
    confidence?: Record<string, number>;
    overall?: number;
  };
  extraction_payload: {
    post?: Record<string, { value: unknown; source_quote: string | null; confidence: number }>;
  };
  extraction_confidence: number;
  ingestion_status: string;
  review_reasons: string[];
  stale_verification_flag?: boolean;
  updated_at: string;
};
type VacancyForm = {
  title: string;
  recruiting_organization: string;
  official_source_url: string;
  pdf_url: string;
  application_start_date: string;
  deadline: string;
  age_cutoff_date: string;
  rule_json: RuleSet;
  verification_checklist: Checklist;
};
type Change = {
  id: number;
  field_name: string;
  old_value: unknown;
  new_value: unknown;
  changed_by: string;
  changed_at: string;
};
type VacancyDetails = { vacancy: Vacancy; changes: Change[] };

const blankRules: RuleSet = {
  qualification_level: "secondary",
  equivalent_qualifications: [],
  allowed_disciplines: [],
  min_age: 18,
  max_age: 40,
  age_relaxations: { sc: 0, st: 0, obc: 0, ews: 0, pwd: 0, ex_serviceman: 0 },
  domicile_states: [],
  min_experience_years: 0,
};

const freshForm = (): VacancyForm => ({
  title: "",
  recruiting_organization: "",
  official_source_url: "",
  pdf_url: "",
  application_start_date: today,
  deadline: nextMonth,
  age_cutoff_date: "",
  rule_json: { ...blankRules, age_relaxations: { ...blankRules.age_relaxations } },
  verification_checklist: { ...blankChecklist },
});

function ApiErrorMessage({ error }: { error: string }) {
  return (
    <div
      role="alert"
      className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800"
    >
      {error}
    </div>
  );
}

export function AdminVacancies() {
  const { t, i18n } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const [vacancies, setVacancies] = useState<Vacancy[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(() => searchParams.get("edit"));
  const [selected, setSelected] = useState<Vacancy | null>(null);
  const [changes, setChanges] = useState<Change[]>([]);
  const [form, setForm] = useState<VacancyForm>(freshForm);
  const [filterStatus, setFilterStatus] = useState("");
  const [deadlineSoon, setDeadlineSoon] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [preview, setPreview] = useState<{
    match_count: number;
    test_profile_count: number;
    rule_basis: string;
  } | null>(null);
  const [extendDeadline, setExtendDeadline] = useState("");

  useEffect(() => {
    const id = searchParams.get("edit");
    if (id !== selectedId) setSelectedId(id);
  }, [searchParams, selectedId]);

  function selectVacancy(id: string | null) {
    setSelectedId(id);
    setSearchParams(id ? { edit: id } : {});
  }

  const messageFor = useCallback(
    (reason: unknown) =>
      reason instanceof ApiError
        ? reason.message
        : reason instanceof Error
          ? reason.message
          : t("adminUnexpected"),
    [t],
  );

  const loadVacancies = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const query = new URLSearchParams();
      if (filterStatus) query.set("status", filterStatus);
      if (deadlineSoon) query.set("deadline_soon", "true");
      const result = await apiRequest<{ vacancies: Vacancy[] }>(
        `/admin/vacancies${query.size ? `?${query.toString()}` : ""}`,
      );
      setVacancies(result.vacancies);
    } catch (reason) {
      setError(messageFor(reason));
    } finally {
      setLoading(false);
    }
  }, [deadlineSoon, filterStatus, messageFor]);

  const loadDetails = useCallback(
    async (id: string) => {
      setError("");
      try {
        const result = await apiRequest<VacancyDetails>(`/admin/vacancies/${id}`);
        setSelected(result.vacancy);
        setChanges(result.changes);
        setForm({
          title: result.vacancy.title ?? "",
          recruiting_organization: result.vacancy.recruiting_organization ?? "",
          official_source_url: result.vacancy.official_source_url,
          pdf_url: result.vacancy.pdf_url ?? "",
          application_start_date: result.vacancy.application_start_date ?? "",
          deadline: result.vacancy.deadline ?? "",
          age_cutoff_date: result.vacancy.age_cutoff_date ?? "",
          rule_json: result.vacancy.rule_json ?? {
            ...blankRules,
            age_relaxations: { ...blankRules.age_relaxations },
          },
          verification_checklist: result.vacancy.verification_checklist,
        });
        setPreview(null);
        setExtendDeadline("");
      } catch (reason) {
        setError(messageFor(reason));
      }
    },
    [messageFor],
  );

  useEffect(() => {
    void loadVacancies();
  }, [loadVacancies]);
  useEffect(() => {
    if (selectedId) void loadDetails(selectedId);
  }, [loadDetails, selectedId]);

  function updateForm<K extends keyof VacancyForm>(key: K, value: VacancyForm[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function updateRules(patch: Partial<RuleSet>) {
    setForm((current) => ({ ...current, rule_json: { ...current.rule_json, ...patch } }));
  }

  function updateChecklist(key: keyof Checklist, checked: boolean) {
    setForm((current) => ({
      ...current,
      verification_checklist: { ...current.verification_checklist, [key]: checked },
    }));
  }

  const payload = () => ({ ...form, pdf_url: form.pdf_url.trim() || null });
  const hasUnsavedChanges = selected
    ? selected.title !== form.title ||
      selected.recruiting_organization !== form.recruiting_organization ||
      selected.official_source_url !== form.official_source_url ||
      selected.pdf_url !== (form.pdf_url.trim() || null) ||
      selected.application_start_date !== form.application_start_date ||
      selected.deadline !== form.deadline ||
      selected.age_cutoff_date !== form.age_cutoff_date ||
      JSON.stringify(selected.rule_json) !== JSON.stringify(form.rule_json) ||
      JSON.stringify(selected.verification_checklist) !==
        JSON.stringify(form.verification_checklist)
    : true;

  async function saveVacancy() {
    setSaving(true);
    setError("");
    try {
      if (selectedId) {
        const values = payload();
        const patch = Object.fromEntries(
          Object.entries(values).filter(([key, value]) => {
            const oldValue = selected?.[key as keyof Vacancy];
            return JSON.stringify(value) !== JSON.stringify(oldValue);
          }),
        );
        if (Object.keys(patch).length === 0) return;
        await apiRequest(`/admin/vacancies/${selectedId}`, { method: "PATCH", body: patch });
      } else {
        const result = await apiRequest<{ vacancy: Vacancy }>("/admin/vacancies", {
          method: "POST",
          body: payload(),
        });
        selectVacancy(result.vacancy.id);
      }
      await loadVacancies();
    } catch (reason) {
      setError(messageFor(reason));
    } finally {
      setSaving(false);
    }
  }

  async function runAction(action: string, body?: unknown) {
    if (!selectedId) return;
    setSaving(true);
    setError("");
    try {
      if (body) {
        await apiRequest(`/admin/vacancies/${selectedId}/${action}`, { method: "POST", body });
      } else {
        await apiRequest(`/admin/vacancies/${selectedId}/${action}`, { method: "POST" });
      }
      await loadDetails(selectedId);
      await loadVacancies();
    } catch (reason) {
      setError(messageFor(reason));
    } finally {
      setSaving(false);
    }
  }

  async function deleteDraft() {
    if (!selectedId || !window.confirm(t("adminDeleteConfirm"))) return;
    setSaving(true);
    setError("");
    try {
      await apiRequest(`/admin/vacancies/${selectedId}`, { method: "DELETE" });
      selectVacancy(null);
      setSelected(null);
      setChanges([]);
      setForm(freshForm());
      await loadVacancies();
    } catch (reason) {
      setError(messageFor(reason));
    } finally {
      setSaving(false);
    }
  }

  async function runPreview() {
    setSaving(true);
    setError("");
    try {
      const result = await apiRequest<{
        match_count: number;
        test_profile_count: number;
        rule_basis: string;
      }>("/admin/vacancies/preview-matches", {
        method: "POST",
        body: { age_cutoff_date: form.age_cutoff_date, rule_json: form.rule_json },
      });
      setPreview(result);
    } catch (reason) {
      setError(messageFor(reason));
    } finally {
      setSaving(false);
    }
  }

  const checklistComplete = Object.values(form.verification_checklist).every(Boolean);
  const canPublish =
    selected?.status === "awaiting_verification" &&
    selected.verification_status === "verified" &&
    checklistComplete &&
    !hasUnsavedChanges;
  const canVerify =
    selected?.status === "awaiting_verification" && checklistComplete && !hasUnsavedChanges;
  const isReadOnly = selected?.status === "closed";
  const labels: Record<Status, string> = {
    draft: t("adminDraft"),
    awaiting_verification: t("adminAwaitingVerification"),
    verified_open: t("adminVerifiedOpen"),
    closed: t("adminClosed"),
  };

  return (
    <main className="min-h-screen bg-canvas px-4 py-6 text-ink sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-forest">
              {t("brand")} {t("brandSuffix")}
            </p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">
              {t("adminTitle")}
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">{t("adminIntro")}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <NavLink
              to="/admin/review"
              className="rounded-lg border border-forest px-4 py-2.5 text-sm font-semibold text-forest"
            >
              {t("adminReviewQueue")}
            </NavLink>
            <NavLink
              to="/admin/notifications"
              className="rounded-lg border border-line px-4 py-2.5 text-sm font-semibold"
            >
              {t("adminFailedNotifications")}
            </NavLink>
            <button
              type="button"
              onClick={() => {
                selectVacancy(null);
                setSelected(null);
                setChanges([]);
                setForm(freshForm());
                setError("");
                setPreview(null);
              }}
              className="rounded-lg bg-forest px-4 py-2.5 text-sm font-semibold text-white hover:bg-forest-dark"
            >
              {t("adminNewVacancy")}
            </button>
          </div>
        </header>

        {error && (
          <div className="mb-4">
            <ApiErrorMessage error={error} />
          </div>
        )}

        <div className="grid items-start gap-5 lg:grid-cols-[300px_minmax(0,1fr)]">
          <aside className="rounded-2xl border border-line bg-white p-4 shadow-card">
            <h2 className="text-base font-bold">{t("adminVacancies")}</h2>
            <label className="mt-4 block text-sm font-medium">
              {t("adminFilterStatus")}
              <select
                value={filterStatus}
                onChange={(event) => setFilterStatus(event.target.value)}
                className="mt-1.5 w-full rounded-lg border border-line bg-white px-3 py-2"
              >
                <option value="">{t("adminAllStatuses")}</option>
                {statuses.map((status) => (
                  <option key={status} value={status}>
                    {labels[status]}
                  </option>
                ))}
              </select>
            </label>
            <label className="mt-3 flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={deadlineSoon}
                onChange={(event) => setDeadlineSoon(event.target.checked)}
              />
              {t("adminDeadlineSoon")}
            </label>
            {loading ? (
              <p className="py-6 text-sm text-muted">{t("loading")}</p>
            ) : (
              <ul className="mt-4 space-y-2">
                {vacancies.map((vacancy) => (
                  <li key={vacancy.id}>
                    <button
                      type="button"
                      onClick={() => selectVacancy(vacancy.id)}
                      className={`w-full rounded-xl border p-3 text-left transition ${
                        selectedId === vacancy.id
                          ? "border-forest bg-mint/50"
                          : "border-line hover:bg-canvas"
                      }`}
                    >
                      <span className="block truncate text-sm font-semibold">{vacancy.title}</span>
                      <span className="mt-1 block text-xs text-muted">
                        {labels[vacancy.status]}
                      </span>
                      {vacancy.stale_verification_flag && (
                        <span className="mt-1 block text-xs font-semibold text-red-700">
                          {t("adminStaleVerification")}
                        </span>
                      )}
                      <span className="mt-1 block text-xs text-muted">
                        {t("adminDeadline")}: {vacancy.deadline ?? t("adminNotEntered")}
                      </span>
                    </button>
                  </li>
                ))}
                {vacancies.length === 0 && (
                  <li className="py-5 text-sm text-muted">{t("adminNoVacancies")}</li>
                )}
              </ul>
            )}
          </aside>

          <div className="space-y-5">
            <section className="rounded-2xl border border-line bg-white p-4 shadow-card sm:p-6">
              <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-bold">
                    {selectedId ? t("adminEditVacancy") : t("adminCreateVacancy")}
                  </h2>
                  {selected && <p className="mt-1 text-sm text-muted">{labels[selected.status]}</p>}
                </div>
                <button
                  type="button"
                  disabled={saving || isReadOnly}
                  onClick={() => void saveVacancy()}
                  className="rounded-lg border border-forest px-4 py-2 text-sm font-semibold text-forest disabled:opacity-50"
                >
                  {saving ? t("working") : t("adminSave")}
                </button>
              </div>

              <fieldset disabled={saving || isReadOnly} className="space-y-5 disabled:opacity-70">
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="text-sm font-medium">
                    {t("adminTitleField")} *
                    <input
                      required
                      maxLength={200}
                      value={form.title}
                      onChange={(event) => updateForm("title", event.target.value)}
                      className="admin-input"
                    />
                  </label>
                  <label className="text-sm font-medium">
                    {t("adminOrganization")} *
                    <input
                      required
                      maxLength={200}
                      value={form.recruiting_organization}
                      onChange={(event) =>
                        updateForm("recruiting_organization", event.target.value)
                      }
                      className="admin-input"
                    />
                  </label>
                  <label className="text-sm font-medium sm:col-span-2">
                    {t("adminSourceUrl")} *
                    <input
                      required
                      type="url"
                      placeholder="https://…"
                      value={form.official_source_url}
                      onChange={(event) => updateForm("official_source_url", event.target.value)}
                      className="admin-input"
                    />
                    <span className="mt-1 block text-xs font-normal text-muted">
                      {t("adminSourceRequired")}
                    </span>
                  </label>
                  <label className="text-sm font-medium sm:col-span-2">
                    {t("adminPdfUrl")}
                    <input
                      type="url"
                      placeholder="https://…"
                      value={form.pdf_url}
                      onChange={(event) => updateForm("pdf_url", event.target.value)}
                      className="admin-input"
                    />
                  </label>
                  {(
                    [
                      ["application_start_date", t("adminStartDate")],
                      ["deadline", t("adminDeadline")],
                      ["age_cutoff_date", t("adminAgeCutoff")],
                    ] as const
                  ).map(([field, label]) => (
                    <label key={field} className="text-sm font-medium">
                      {label} *
                      <input
                        required
                        type="date"
                        value={form[field]}
                        onChange={(event) => updateForm(field, event.target.value)}
                        className="admin-input"
                      />
                    </label>
                  ))}
                </div>

                <div className="border-t border-line pt-5">
                  <h3 className="font-semibold">{t("adminEligibility")}</h3>
                  <p className="mt-1 text-xs leading-5 text-muted">{t("adminEligibilityHelp")}</p>
                  <div className="mt-4 grid gap-4 sm:grid-cols-2">
                    <label className="text-sm font-medium">
                      {t("adminQualification")}
                      <select
                        value={form.rule_json.qualification_level}
                        onChange={(event) =>
                          updateRules({ qualification_level: event.target.value })
                        }
                        className="admin-input"
                      >
                        {educationLevels.map((level) => (
                          <option key={level} value={level}>
                            {t(level)}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="text-sm font-medium">
                      {t("adminEquivalentQualifications")}
                      <select
                        multiple
                        value={form.rule_json.equivalent_qualifications ?? []}
                        onChange={(event) =>
                          updateRules({
                            equivalent_qualifications: Array.from(
                              event.target.selectedOptions,
                              (option) => option.value,
                            ),
                          })
                        }
                        className="admin-input min-h-28"
                      >
                        {educationLevels
                          .filter((level) => level !== form.rule_json.qualification_level)
                          .map((level) => (
                            <option key={level} value={level}>
                              {t(level)}
                            </option>
                          ))}
                      </select>
                      <span className="mt-1 block text-xs font-normal text-muted">
                        {t("adminEquivalentQualificationsHelp")}
                      </span>
                    </label>
                    <label className="text-sm font-medium">
                      {t("adminDisciplines")}
                      <input
                        value={form.rule_json.allowed_disciplines.join(", ")}
                        onChange={(event) =>
                          updateRules({
                            allowed_disciplines: event.target.value
                              .split(",")
                              .map((discipline) => discipline.trim())
                              .filter(Boolean),
                          })
                        }
                        placeholder={t("adminAnyDiscipline")}
                        className="admin-input"
                      />
                    </label>
                    <label className="text-sm font-medium">
                      {t("adminMinAge")}
                      <input
                        type="number"
                        min={14}
                        max={70}
                        value={form.rule_json.min_age}
                        onChange={(event) => updateRules({ min_age: Number(event.target.value) })}
                        className="admin-input"
                      />
                    </label>
                    <label className="text-sm font-medium">
                      {t("adminMaxAge")}
                      <input
                        type="number"
                        min={14}
                        max={70}
                        value={form.rule_json.max_age}
                        onChange={(event) => updateRules({ max_age: Number(event.target.value) })}
                        className="admin-input"
                      />
                    </label>
                    <label className="text-sm font-medium">
                      {t("adminDomicile")}
                      <select
                        multiple
                        value={form.rule_json.domicile_states}
                        onChange={(event) =>
                          updateRules({
                            domicile_states: Array.from(
                              event.target.selectedOptions,
                              (option) => option.value,
                            ),
                          })
                        }
                        className="admin-input min-h-28"
                      >
                        {states.map((state) => (
                          <option key={state} value={state}>
                            {state}
                          </option>
                        ))}
                      </select>
                      <span className="mt-1 block text-xs font-normal text-muted">
                        {t("adminDomicileHelp")}
                      </span>
                    </label>
                    <label className="text-sm font-medium">
                      {t("adminExperience")}
                      <input
                        type="number"
                        min={0}
                        max={50}
                        value={form.rule_json.min_experience_years}
                        onChange={(event) =>
                          updateRules({ min_experience_years: Number(event.target.value) })
                        }
                        className="admin-input"
                      />
                    </label>
                  </div>
                  <div className="mt-4">
                    <h4 className="text-sm font-semibold">{t("adminRelaxations")}</h4>
                    <div className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
                      {categories.map((category) => (
                        <label key={category} className="text-xs font-medium">
                          {t(`adminCategory_${category}`)}
                          <input
                            type="number"
                            min={0}
                            max={20}
                            value={form.rule_json.age_relaxations[category]}
                            onChange={(event) =>
                              updateRules({
                                age_relaxations: {
                                  ...form.rule_json.age_relaxations,
                                  [category]: Number(event.target.value),
                                },
                              })
                            }
                            className="admin-input"
                          />
                        </label>
                      ))}
                    </div>
                  </div>
                  <div className="mt-4 flex flex-wrap items-center gap-3">
                    <button
                      type="button"
                      onClick={() => void runPreview()}
                      className="rounded-lg border border-line px-3.5 py-2 text-sm font-semibold hover:bg-canvas"
                    >
                      {t("adminPreviewMatches")}
                    </button>
                    {preview && (
                      <p role="status" className="text-sm font-medium text-forest">
                        {t("adminPreviewCount", {
                          matches: preview.match_count,
                          total: preview.test_profile_count,
                        })}
                        <span className="ml-1 block text-xs font-normal text-muted">
                          {t("adminCutoffNotice")}
                        </span>
                      </p>
                    )}
                  </div>
                </div>

                <div className="border-t border-line pt-5">
                  <h3 className="font-semibold">{t("adminVerificationChecklist")}</h3>
                  <div className="mt-3 grid gap-3 sm:grid-cols-3">
                    {(
                      [
                        ["source_checked", "adminSourceChecked"],
                        ["dates_checked", "adminDatesChecked"],
                        ["rules_checked", "adminRulesChecked"],
                      ] as const
                    ).map(([key, labelKey]) => (
                      <label
                        key={key}
                        className="flex items-start gap-2 rounded-lg border border-line p-3 text-sm"
                      >
                        <input
                          type="checkbox"
                          checked={form.verification_checklist[key]}
                          onChange={(event) => updateChecklist(key, event.target.checked)}
                        />
                        <span>{t(labelKey)}</span>
                      </label>
                    ))}
                  </div>
                  {!checklistComplete && (
                    <p className="mt-2 text-xs text-muted">{t("adminChecklistRequired")}</p>
                  )}
                </div>
              </fieldset>

              {selected && (
                <div className="mt-5 flex flex-wrap gap-2 border-t border-line pt-5">
                  {selected.status === "draft" && (
                    <>
                      <button
                        disabled={saving || hasUnsavedChanges}
                        onClick={() => void runAction("submit")}
                        className="rounded-lg bg-forest px-3.5 py-2 text-sm font-semibold text-white disabled:opacity-50"
                      >
                        {t("adminSubmit")}
                      </button>
                      <button
                        disabled={saving || hasUnsavedChanges}
                        onClick={() => void deleteDraft()}
                        className="rounded-lg border border-red-300 px-3.5 py-2 text-sm font-semibold text-red-700 disabled:opacity-50"
                      >
                        {t("adminDelete")}
                      </button>
                    </>
                  )}
                  {selected.status === "awaiting_verification" && (
                    <>
                      <button
                        disabled={saving || !canVerify}
                        onClick={() => void runAction("verify")}
                        className="rounded-lg border border-forest px-3.5 py-2 text-sm font-semibold text-forest disabled:opacity-50"
                      >
                        {t("adminVerify")}
                      </button>
                      <button
                        disabled={saving || hasUnsavedChanges}
                        onClick={() => void runAction("return-to-draft")}
                        className="rounded-lg border border-line px-3.5 py-2 text-sm font-semibold disabled:opacity-50"
                      >
                        {t("adminReturnToDraft")}
                      </button>
                      <button
                        disabled={saving || !canPublish}
                        onClick={() => void runAction("publish")}
                        className="rounded-lg bg-forest px-3.5 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {t("adminPublish")}
                      </button>
                    </>
                  )}
                  {selected.status === "verified_open" && (
                    <button
                      disabled={saving || hasUnsavedChanges}
                      onClick={() => void runAction("close")}
                      className="rounded-lg border border-red-300 px-3.5 py-2 text-sm font-semibold text-red-700 disabled:opacity-50"
                    >
                      {t("adminClose")}
                    </button>
                  )}
                  {selected.status === "closed" && (
                    <button
                      disabled={saving || hasUnsavedChanges}
                      onClick={() => void runAction("reopen")}
                      className="rounded-lg border border-forest px-3.5 py-2 text-sm font-semibold text-forest disabled:opacity-50"
                    >
                      {t("adminReopen")}
                    </button>
                  )}
                  {selected.status !== "closed" && (
                    <form
                      className="flex flex-wrap items-center gap-2"
                      onSubmit={(event) => {
                        event.preventDefault();
                        void runAction("extend-deadline", { deadline: extendDeadline });
                      }}
                    >
                      <label className="sr-only" htmlFor="extend-deadline">
                        {t("adminExtendDeadline")}
                      </label>
                      <input
                        id="extend-deadline"
                        type="date"
                        min={selected.deadline ? dayAfter(selected.deadline) : undefined}
                        required
                        value={extendDeadline}
                        onChange={(event) => setExtendDeadline(event.target.value)}
                        className="rounded-lg border border-line px-3 py-2 text-sm"
                      />
                      <button
                        disabled={saving || !extendDeadline || hasUnsavedChanges}
                        className="rounded-lg border border-line px-3.5 py-2 text-sm font-semibold disabled:opacity-50"
                      >
                        {t("adminExtendDeadline")}
                      </button>
                    </form>
                  )}
                  {selected.last_verified_at && (
                    <p className="w-full text-xs text-muted">
                      {t("adminLastVerified")}:{" "}
                      {new Date(selected.last_verified_at).toLocaleString(i18n.language)}
                    </p>
                  )}
                </div>
              )}
            </section>

            {selected && (
              <section className="rounded-2xl border border-line bg-white p-4 shadow-card sm:p-6">
                <h2 className="text-lg font-bold">{t("adminHistory")}</h2>
                {changes.length === 0 ? (
                  <p className="mt-3 text-sm text-muted">{t("adminNoHistory")}</p>
                ) : (
                  <ol className="mt-4 space-y-4 border-l border-line pl-4">
                    {changes.map((change) => (
                      <li key={change.id} className="relative text-sm">
                        <span className="absolute -left-[21px] top-1 size-2.5 rounded-full bg-forest ring-4 ring-white" />
                        <p className="font-semibold">
                          {t(`adminField_${change.field_name}`, {
                            defaultValue: change.field_name,
                          })}
                        </p>
                        <p className="mt-1 break-all text-xs text-muted">
                          {t("adminOldValue")}: {JSON.stringify(change.old_value) ?? "—"} →{" "}
                          {t("adminNewValue")}: {JSON.stringify(change.new_value) ?? "—"}
                        </p>
                        <p className="mt-1 text-xs text-muted">
                          {new Date(change.changed_at).toLocaleString(i18n.language)} ·{" "}
                          {change.changed_by}
                        </p>
                      </li>
                    ))}
                  </ol>
                )}
              </section>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
