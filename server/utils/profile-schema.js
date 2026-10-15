import { z } from "zod";

export const educationLevels = [
  "secondary",
  "higher_secondary",
  "diploma",
  "undergraduate",
  "postgraduate",
  "doctoral",
  "other",
];

export const indianStates = [
  "Andhra Pradesh",
  "Arunachal Pradesh",
  "Assam",
  "Bihar",
  "Chhattisgarh",
  "Goa",
  "Gujarat",
  "Haryana",
  "Himachal Pradesh",
  "Jharkhand",
  "Karnataka",
  "Kerala",
  "Madhya Pradesh",
  "Maharashtra",
  "Manipur",
  "Meghalaya",
  "Mizoram",
  "Nagaland",
  "Odisha",
  "Punjab",
  "Rajasthan",
  "Sikkim",
  "Tamil Nadu",
  "Telangana",
  "Tripura",
  "Uttar Pradesh",
  "Uttarakhand",
  "West Bengal",
  "Andaman and Nicobar Islands",
  "Chandigarh",
  "Dadra and Nagar Haveli and Daman and Diu",
  "Delhi",
  "Jammu and Kashmir",
  "Ladakh",
  "Lakshadweep",
  "Puducherry",
];

export const jobCategories = [
  "administration",
  "banking",
  "defence",
  "education",
  "engineering",
  "healthcare",
  "police",
  "railways",
  "research",
  "other",
];

export const candidateCategories = ["general", "sc", "st", "obc", "ews", "pwd", "ex_serviceman"];

export const matchingProfileFields = z.object({
  category: z.enum(candidateCategories).nullable().optional(),
  discipline: z.string().trim().min(1).max(100).nullable().optional(),
  experience_years: z.number().int().min(0).max(50).nullable().optional(),
});

function hasAgeBetween14And70(dateOfBirth) {
  const [year, month, day] = dateOfBirth.split("-").map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  if (
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() !== month - 1 ||
    parsed.getUTCDate() !== day
  ) {
    return false;
  }

  const today = new Date();
  let age = today.getUTCFullYear() - year;
  const birthdayHasPassed =
    today.getUTCMonth() + 1 > month ||
    (today.getUTCMonth() + 1 === month && today.getUTCDate() >= day);
  if (!birthdayHasPassed) age -= 1;

  return age >= 14 && age <= 70;
}

const dateOfBirthSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Date of birth must use YYYY-MM-DD")
  .refine(hasAgeBetween14And70, "Date of birth must indicate an age between 14 and 70");

export const profileSchema = z.object({
  education: z.enum(educationLevels),
  date_of_birth: dateOfBirthSchema,
  state: z.enum(indianStates),
  job_preferences: z.array(z.enum(jobCategories)).min(1).max(10),
  ...matchingProfileFields.shape,
});

export const profilePatchSchema = z
  .object({
    education: profileSchema.shape.education.optional(),
    date_of_birth: profileSchema.shape.date_of_birth.optional(),
    state: profileSchema.shape.state.optional(),
    job_preferences: profileSchema.shape.job_preferences.optional(),
    ...matchingProfileFields.shape,
  })
  .partial()
  .refine((value) => Object.keys(value).length > 0, "At least one profile field is required");

export const notificationPreferencesSchema = z
  .object({
    email_consent: z.boolean(),
    email_enabled: z.boolean().optional(),
    notify_needs_review: z.boolean().optional(),
    language: z.enum(["en", "hi"]).optional(),
    email_frequency: z.enum(["immediate", "daily", "weekly"]).optional(),
    deadline_reminders_enabled: z.boolean().optional(),
    sms_consent: z.literal(false).optional(),
  })
  .partial()
  .refine((value) => Object.keys(value).length > 0, "At least one preference is required");
