import { createHash, timingSafeEqual } from "node:crypto";
import { Router } from "express";
import { env } from "../config/env.js";
import { runIngestionOnce } from "../services/ingestion/ingestion.service.js";
import { runNotificationCycle } from "../services/notifications/scheduler.js";

function matchesSecret(expected, supplied) {
  const expectedDigest = createHash("sha256").update(expected).digest();
  const suppliedDigest = createHash("sha256")
    .update(typeof supplied === "string" ? supplied : "")
    .digest();
  return timingSafeEqual(expectedDigest, suppliedDigest);
}

export function createInternalCronRouter({ cronSecret, runIngestion, runNotifications }) {
  const router = Router();

  router.use((req, res, next) => {
    if (!cronSecret) {
      return res.status(503).json({
        error: { code: "CRON_NOT_CONFIGURED", message: "Scheduled jobs are not configured" },
      });
    }
    if (!matchesSecret(cronSecret, req.get("x-cron-secret"))) {
      return res.status(401).json({
        error: { code: "UNAUTHORIZED", message: "Valid cron credentials are required" },
      });
    }
    return next();
  });

  router.post("/run-notifications", async (_req, res, next) => {
    try {
      return res.json({ status: "completed", summary: await runNotifications() });
    } catch (error) {
      return next(error);
    }
  });

  router.post("/run-ingestion", async (_req, res, next) => {
    try {
      return res.json({ status: "completed", summary: await runIngestion() });
    } catch (error) {
      return next(error);
    }
  });

  return router;
}

export const internalCronRouter = createInternalCronRouter({
  cronSecret: env.CRON_SECRET,
  runIngestion: () => runIngestionOnce(),
  runNotifications: runNotificationCycle,
});
