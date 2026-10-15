import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { fileURLToPath } from "node:url";

const migrationPath = fileURLToPath(
  new URL(
    "../../supabase/migrations/202610150010_compact_matches_and_track_notifications.sql",
    import.meta.url,
  ),
);

test("migration preserves existing explanation rows and adds publication tracking", async () => {
  const migration = await readFile(migrationPath, "utf8");

  assert.match(migration, /alter column explanation drop not null/i);
  assert.match(migration, /add column last_enqueued_notification_type text/i);
  assert.match(migration, /add column last_enqueued_rules_version integer/i);
  assert.doesNotMatch(migration, /\bdrop\s+(?:table|column)\b/i);
  assert.doesNotMatch(migration, /\bdelete\s+from\b/i);
});
