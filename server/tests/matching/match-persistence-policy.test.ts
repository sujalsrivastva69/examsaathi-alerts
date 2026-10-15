import { describe, expect, it } from "vitest";
import {
  buildCompactMatch,
  isCurrentPublicVacancy,
} from "../../services/matching/match-persistence-policy.js";
import { rebuildMatchExplanation } from "../../services/matching/match-explanation.js";

const vacancy = {
  id: "vacancy-1",
  rules_version: 3,
  rule_json: {
    qualification_level: "undergraduate",
    allowed_disciplines: [],
    min_age: 18,
    max_age: 50,
    age_relaxations: {},
    domicile_states: [],
    min_experience_years: 0,
  },
  age_cutoff_date: "2026-01-01",
  deadline: "2026-12-31",
  status: "verified_open",
  verification_status: "verified",
  last_verified_at: "2026-10-01T00:00:00.000Z",
  archived_at: null,
};

describe("match persistence policy", () => {
  it("only reevaluates verified, open, unarchived vacancies with a current deadline", () => {
    expect(isCurrentPublicVacancy(vacancy, "2026-10-15")).toBe(true);
    expect(isCurrentPublicVacancy({ ...vacancy, status: "closed" }, "2026-10-15")).toBe(false);
    expect(
      isCurrentPublicVacancy({ ...vacancy, verification_status: "pending" }, "2026-10-15"),
    ).toBe(false);
    expect(isCurrentPublicVacancy({ ...vacancy, archived_at: "2026-10-01" }, "2026-10-15")).toBe(
      false,
    );
    expect(isCurrentPublicVacancy({ ...vacancy, deadline: "2026-10-14" }, "2026-10-15")).toBe(
      false,
    );
  });

  it("persists compact evaluation fields without bilingual explanation content", () => {
    const candidate = {
      education: "undergraduate",
      date_of_birth: "1990-01-01",
      state: "Maharashtra",
    };
    const match = buildCompactMatch("user-1", candidate, vacancy, "2026-10-15T00:00:00.000Z");

    expect(match).toMatchObject({
      user_id: "user-1",
      vacancy_id: "vacancy-1",
      status: "preliminary_match",
      missing: [],
      failed: [],
      rules_version: 3,
    });
    expect(match).not.toHaveProperty("explanation");
  });

  it("rebuilds explanations at read time and keeps legacy rows readable without a profile", () => {
    const legacyExplanation = { qualification: { status: "matched" } };
    const match = { explanation: legacyExplanation };
    const candidate = {
      education: "undergraduate",
      date_of_birth: "1990-01-01",
      state: "Maharashtra",
    };

    expect(rebuildMatchExplanation(match, candidate, vacancy).qualification.status).toBe("matched");
    expect(rebuildMatchExplanation(match, null, vacancy)).toBe(legacyExplanation);
    expect(rebuildMatchExplanation({ explanation: null }, null, vacancy)).toEqual({});
  });
});
