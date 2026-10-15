import { z } from "zod";
import { educationLevels, indianStates } from "../../utils/profile-schema.js";

const nonEmptyText = z.string().trim().min(1).max(1000);
const textValue = z.string().trim().min(1).max(1000).nullable();

function isCalendarDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
  );
}

const dateValue = z
  .string()
  .refine(isCalendarDate, "Date must be a valid YYYY-MM-DD calendar date")
  .nullable();
const ageValue = z.number().int().min(14).max(70).nullable();
const relaxationsValue = z
  .object({
    sc: z.number().int().min(0).max(20).nullable(),
    st: z.number().int().min(0).max(20).nullable(),
    obc: z.number().int().min(0).max(20).nullable(),
    ews: z.number().int().min(0).max(20).nullable(),
    pwd: z.number().int().min(0).max(20).nullable(),
    ex_serviceman: z.number().int().min(0).max(20).nullable(),
  })
  .strict()
  .nullable();
const disciplinesValue = z.array(z.string().trim().min(1).max(100)).max(100).nullable();
const statesValue = z.array(z.enum(indianStates)).max(indianStates.length).nullable();

const field = (value) =>
  z
    .object({
      value,
      source_quote: nonEmptyText.nullable(),
      page_or_section: nonEmptyText.max(200).nullable(),
      confidence: z.number().min(0).max(1),
    })
    .strict()
    .superRefine((entry, context) => {
      if (entry.value === null && entry.source_quote !== null) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["source_quote"],
          message: "A missing value must not include a source quote",
        });
      }
      if (entry.value === null && entry.page_or_section !== null) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["page_or_section"],
          message: "A missing value must not include a source location",
        });
      }
      if (entry.value !== null && entry.source_quote === null) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["source_quote"],
          message: "An extracted value requires an exact source quote",
        });
      }
    });

const extractionFields = {
  recruiting_body: field(textValue),
  department: field(textValue),
  post_title: field(textValue),
  publication_date: field(dateValue),
  application_start_date: field(dateValue),
  application_deadline: field(dateValue),
  age_cutoff_date: field(dateValue),
  min_age: field(ageValue),
  max_age: field(ageValue),
  age_relaxations: field(relaxationsValue),
  education_level: field(z.enum(educationLevels).nullable()),
  allowed_disciplines: field(disciplinesValue),
  domicile_states: field(statesValue),
  experience: field(z.number().int().min(0).max(50).nullable()),
  location_state: field(textValue),
  application_url: field(
    z
      .string()
      .url()
      .refine((value) => new URL(value).protocol === "https:", "Application URL must use HTTPS")
      .nullable(),
  ),
};

export const extractedPostSchema = z.object(extractionFields).strict();
export const extractionResponseSchema = z
  .object({ posts: z.array(extractedPostSchema).min(1) })
  .strict();

export function parseLlmJson(content) {
  try {
    const parsed = JSON.parse(content);
    const result = extractionResponseSchema.safeParse(parsed);
    if (!result.success) {
      const details = result.error.issues
        .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
        .join("; ");
      throw new Error(`LLM output does not match the extraction schema: ${details}`);
    }
    return result.data;
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new Error("LLM returned invalid JSON", { cause: error });
    }
    throw error;
  }
}

export function validateQuotes(post, noticeText) {
  const absentEvidence = [];
  for (const [key, entry] of Object.entries(post)) {
    if (entry.value !== null && !noticeText.includes(entry.source_quote)) {
      absentEvidence.push(key);
    }
    if (entry.page_or_section && !noticeText.includes(entry.page_or_section)) {
      absentEvidence.push(`${key} location`);
    }
  }
  return absentEvidence;
}

export function scoreExtraction(post) {
  const populated = Object.values(post).filter((entry) => entry.value !== null);
  if (populated.length === 0) return 0;
  return Number(
    (populated.reduce((sum, entry) => sum + entry.confidence, 0) / populated.length).toFixed(3),
  );
}

function validDate(value) {
  if (!value) return false;
  const year = Number(value.slice(0, 4));
  return isCalendarDate(value) && year >= 1900 && year <= new Date().getUTCFullYear() + 10;
}

export function validateExtractedPost(post, noticeText, threshold = 0.75) {
  const reasons = [];
  const missingQuotes = validateQuotes(post, noticeText);
  if (missingQuotes.length) {
    reasons.push(`Source evidence was not found verbatim for: ${missingQuotes.join(", ")}`);
  }
  const confidence = scoreExtraction(post);
  if (confidence < threshold) {
    reasons.push(`Overall extraction confidence ${confidence} is below ${threshold}`);
  }
  for (const [key, entry] of Object.entries(post)) {
    if (entry.value !== null && entry.confidence < threshold) {
      reasons.push(`${key} confidence is below ${threshold}`);
    }
  }

  const start = post.application_start_date.value;
  const deadline = post.application_deadline.value;
  const cutoff = post.age_cutoff_date.value;
  const hasAgeRules = post.min_age.value !== null || post.max_age.value !== null;

  for (const key of [
    "publication_date",
    "application_start_date",
    "application_deadline",
    "age_cutoff_date",
  ]) {
    if (post[key].value !== null && !validDate(post[key].value)) {
      reasons.push(`${key} is not a plausible calendar date`);
    }
  }
  if (start && deadline && deadline < start) {
    reasons.push("Application deadline is before the application start date");
  }
  if (post.publication_date.value && start && post.publication_date.value > start) {
    reasons.push("Application start date is before the notice publication date");
  }
  if (hasAgeRules && !cutoff) {
    reasons.push("Age rules are present but the age cutoff date is missing");
  }
  if (hasAgeRules && cutoff && !validDate(cutoff)) {
    reasons.push("Age cutoff date is not a plausible calendar date");
  }
  if (
    post.min_age.value !== null &&
    post.max_age.value !== null &&
    post.min_age.value > post.max_age.value
  ) {
    reasons.push("Minimum age exceeds maximum age");
  }

  return {
    confidence,
    reasons: [...new Set(reasons)],
    status: reasons.length === 0 ? "ready_for_review" : "needs_review",
  };
}
