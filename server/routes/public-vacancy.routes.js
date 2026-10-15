import { Router } from "express";
import {
  readPublicVacancy,
  readPublicVacancies,
} from "../controllers/public-vacancy.controller.js";
import { validateRequest } from "../middleware/validate-request.js";
import { vacancyIdParamsSchema } from "../utils/vacancy-schema.js";

export const publicVacancyRouter = Router();

publicVacancyRouter.get(
  "/:id",
  validateRequest(vacancyIdParamsSchema, "params"),
  readPublicVacancy,
);
publicVacancyRouter.get("/", readPublicVacancies);
