import { describe, expect, it } from "vitest";
import { calculateAgeOnDate, evaluateVacancy } from "../../services/matching/evaluate-vacancy.js";

const candidate = {
  education: "undergraduate",
  date_of_birth: "1990-01-01",
  state: "Maharashtra",
  discipline: "engineering",
  category: "general",
  experience_years: 3,
};

const vacancy = {
  age_cutoff_date: "2025-01-01",
  deadline: "2026-12-31",
  status: "verified_open",
  verification_status: "verified",
  last_verified_at: "2026-01-01T00:00:00.000Z",
  rules_version: 7,
};

const rules = {
  qualification_level: "undergraduate",
  allowed_disciplines: ["engineering"],
  min_age: 18,
  max_age: 40,
  age_relaxations: { sc: 0, st: 0, obc: 0, ews: 0, pwd: 0, ex_serviceman: 0 },
  domicile_states: ["Maharashtra"],
  min_experience_years: 2,
};

function evaluate(candidateChanges = {}, vacancyChanges = {}, rulesChanges = {}, options = {}) {
  return evaluateVacancy(
    { ...candidate, ...candidateChanges },
    { ...vacancy, ...vacancyChanges },
    { ...rules, ...rulesChanges },
    { asOfDate: "2026-10-14", ...options },
  );
}

describe("evaluateVacancy", () => {
  it("returns a preliminary match when all rules match", () => {
    expect(evaluate().status).toBe("preliminary_match");
  });

  it("returns bilingual reasons for every explanation item", () => {
    const { explanation } = evaluate();
    expect(Object.values(explanation)).toHaveLength(5);
    for (const item of Object.values(explanation)) {
      expect(item.status).toBe("matched");
      expect(item.reason.en).toBeTruthy();
      expect(item.reason.hi).toBeTruthy();
    }
  });

  it("returns the vacancy rules version", () => {
    expect(evaluate().rulesVersion).toBe(7);
  });

  it("matches a candidate with higher education than required", () => {
    expect(evaluate({ education: "postgraduate" }).explanation.qualification.status).toBe(
      "matched",
    );
  });

  it("matches the exact required education", () => {
    expect(evaluate({ education: "undergraduate" }).explanation.qualification.status).toBe(
      "matched",
    );
  });

  it("rejects education below the required level", () => {
    expect(evaluate({ education: "higher_secondary" }).failed).toContain("qualification");
  });

  it("matches an exact diploma requirement", () => {
    expect(evaluate({ education: "diploma" }, {}, { qualification_level: "diploma" }).status).toBe(
      "preliminary_match",
    );
  });

  it("does not treat a diploma as a graduate degree by default", () => {
    expect(
      evaluate({ education: "diploma" }, {}, { qualification_level: "undergraduate" }).failed,
    ).toContain("qualification");
  });

  it("matches ITI only when the rule explicitly requires ITI", () => {
    expect(
      evaluate({ education: "iti" }, {}, { qualification_level: "iti" }).explanation.qualification
        .status,
    ).toBe("matched");
  });

  it("does not treat ITI as an undergraduate degree", () => {
    expect(evaluate({ education: "iti" }).failed).toContain("qualification");
  });

  it("accepts an explicitly equivalent qualification", () => {
    expect(
      evaluate(
        { education: "diploma" },
        {},
        { qualification_level: "undergraduate", equivalent_qualifications: ["diploma"] },
      ).explanation.qualification.status,
    ).toBe("matched");
  });

  it("does not infer equivalence when the rule does not say so", () => {
    expect(evaluate({ education: "diploma" }).failed).toContain("qualification");
  });

  it("marks missing education for review", () => {
    expect(evaluate({ education: undefined }).missing).toContain("qualification");
  });

  it("matches an allowed discipline", () => {
    expect(evaluate({ discipline: "Engineering" }).explanation.discipline.status).toBe("matched");
  });

  it("rejects a wrong discipline", () => {
    expect(evaluate({ discipline: "healthcare" }).failed).toContain("discipline");
  });

  it("marks missing discipline for review when the rule restricts it", () => {
    expect(evaluate({ discipline: undefined }).missing).toContain("discipline");
  });

  it("does not require a discipline when the rule has no discipline restriction", () => {
    expect(
      evaluate({ discipline: undefined }, {}, { allowed_disciplines: [] }).missing,
    ).not.toContain("discipline");
  });

  it("matches a permitted domicile state", () => {
    expect(evaluate().explanation.state.status).toBe("matched");
  });

  it("rejects a non-permitted domicile state", () => {
    expect(evaluate({ state: "Delhi" }).failed).toContain("state");
  });

  it("marks missing state for review when a domicile restriction applies", () => {
    expect(evaluate({ state: undefined }).missing).toContain("state");
  });

  it("does not require state when there is no domicile restriction", () => {
    expect(evaluate({ state: undefined }, {}, { domicile_states: [] }).missing).not.toContain(
      "state",
    );
  });

  it("matches the exact minimum age boundary", () => {
    expect(evaluate({ date_of_birth: "2007-01-01" }).explanation.age.status).toBe("matched");
  });

  it("matches the exact maximum age boundary", () => {
    expect(evaluate({ date_of_birth: "1985-01-01" }).explanation.age.status).toBe("matched");
  });

  it("rejects a candidate one day younger than the minimum age", () => {
    expect(evaluate({ date_of_birth: "2007-01-02" }).failed).toContain("age");
  });

  it("rejects a candidate one day older than the maximum age", () => {
    expect(evaluate({ date_of_birth: "1984-01-01" }).failed).toContain("age");
  });

  it("calculates age on the vacancy cutoff date rather than today", () => {
    const result = evaluate(
      { date_of_birth: "1984-06-01" },
      { age_cutoff_date: "2024-05-31" },
      { min_age: 18, max_age: 40 },
    );
    expect(result.explanation.age.status).toBe("matched");
    expect(result.explanation.age.reason.en).toContain("39");
  });

  it("counts a birthday that falls exactly on the cutoff date", () => {
    expect(calculateAgeOnDate("2000-10-14", "2026-10-14")).toBe(26);
  });

  it("handles a leap-day birthday before its non-leap-year anniversary", () => {
    expect(calculateAgeOnDate("2000-02-29", "2021-02-28")).toBe(20);
  });

  it("increments a leap-day birthday on March 1 in a non-leap year", () => {
    expect(calculateAgeOnDate("2000-02-29", "2021-03-01")).toBe(21);
  });

  it("handles a leap-day birthday on February 29 in a leap year", () => {
    expect(calculateAgeOnDate("2000-02-29", "2024-02-29")).toBe(24);
  });

  it("marks missing date of birth for review", () => {
    expect(evaluate({ date_of_birth: undefined }).missing).toContain("age");
  });

  it("applies an explicit age relaxation for the candidate category", () => {
    const result = evaluate(
      { date_of_birth: "1980-01-01", category: "obc" },
      {},
      { max_age: 40, age_relaxations: { ...rules.age_relaxations, obc: 5 } },
    );
    expect(result.explanation.age.status).toBe("matched");
  });

  it("does not apply a relaxation absent from the rules", () => {
    expect(evaluate({ date_of_birth: "1980-01-01", category: "obc" }).failed).toContain("age");
  });

  it("marks missing category for review when a configured relaxation could apply", () => {
    const result = evaluate(
      { date_of_birth: "1980-01-01", category: undefined },
      {},
      { age_relaxations: { ...rules.age_relaxations, obc: 5 } },
    );
    expect(result.missing).toContain("age");
  });

  it("does not apply another category's relaxation", () => {
    const result = evaluate(
      { date_of_birth: "1980-01-01", category: "sc" },
      {},
      { age_relaxations: { ...rules.age_relaxations, obc: 10 } },
    );
    expect(result.failed).toContain("age");
  });

  it("marks missing experience for review when experience is required", () => {
    expect(evaluate({ experience_years: undefined }).missing).toContain("experience");
  });

  it("rejects insufficient experience", () => {
    expect(evaluate({ experience_years: 1 }).failed).toContain("experience");
  });

  it("expires a vacancy after its deadline", () => {
    expect(evaluate({}, { deadline: "2026-10-13" }).status).toBe("expired");
  });

  it("does not expire a vacancy on the final application date", () => {
    expect(evaluate({}, { deadline: "2026-10-14" }).status).toBe("preliminary_match");
  });

  it("uses a verified extended deadline", () => {
    expect(evaluate({}, { deadline: "2026-11-14" }).status).toBe("preliminary_match");
  });

  it("keeps a vacancy under review when an extension is awaiting verification", () => {
    expect(
      evaluate(
        {},
        { status: "awaiting_verification", deadline: "2026-11-14", last_verified_at: null },
      ).status,
    ).toBe("under_verification");
  });

  it("does not evaluate an unverified vacancy", () => {
    expect(evaluate({}, { verification_status: "pending" }).status).toBe("under_verification");
  });

  it("does not evaluate a vacancy without verification timestamp", () => {
    expect(evaluate({}, { last_verified_at: null }).status).toBe("under_verification");
  });

  it("returns needs_review when multiple candidate facts are missing", () => {
    const result = evaluate({
      education: undefined,
      date_of_birth: undefined,
      discipline: undefined,
      state: undefined,
      experience_years: undefined,
    });
    expect(result.status).toBe("needs_review");
    expect(result.missing).toEqual(["qualification", "age", "discipline", "state", "experience"]);
  });

  it("returns not_matched when a known rule fails even if other data is missing", () => {
    const result = evaluate({ discipline: "healthcare", experience_years: undefined });
    expect(result.status).toBe("not_matched");
    expect(result.failed).toContain("discipline");
    expect(result.missing).toContain("experience");
  });

  it("reports a missing age cutoff as unknown", () => {
    expect(evaluate({}, { age_cutoff_date: null }).missing).toContain("age");
  });

  it("marks a missing vacancy deadline for review", () => {
    const result = evaluate({}, { deadline: null });
    expect(result.status).toBe("needs_review");
    expect(result.missing).toContain("deadline");
  });

  it("marks a missing qualification rule for review", () => {
    expect(evaluate({}, {}, { qualification_level: undefined }).missing).toContain("qualification");
  });

  it("reports an invalid birth date as unknown", () => {
    expect(evaluate({ date_of_birth: "2001-02-29" }).missing).toContain("age");
  });

  it("marks an invalid vacancy deadline for review", () => {
    expect(evaluate({}, { deadline: "2026-02-30" }).missing).toContain("deadline");
  });

  it("supports an explicit rules version supplied with the rules", () => {
    const result = evaluate({}, { rules_version: undefined }, { version: 9 });
    expect(result.rulesVersion).toBe(9);
  });
});
