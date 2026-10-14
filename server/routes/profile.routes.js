import { Router } from "express";
import { patchProfile, readProfile } from "../controllers/profile.controller.js";
import { authenticate } from "../middleware/authenticate.js";
import { validateRequest } from "../middleware/validate-request.js";
import { profilePatchSchema } from "../utils/profile-schema.js";

export const profileRouter = Router();

profileRouter.use(authenticate);
profileRouter.get("/", readProfile);
profileRouter.patch("/", validateRequest(profilePatchSchema), patchProfile);
