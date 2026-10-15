import { z } from "zod";

const currentActionStatusSchema = z.enum([
  "saved",
  "interested",
  "application_started",
  "submitted",
  "admit_card_available",
  "exam_appeared",
  "result_declared",
  "next_stage",
  "not_interested",
]);

export const actionStatusSchema = z.preprocess((value) => {
  if (value === "started") return "application_started";
  if (value === "applied") return "submitted";
  return value;
}, currentActionStatusSchema);

export const candidateActionUpdateSchema = z
  .object({
    status: actionStatusSchema,
    notes: z.string().trim().max(2000).nullable().optional(),
  })
  .strict();
