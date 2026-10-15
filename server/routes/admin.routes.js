import { Router } from "express";
import {
  closeVacancy,
  createVacancy,
  deleteVacancy,
  extendVacancyDeadline,
  getVacancy,
  importVacancies,
  listIngestionRuns,
  listReviewQueue,
  listFailedNotifications,
  listVacancies,
  previewMatches,
  publishVacancy,
  rejectIngestedVacancy,
  reopenVacancy,
  returnVacancyToDraft,
  runIngestion,
  retryNotification,
  approvePublishVacancy,
  submitVacancy,
  updateVacancy,
  verifyVacancy,
} from "../controllers/admin.controller.js";
import { authenticate } from "../middleware/authenticate.js";
import { requireAdmin } from "../middleware/require-admin.js";
import { validateRequest } from "../middleware/validate-request.js";
import {
  extendDeadlineSchema,
  previewSchema,
  vacancyCreateSchema,
  vacancyIdParamsSchema,
  vacancyImportSchema,
  vacancyListQuerySchema,
  vacancyPatchSchema,
} from "../utils/vacancy-schema.js";

export const adminRouter = Router();

adminRouter.use(authenticate, requireAdmin);
adminRouter.get("/ingestion/review-queue", listReviewQueue);
adminRouter.get("/ingestion/runs", listIngestionRuns);
adminRouter.post("/ingestion/run", runIngestion);
adminRouter.get("/notifications/failed", listFailedNotifications);
adminRouter.post(
  "/notifications/:id/retry",
  validateRequest(vacancyIdParamsSchema, "params"),
  retryNotification,
);
adminRouter.get("/", validateRequest(vacancyListQuerySchema, "query"), listVacancies);
adminRouter.post("/import", validateRequest(vacancyImportSchema), importVacancies);
adminRouter.post("/", validateRequest(vacancyCreateSchema), createVacancy);
adminRouter.post("/preview-matches", validateRequest(previewSchema), previewMatches);
adminRouter.get("/:id", validateRequest(vacancyIdParamsSchema, "params"), getVacancy);
adminRouter.post(
  "/:id/approve-publish",
  validateRequest(vacancyIdParamsSchema, "params"),
  approvePublishVacancy,
);
adminRouter.post(
  "/:id/reject",
  validateRequest(vacancyIdParamsSchema, "params"),
  rejectIngestedVacancy,
);
adminRouter.delete("/:id", validateRequest(vacancyIdParamsSchema, "params"), deleteVacancy);
adminRouter.patch(
  "/:id",
  validateRequest(vacancyIdParamsSchema, "params"),
  validateRequest(vacancyPatchSchema),
  updateVacancy,
);
adminRouter.post("/:id/submit", validateRequest(vacancyIdParamsSchema, "params"), submitVacancy);
adminRouter.post(
  "/:id/return-to-draft",
  validateRequest(vacancyIdParamsSchema, "params"),
  returnVacancyToDraft,
);
adminRouter.post("/:id/verify", validateRequest(vacancyIdParamsSchema, "params"), verifyVacancy);
adminRouter.post("/:id/publish", validateRequest(vacancyIdParamsSchema, "params"), publishVacancy);
adminRouter.post("/:id/close", validateRequest(vacancyIdParamsSchema, "params"), closeVacancy);
adminRouter.post("/:id/reopen", validateRequest(vacancyIdParamsSchema, "params"), reopenVacancy);
adminRouter.post(
  "/:id/extend-deadline",
  validateRequest(vacancyIdParamsSchema, "params"),
  validateRequest(extendDeadlineSchema),
  extendVacancyDeadline,
);
