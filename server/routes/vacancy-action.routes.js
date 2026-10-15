import { Router } from "express";
import { saveVacancyAction } from "../controllers/vacancy-action.controller.js";
import { authenticate } from "../middleware/authenticate.js";
import { validateRequest } from "../middleware/validate-request.js";
import { candidateActionUpdateSchema } from "../utils/candidate-action-schema.js";
import { vacancyIdParamsSchema } from "../utils/vacancy-schema.js";

export const vacancyActionRouter = Router();
vacancyActionRouter.use(authenticate);
vacancyActionRouter.put(
  "/:id",
  validateRequest(vacancyIdParamsSchema, "params"),
  validateRequest(candidateActionUpdateSchema),
  saveVacancyAction,
);
