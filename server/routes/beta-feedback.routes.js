import { Router } from "express";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import { submitBetaFeedback } from "../controllers/beta-feedback.controller.js";
import { authenticate } from "../middleware/authenticate.js";
import { validateRequest } from "../middleware/validate-request.js";

const feedbackSchema = z
  .object({
    feedback_type: z.enum(["wrong_match", "missed_vacancy", "irrelevant_alert"]),
    vacancy_id: z.string().uuid().nullable().optional(),
    details: z.string().trim().min(10).max(3000),
  })
  .strict();

export const betaFeedbackRouter = Router();
betaFeedbackRouter.use(
  rateLimit({
    windowMs: 60 * 60 * 1000,
    limit: 5,
    standardHeaders: "draft-7",
    legacyHeaders: false,
  }),
);
betaFeedbackRouter.use(authenticate);
betaFeedbackRouter.post("/", validateRequest(feedbackSchema), submitBetaFeedback);
