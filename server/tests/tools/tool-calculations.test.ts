import { describe, expect, it } from "vitest";
import {
  calculateAgeDetails,
  calculateAgeOnDate,
  estimateMonthlySalary,
  evaluateAgeLimits,
  validateDimensions,
  validateOfficialSource,
} from "../../../client/src/tools/tool-calculations";
import { documentRuleSets, feeRuleSets, photoPresets, salaryConfig } from "../../../client/src/tools/tool-config";

describe("free-tool calculations and validation", () => {
  it("shares the vacancy matcher's age calculation on an exact birthday", () => {
    expect(calculateAgeOnDate("2000-05-01", "2026-05-01")).toBe(26);
    expect(calculateAgeDetails("2000-05-01", "2026-05-01")).toEqual({
      years: 26,
      months: 0,
      days: 0,
    });
  });

  it("calculates completed years and exact days across leap years", () => {
    expect(calculateAgeDetails("2000-02-29", "2024-02-28")).toEqual({
      years: 23,
      months: 11,
      days: 27,
    });
    expect(calculateAgeDetails("2000-02-29", "2024-03-01")).toEqual({
      years: 24,
      months: 0,
      days: 1,
    });
  });

  it("rejects invalid dates and a cutoff before birth", () => {
    expect(calculateAgeDetails("2001-02-29", "2026-01-01")).toBeNull();
    expect(calculateAgeDetails("2001-01-02", "2001-01-01")).toBeNull();
  });

  it("applies a maximum-age relaxation only when explicitly verified", () => {
    expect(evaluateAgeLimits(35, 18, 30, 5, false)?.withinLimits).toBe(false);
    expect(evaluateAgeLimits(35, 18, 30, 5, true)).toEqual({
      withinLimits: true,
      maximumAllowed: 35,
    });
    expect(evaluateAgeLimits(17, 18, 30, 5, true)?.withinLimits).toBe(false);
    expect(evaluateAgeLimits(20, 30, 18)).toBeNull();
  });

  it("validates dimensions and rejects unsafe output canvases", () => {
    expect(validateDimensions(600, 600)).toBeNull();
    expect(validateDimensions(2.5, 100)).toMatch(/whole numbers/);
    expect(validateDimensions(10_001, 100)).toMatch(/between 1 and 10,000/);
    expect(validateDimensions(7000, 7000)).toMatch(/40-megapixel/);
  });

  it("estimates gross pay and take-home from the entered assumptions", () => {
    expect(
      estimateMonthlySalary({
        basicPay: 50_000,
        daPercent: 10,
        hraPercent: 20,
        transportAllowance: 2_000,
        deductions: [5_000, 1_000],
      }),
    ).toEqual({ gross: 67_000, deductions: 6_000, takeHome: 61_000 });
    expect(
      estimateMonthlySalary({
        basicPay: 50_000,
        daPercent: -1,
        hraPercent: 20,
        transportAllowance: 2_000,
        deductions: [],
      }),
    ).toBeNull();
  });

  it("requires an HTTPS source and valid verification date for rule inputs", () => {
    expect(
      validateOfficialSource({
        label: "Notice",
        url: "https://example.gov.in/notice",
        verifiedOn: "2026-10-15",
      }),
    ).toBe(true);
    expect(
      validateOfficialSource({
        label: "Notice",
        url: "http://example.gov.in/notice",
        verifiedOn: "2026-10-15",
      }),
    ).toBe(false);
    expect(
      validateOfficialSource({
        label: "Notice",
        url: "https://example.gov.in/notice",
        verifiedOn: "2026-02-30",
      }),
    ).toBe(false);
  });

  it("does not present unverified exam rules or photo presets as official", () => {
    expect(documentRuleSets).toEqual([]);
    expect(feeRuleSets).toEqual([]);
    expect(salaryConfig.sources).toEqual([]);
    expect(photoPresets.every((preset) => preset.sourceStatus === "sample" && preset.source === null)).toBe(true);
  });
});
