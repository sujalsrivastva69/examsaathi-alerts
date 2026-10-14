import { createHash } from "node:crypto";

export function notificationIdempotencyKey(userId, vacancyId, notificationType, rulesVersion) {
  const value = [userId, vacancyId, notificationType, rulesVersion].join(":");
  return createHash("sha256").update(value).digest("hex");
}
