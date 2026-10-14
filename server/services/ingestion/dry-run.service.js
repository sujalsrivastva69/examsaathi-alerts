import { readFile } from "node:fs/promises";
import { validateExtractedPost } from "./extraction-schema.js";
import { expectedExtraction } from "../../tests/ingestion/fixtures/expected-extractions.js";
import { sources } from "./sources.config.js";

const fixtureDirectory = new URL("../../tests/ingestion/fixtures/", import.meta.url);
const confidenceThreshold = 0.75;

export async function processDryRunFixtures() {
  const fixtures = [];
  for (let index = 0; index < 5; index += 1) {
    const name = `notice-${index + 1}.txt`;
    const text = await readFile(new URL(name, fixtureDirectory), "utf8");
    const extraction = expectedExtraction(index, text);
    const assessment = validateExtractedPost(extraction.posts[0], text, confidenceThreshold);
    fixtures.push({ name, status: assessment.status, reasons: assessment.reasons });
  }
  return {
    dry_run: true,
    sources_checked: [],
    new_notices_found: 0,
    failures: [],
    run_summary: {
      mode: "dry_run",
      sample_notices_processed: fixtures.length,
      configured_sources_disabled: sources
        .filter((source) => !source.enabled)
        .map(({ id, disabled_reason }) => ({ id, disabled_reason })),
      fixture_results: fixtures,
    },
  };
}
