import { Router } from "express";
import {
  patchNotificationPreferences,
  readNotificationPreferences,
} from "../controllers/notification-preferences.controller.js";
import { authenticate } from "../middleware/authenticate.js";
import { validateRequest } from "../middleware/validate-request.js";
import { notificationPreferencesSchema } from "../utils/profile-schema.js";

export const notificationPreferencesRouter = Router();

notificationPreferencesRouter.use(authenticate);
notificationPreferencesRouter.get("/", readNotificationPreferences);
notificationPreferencesRouter.patch(
  "/",
  validateRequest(notificationPreferencesSchema),
  patchNotificationPreferences,
);
