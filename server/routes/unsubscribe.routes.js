import { Router } from "express";
import rateLimit from "express-rate-limit";
import { showUnsubscribeConfirmation, unsubscribe } from "../controllers/unsubscribe.controller.js";

export const unsubscribeRouter = Router();
unsubscribeRouter.use(
  rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 20,
    standardHeaders: "draft-7",
    legacyHeaders: false,
  }),
);
unsubscribeRouter.get("/:token", showUnsubscribeConfirmation);
unsubscribeRouter.post("/:token", unsubscribe);
