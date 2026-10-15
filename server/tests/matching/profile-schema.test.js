import { describe, expect, it } from "vitest";
import { matchingProfileFields, profilePatchSchema } from "../../utils/profile-schema.js";

describe("optional matching profile fields", () => {
  it("accepts omitted and explicitly empty values", () => {
    expect(matchingProfileFields.parse({})).toEqual({});
    expect(
      matchingProfileFields.parse({
        category: null,
        discipline: null,
        experience_years: null,
      }),
    ).toEqual({
      category: null,
      discipline: null,
      experience_years: null,
    });
  });

  it("accepts supported matching details and trims the discipline", () => {
    expect(
      matchingProfileFields.parse({
        category: "obc",
        discipline: "  Civil Engineering  ",
        experience_years: 4,
      }),
    ).toEqual({
      category: "obc",
      discipline: "Civil Engineering",
      experience_years: 4,
    });
  });

  it.each([
    [{ category: "unknown" }],
    [{ discipline: "x".repeat(101) }],
    [{ discipline: "   " }],
    [{ experience_years: -1 }],
    [{ experience_years: 50.5 }],
    [{ experience_years: 51 }],
  ])("rejects invalid matching details: %o", (input) => {
    expect(matchingProfileFields.safeParse(input).success).toBe(false);
  });

  it("allows a partial matching-only profile update", () => {
    expect(profilePatchSchema.safeParse({ discipline: "Physics" }).success).toBe(true);
    expect(profilePatchSchema.safeParse({}).success).toBe(false);
  });
});
