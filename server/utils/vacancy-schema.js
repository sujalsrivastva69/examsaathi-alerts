import { z } from "zod";
import { educationLevels, indianStates } from "./profile-schema.js";

const dateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must use YYYY-MM-DD")
  .refine((value) => {
    const [year, month, day] = value.split("-").map(Number);
    const date = new Date(Date.UTC(year, month - 1, day));
    return (
      date.getUTCFullYear() === year &&
      date.getUTCMonth() === month - 1 &&
      date.getUTCDate() === day
    );
  }, "Enter a valid calendar date");

const httpUrlSchema = z
  .string()
  .url()
  .refine((value) => value.startsWith("https://"), {
    message: "Official URLs must use HTTPS",
  });

export const vacancyRuleSchema = z
  .object({
    qualification_level: z.enum([...educationLevels, "iti"]),
    equivalent_qualifications: z
      .array(z.enum([...educationLevels, "iti"]))
      .max(8)
      .optional(),
    allowed_disciplines: z.array(z.string().trim().min(1).max(100)).max(100),
    min_age: z.number().int().min(14).max(70),
    max_age: z.number().int().min(14).max(70),
    age_relaxations: z
      .object({
        sc: z.number().int().min(0).max(20),
        st: z.number().int().min(0).max(20),
        obc: z.number().int().min(0).max(20),
        ews: z.number().int().min(0).max(20),
        pwd: z.number().int().min(0).max(20),
        ex_serviceman: z.number().int().min(0).max(20),
      })
      .strict(),
    domicile_states: z.array(z.enum(indianStates)).max(indianStates.length),
    min_experience_years: z.number().int().min(0).max(50),
  })
  .strict()
  .refine((rules) => rules.min_age <= rules.max_age, {
    message: "Minimum age must not exceed maximum age",
    path: ["min_age"],
  });

const vacancyFieldsObject = z
  .object({
    title: z.string().trim().min(3).max(200),
    recruiting_organization: z.string().trim().min(2).max(200),
    official_source_url: httpUrlSchema,
    pdf_url: httpUrlSchema.nullable(),
    application_start_date: dateSchema,
    deadline: dateSchema,
    age_cutoff_date: dateSchema,
    rule_json: vacancyRuleSchema,
    verification_checklist: z
      .object({
        source_checked: z.boolean(),
        dates_checked: z.boolean(),
        rules_checked: z.boolean(),
      })
      .strict(),
  })
  .strict();

export const vacancyFieldsSchema = vacancyFieldsObject.refine(
  (value) => value.application_start_date <= value.deadline,
  {
    message: "Application start date must be on or before the deadline",
    path: ["application_start_date"],
  },
);

export const vacancyCreateSchema = vacancyFieldsSchema;
export const vacancyImportSchema = z
  .object({
    vacancies: z.array(vacancyCreateSchema).min(1).max(20),
  })
  .strict();
export const vacancyPatchSchema = vacancyFieldsObject
  .partial()
  .strict()
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one vacancy field is required",
  });

export const vacancyIdParamsSchema = z.object({ id: z.string().uuid() }).strict();
export const vacancyListQuerySchema = z
  .object({
    status: z.enum(["draft", "awaiting_verification", "verified_open", "closed"]).optional(),
    deadline_soon: z.enum(["true", "false"]).optional(),
  })
  .strict();
export const extendDeadlineSchema = z.object({ deadline: dateSchema }).strict();
export const previewSchema = z
  .object({
    age_cutoff_date: dateSchema,
    rule_json: vacancyRuleSchema,
  })
  .strict();
