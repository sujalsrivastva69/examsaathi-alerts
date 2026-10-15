import { Router } from "express";
import {
  patchCandidateVacancyAction,
  readCandidateMatch,
  readCandidateMatches,
} from "../controllers/candidate-dashboard.controller.js";
import { authenticate } from "../middleware/authenticate.js";
import { validateRequest } from "../middleware/validate-request.js";
import { vacancyIdParamsSchema } from "../utils/vacancy-schema.js";
import { candidateActionUpdateSchema } from "../utils/candidate-action-schema.js";

export const candidateDashboardRouter = Router();
candidateDashboardRouter.use(authenticate);
candidateDashboardRouter.get("/", readCandidateMatches);
candidateDashboardRouter.get(
  "/:id",
  validateRequest(vacancyIdParamsSchema, "params"),
  readCandidateMatch,
);
candidateDashboardRouter.put(
  "/:id/action",
  validateRequest(vacancyIdParamsSchema, "params"),
  validateRequest(candidateActionUpdateSchema),
  patchCandidateVacancyAction,
);
