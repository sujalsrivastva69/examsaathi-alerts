import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { fileURLToPath } from "node:url";

const serverDirectory = fileURLToPath(new URL("../..", import.meta.url));

test("production warns when proxy trust is disabled", () => {
  const result = spawnSync(
    process.execPath,
    ["--input-type=module", "-e", "await import('./config/env.js')"],
    {
      cwd: serverDirectory,
      encoding: "utf8",
      env: {
        ...process.env,
        NODE_ENV: "production",
        TRUST_PROXY_HOPS: "0",
        APP_URL: "https://example.com",
        SUPABASE_URL: "https://example.supabase.co",
        SUPABASE_ANON_KEY: "test-anon-key",
        SUPABASE_SERVICE_ROLE_KEY: "test-service-role-key",
        RESEND_API_KEY: "test-resend-api-key",
        UNSUBSCRIBE_TOKEN_SECRET: "production-unsubscribe-secret-with-32-chars",
      },
    },
  );

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stderr, /TRUST_PROXY_HOPS is 0 in production/);
});

test("production requires a dedicated unsubscribe token secret", () => {
  const result = spawnSync(
    process.execPath,
    ["--input-type=module", "-e", "await import('./config/env.js')"],
    {
      cwd: serverDirectory,
      encoding: "utf8",
      env: {
        ...process.env,
        NODE_ENV: "production",
        APP_URL: "https://example.com",
        SUPABASE_URL: "https://example.supabase.co",
        SUPABASE_ANON_KEY: "test-anon-key",
        SUPABASE_SERVICE_ROLE_KEY: "test-service-role-key",
        RESEND_API_KEY: "test-resend-api-key",
        UNSUBSCRIBE_TOKEN_SECRET: "",
      },
    },
  );

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /UNSUBSCRIBE_TOKEN_SECRET: Required in production/);
});
