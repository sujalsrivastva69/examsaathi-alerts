import { app } from "./app.js";
import { env } from "./config/env.js";
import { startIngestionScheduler } from "./services/ingestion/scheduler.js";
import { startNotificationScheduler } from "./services/notifications/scheduler.js";

app.listen(env.PORT, () => {
  console.info(`ExamSaathi API listening on port ${env.PORT}`);
  if (env.LOCAL_VIEW_MODE) {
    console.info(
      "Local view mode enabled; background ingestion and notification jobs are disabled",
    );
  } else if (env.ENABLE_INTERNAL_CRON) {
    startIngestionScheduler();
    startNotificationScheduler();
  } else {
    console.info(
      "Internal cron disabled; use the protected /api/internal endpoints with an external scheduler",
    );
  }
});
