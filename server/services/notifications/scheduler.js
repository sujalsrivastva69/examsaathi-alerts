import cron from "node-cron";
import { env } from "../../config/env.js";
import {
  enqueueVacancyNotifications,
  flagStaleVacancies,
  getPublishedVacancies,
  getReminderVacancies,
} from "./notification-queue.service.js";
import { processNotificationBatch } from "./worker.js";

let running = false;

function dateInIndia(date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function offsetDate(date, offset) {
  const shifted = new Date(`${date}T00:00:00Z`);
  shifted.setUTCDate(shifted.getUTCDate() + offset);
  return shifted.toISOString().slice(0, 10);
}

async function enqueueReminders(days, type) {
  const targetDate = offsetDate(dateInIndia(new Date()), days);
  const vacancies = await getReminderVacancies(targetDate);
  let enqueued = 0;
  for (const vacancy of vacancies) {
    const result = await enqueueVacancyNotifications(vacancy.id, type);
    enqueued += result.enqueued;
  }
  return enqueued;
}

export async function runNotificationCycle() {
  const vacancies = await getPublishedVacancies();
  let publicationEventsEnqueued = 0;
  for (const vacancy of vacancies) {
    const result = await enqueueVacancyNotifications(vacancy.id, vacancy.next_notification_type, {
      rulesVersion: vacancy.rules_version,
    });
    publicationEventsEnqueued += result.enqueued;
  }
  const [threeDay, oneDay, stale] = await Promise.all([
    enqueueReminders(3, "deadline_reminder_3d"),
    enqueueReminders(1, "deadline_reminder_1d"),
    flagStaleVacancies(),
  ]);
  const queue = await processNotificationBatch();
  const summary = {
    publication_events_enqueued: publicationEventsEnqueued,
    deadline_reminder_3d_enqueued: threeDay,
    deadline_reminder_1d_enqueued: oneDay,
    stale_vacancies_flagged: stale.flagged,
    queue_processed: queue.processed,
  };
  console.info(JSON.stringify({ event: "notification_cycle_complete", ...summary }));
  return summary;
}

export function startNotificationScheduler() {
  if (!cron.validate(env.NOTIFICATION_CRON)) {
    throw new Error(`Invalid NOTIFICATION_CRON expression: ${env.NOTIFICATION_CRON}`);
  }
  return cron.schedule(env.NOTIFICATION_CRON, async () => {
    if (running) {
      console.warn("Skipping notification cycle because the previous cycle is still active");
      return;
    }
    running = true;
    try {
      await runNotificationCycle();
    } catch (error) {
      console.error("Notification cycle failed", error);
    } finally {
      running = false;
    }
  });
}
