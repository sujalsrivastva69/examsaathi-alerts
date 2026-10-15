import { describe, expect, it } from "vitest";
import { candidateActionUpdateSchema } from "../../utils/candidate-action-schema.js";

describe("candidate tracker updates", () => {
  it.each([
    "saved",
    "interested",
    "application_started",
    "submitted",
    "admit_card_available",
    "exam_appeared",
    "result_declared",
    "next_stage",
    "not_interested",
  ])("accepts the %s lifecycle status", (status) => {
    expect(candidateActionUpdateSchema.safeParse({ status }).success).toBe(true);
  });

  it("accepts bounded optional notes and normalizes whitespace", () => {
    expect(
      candidateActionUpdateSchema.parse({
        status: "saved",
        notes: "  Keep a copy of the application  ",
      }).notes,
    ).toBe("Keep a copy of the application");
  });

  it.each([
    ["started", "application_started"],
    ["applied", "submitted"],
  ])("maps legacy status %s to %s", (legacyStatus, status) => {
    expect(candidateActionUpdateSchema.parse({ status: legacyStatus }).status).toBe(status);
  });

  it("rejects overlong notes, unknown statuses, and unexpected fields", () => {
    expect(
      candidateActionUpdateSchema.safeParse({ status: "submitted", notes: "x".repeat(2001) })
        .success,
    ).toBe(false);
    expect(candidateActionUpdateSchema.safeParse({ status: "unknown" }).success).toBe(false);
    expect(candidateActionUpdateSchema.safeParse({ status: "saved", phone: "123" }).success).toBe(
      false,
    );
  });
});
