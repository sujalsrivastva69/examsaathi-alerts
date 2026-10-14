import { Router } from "express";
import rateLimit from "express-rate-limit";
import { receiveResendWebhook } from "../controllers/resend-webhook.controller.js";

export const resendWebhookRouter = Router();
resendWebhookRouter.use(
  rateLimit({
    windowMs: 60 * 1000,
    limit: 60,
    standardHeaders: "draft-7",
    legacyHeaders: false,
  }),
);
resendWebhookRouter.post("/", receiveResendWebhook);
