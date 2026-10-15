import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  TRUST_PROXY_HOPS: z.coerce.number().int().min(0).max(5).default(0),
  APP_URL: z.string().url(),
  API_URL: z.preprocess((value) => (value === "" ? undefined : value), z.string().url().optional()),
  SUPABASE_URL: z.string().url(),
  SUPABASE_ANON_KEY: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  RESEND_API_KEY: z.string().min(1),
  LLM_PROVIDER: z.enum(["openai", "openai-compatible"]).default("openai"),
  LLM_API_KEY: z.preprocess((value) => (value === "" ? undefined : value), z.string().optional()),
  LLM_MODEL: z.string().min(1).default("gpt-4o-mini"),
  LLM_BASE_URL: z.preprocess(
    (value) => (value === "" ? undefined : value),
    z.string().url().optional(),
  ),
  GOOGLE_CLOUD_VISION_API_KEY: z.preprocess(
    (value) => (value === "" ? undefined : value),
    z.string().min(1).optional(),
  ),
  INGESTION_DRY_RUN: z
    .enum(["true", "false"])
    .default("true")
    .transform((value) => value === "true"),
  INGESTION_CRON: z.string().default("0 */4 * * *"),
  ADMIN_ALERT_EMAIL: z.preprocess(
    (value) => (value === "" ? undefined : value),
    z.string().email().optional(),
  ),
  RESEND_FROM_EMAIL: z.string().email().default("onboarding@resend.dev"),
  RESEND_WEBHOOK_SECRET: z.preprocess(
    (value) => (value === "" ? undefined : value),
    z
      .string()
      .regex(/^whsec_[A-Za-z0-9+/=]+$/)
      .optional(),
  ),
  NOTIFICATION_DRY_RUN: z
    .enum(["true", "false"])
    .default("true")
    .transform((value) => value === "true"),
  NOTIFICATION_CRON: z.string().default("*/5 * * * *"),
  TRACKER_LIFECYCLE_ENABLED: z
    .enum(["true", "false"])
    .default("false")
    .transform((value) => value === "true"),
  LOCAL_VIEW_MODE: z
    .enum(["true", "false"])
    .default("false")
    .transform((value) => value === "true"),
  PROFILE_MATCHING_FIELDS_ENABLED: z
    .enum(["true", "false"])
    .default("false")
    .transform((value) => value === "true"),
  UNSUBSCRIBE_TOKEN_SECRET: z.preprocess(
    (value) => (value === "" ? undefined : value),
    z.string().min(32).optional(),
  ),
});

const result = envSchema.safeParse(process.env);

if (!result.success) {
  const details = result.error.issues
    .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
    .join("\n");
  throw new Error(`Invalid server environment configuration:\n${details}`);
}

export const env = result.data;
