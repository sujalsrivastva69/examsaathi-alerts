import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { parseLlmJson, validateExtractedPost } from "../../services/ingestion/extraction-schema.js";
import { classifyContentChange } from "../../services/ingestion/notice-change.js";
import { isPathDisallowed } from "../../services/ingestion/source-fetcher.js";
import { processDryRunFixtures } from "../../services/ingestion/dry-run.service.js";
import { expectedExtraction } from "./fixtures/expected-extractions.js";

const fixtureDirectory = fileURLToPath(new URL("./fixtures/", import.meta.url));
const confidenceThreshold = 0.75;

for (let index = 0; index < 5; index += 1) {
  test(`fake sample notice ${index + 1} matches its expected extraction`, async () => {
    const text = await readFile(`${fixtureDirectory}\\notice-${index + 1}.txt`, "utf8");
    const expected = expectedExtraction(index, text);
    const parsed = parseLlmJson(JSON.stringify(expected));

    assert.deepEqual(parsed, expected);
    assert.deepEqual(validateExtractedPost(parsed.posts[0], text, confidenceThreshold).reasons, []);
  });
}

test("invalid LLM JSON is rejected", () => {
  assert.throws(() => parseLlmJson('{"posts": ['), /invalid JSON/i);
});

test("deadline earlier than application start is flagged for review", async () => {
  const text = await readFile(`${fixtureDirectory}\\notice-1.txt`, "utf8");
  const post = expectedExtraction(0, text).posts[0];
  post.application_deadline.value = "2026-10-09";
  const assessment = validateExtractedPost(post, text, confidenceThreshold);
  assert.equal(assessment.status, "needs_review");
  assert.ok(
    assessment.reasons.includes("Application deadline is before the application start date"),
  );
});

test("same content hash is detected as a duplicate and changed hash as a correction", () => {
  assert.equal(classifyContentChange(null, "abc"), "new");
  assert.equal(classifyContentChange("abc", "abc"), "unchanged");
  assert.equal(classifyContentChange("abc", "def"), "changed");
});

test("robots disallow is respected, with more-specific allow taking precedence", () => {
  const robots = ["User-agent: *", "Disallow: /notices/", "Allow: /notices/current/"].join("\n");
  assert.equal(isPathDisallowed(robots, "/notices/old.pdf"), true);
  assert.equal(isPathDisallowed(robots, "/notices/current/1.pdf"), false);
});

test("dry-run processes all sample notices without enabling network sources", async () => {
  const result = await processDryRunFixtures();
  assert.equal(result.dry_run, true);
  assert.equal(result.run_summary.sample_notices_processed, 5);
  assert.deepEqual(result.sources_checked, []);
  assert.deepEqual(result.failures, []);
  assert.ok(
    result.run_summary.fixture_results.every((fixture) => fixture.status === "ready_for_review"),
  );
});
