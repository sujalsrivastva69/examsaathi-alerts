import cors from "cors";
import express from "express";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import { env } from "./config/env.js";
import { errorHandler } from "./middleware/error-handler.js";
import { notFound } from "./middleware/not-found.js";
import { healthRouter } from "./routes/health.routes.js";
import { profileRouter } from "./routes/profile.routes.js";
import { notificationPreferencesRouter } from "./routes/notification-preferences.routes.js";
import { accountRouter } from "./routes/account.routes.js";
import { adminRouter } from "./routes/admin.routes.js";
import { unsubscribeRouter } from "./routes/unsubscribe.routes.js";
import { vacancyActionRouter } from "./routes/vacancy-action.routes.js";
import { candidateDashboardRouter } from "./routes/candidate-dashboard.routes.js";
import { betaFeedbackRouter } from "./routes/beta-feedback.routes.js";
import { resendWebhookRouter } from "./routes/resend-webhook.routes.js";

export const app = express();

app.disable("x-powered-by");
app.set("trust proxy", env.TRUST_PROXY_HOPS);
app.use(helmet());
app.use(
  cors({
    origin: env.APP_URL,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  }),
);
app.use(
  "/api/webhooks/resend",
  express.raw({ type: "application/json", limit: "64kb" }),
  resendWebhookRouter,
);
app.use(express.json({ limit: "32kb" }));
app.use(
  "/api",
  rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 100,
    standardHeaders: "draft-7",
    legacyHeaders: false,
  }),
);

app.use("/api/health", healthRouter);
app.use("/api/profile", profileRouter);
app.use("/api/notification-preferences", notificationPreferencesRouter);
app.use("/api/unsubscribe", unsubscribeRouter);
app.use("/api/vacancy-actions", vacancyActionRouter);
app.use("/api/matches", candidateDashboardRouter);
app.use("/api/beta-feedback", betaFeedbackRouter);
app.use("/api/account", accountRouter);
app.use("/api/admin/vacancies", adminRouter);
app.use(notFound);
app.use(errorHandler);
