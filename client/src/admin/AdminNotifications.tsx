import { useCallback, useEffect, useState } from "react";
import { NavLink } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ApiError, apiRequest } from "../lib/api";

type FailedNotification = {
  id: string;
  user_id: string;
  vacancy_id: string;
  notification_type: string;
  attempt_count: number;
  last_error: string | null;
  created_at: string;
  match_snapshot: { vacancy?: { title?: string | null } };
};

export function AdminNotifications() {
  const { t } = useTranslation();
  const [items, setItems] = useState<FailedNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const errorMessage = useCallback(
    (reason: unknown) =>
      reason instanceof ApiError
        ? reason.message
        : reason instanceof Error
          ? reason.message
          : t("adminUnexpected"),
    [t],
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await apiRequest<{ notifications: FailedNotification[] }>(
        "/admin/vacancies/notifications/failed",
      );
      setItems(response.notifications);
    } catch (reason) {
      setError(errorMessage(reason));
    } finally {
      setLoading(false);
    }
  }, [errorMessage]);

  useEffect(() => {
    void load();
  }, [load]);

  async function retry(item: FailedNotification) {
    setWorking(item.id);
    setError("");
    setNotice("");
    try {
      await apiRequest(`/admin/vacancies/notifications/${item.id}/retry`, { method: "POST" });
      setNotice(t("adminNotificationRetryQueued"));
      await load();
    } catch (reason) {
      setError(errorMessage(reason));
    } finally {
      setWorking("");
    }
  }

  return (
    <main className="min-h-screen bg-canvas px-4 py-6 text-ink sm:px-6 lg:px-8">
      <div className="mx-auto max-w-5xl">
        <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-forest">
              {t("brand")} {t("brandSuffix")}
            </p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">
              {t("adminFailedNotifications")}
            </h1>
            <p className="mt-2 text-sm text-muted">{t("adminFailedNotificationsHelp")}</p>
          </div>
          <NavLink
            to="/admin"
            className="rounded-lg border border-line px-4 py-2.5 text-sm font-semibold"
          >
            {t("adminTitle")}
          </NavLink>
        </header>

        {error && (
          <p role="alert" className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-800">
            {error}
          </p>
        )}
        {notice && (
          <p role="status" className="mb-4 rounded-lg bg-green-50 p-3 text-sm text-green-800">
            {notice}
          </p>
        )}
        {loading ? (
          <p className="py-12 text-center text-muted">{t("loading")}</p>
        ) : items.length === 0 ? (
          <div className="rounded-2xl border border-line bg-white p-6 text-sm text-muted">
            {t("adminNoFailedNotifications")}
          </div>
        ) : (
          <ul className="space-y-3">
            {items.map((item) => (
              <li
                key={item.id}
                className="flex flex-col gap-4 rounded-2xl border border-line bg-white p-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <h2 className="font-semibold">
                    {item.match_snapshot.vacancy?.title || t("adminNotificationUntitled")}
                  </h2>
                  <p className="mt-1 break-all text-xs text-muted">
                    {item.notification_type} ·{" "}
                    {t("adminNotificationAttempts", { count: item.attempt_count })}
                  </p>
                  <p className="mt-2 break-words text-sm text-red-700">
                    {item.last_error || t("adminNotificationUnknownFailure")}
                  </p>
                  <p className="mt-1 text-xs text-muted">
                    {t("adminNotificationUserId")}: {item.user_id} ·{" "}
                    {t("adminNotificationVacancyId")}: {item.vacancy_id}
                  </p>
                </div>
                <button
                  type="button"
                  disabled={working === item.id}
                  onClick={() => void retry(item)}
                  className="shrink-0 rounded-lg bg-forest px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
                >
                  {working === item.id ? t("working") : t("adminRetryNotification")}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}
