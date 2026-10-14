import cron from "node-cron";
import { env } from "../../config/env.js";
import { runIngestionOnce } from "./ingestion.service.js";

let running = false;

export function startIngestionScheduler() {
  if (!cron.validate(env.INGESTION_CRON)) {
    throw new Error(`Invalid INGESTION_CRON expression: ${env.INGESTION_CRON}`);
  }

  return cron.schedule(env.INGESTION_CRON, async () => {
    if (running) {
      console.warn("Skipping scheduled ingestion because the previous run is still active");
      return;
    }
    running = true;
    try {
      await runIngestionOnce();
    } catch (error) {
      console.error("Scheduled ingestion run failed", error);
    } finally {
      running = false;
    }
  });
}
