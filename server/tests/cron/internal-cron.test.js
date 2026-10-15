import assert from "node:assert/strict";
import { createServer } from "node:http";
import express from "express";
import test from "node:test";
import { createInternalCronRouter } from "../../routes/internal-cron.routes.js";

const secret = "a-cron-secret-long-enough-for-tests-123";

async function serveCronRouter(t, cronSecret, runIngestion, runNotifications) {
  const app = express();
  app.use(
    "/api/internal",
    createInternalCronRouter({ cronSecret, runIngestion, runNotifications }),
  );
  const server = createServer(app);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  t.after(
    () =>
      new Promise((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      }),
  );
  const address = server.address();
  return `http://127.0.0.1:${address.port}/api/internal`;
}

test("internal cron routes reject requests without the configured secret", async (t) => {
  let called = false;
  const baseUrl = await serveCronRouter(
    t,
    secret,
    async () => {
      called = true;
    },
    async () => {
      called = true;
    },
  );
  const response = await fetch(`${baseUrl}/run-notifications`, { method: "POST" });
  const wrongSecretResponse = await fetch(`${baseUrl}/run-ingestion`, {
    method: "POST",
    headers: { "x-cron-secret": "incorrect-cron-secret" },
  });

  assert.equal(response.status, 401);
  assert.equal((await response.json()).error.code, "UNAUTHORIZED");
  assert.equal(wrongSecretResponse.status, 401);
  assert.equal((await wrongSecretResponse.json()).error.code, "UNAUTHORIZED");
  assert.equal(called, false);
});

test("internal cron routes run the requested job and return its summary", async (t) => {
  const calls = [];
  const baseUrl = await serveCronRouter(
    t,
    secret,
    async () => {
      calls.push("ingestion");
      return { processed: 5 };
    },
    async () => {
      calls.push("notifications");
      return { queue_processed: 2 };
    },
  );
  const headers = { "x-cron-secret": secret };

  const notificationsResponse = await fetch(`${baseUrl}/run-notifications`, {
    method: "POST",
    headers,
  });
  const ingestionResponse = await fetch(`${baseUrl}/run-ingestion`, {
    method: "POST",
    headers,
  });

  assert.equal(notificationsResponse.status, 200);
  assert.deepEqual(await notificationsResponse.json(), {
    status: "completed",
    summary: { queue_processed: 2 },
  });
  assert.equal(ingestionResponse.status, 200);
  assert.deepEqual(await ingestionResponse.json(), {
    status: "completed",
    summary: { processed: 5 },
  });
  assert.deepEqual(calls, ["notifications", "ingestion"]);
});

test("internal cron routes are unavailable when no secret is configured", async (t) => {
  const baseUrl = await serveCronRouter(
    t,
    undefined,
    async () => ({}),
    async () => ({}),
  );
  const response = await fetch(`${baseUrl}/run-ingestion`, {
    method: "POST",
    headers: { "x-cron-secret": secret },
  });

  assert.equal(response.status, 503);
  assert.equal((await response.json()).error.code, "CRON_NOT_CONFIGURED");
});
