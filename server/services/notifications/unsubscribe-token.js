import { createHmac, timingSafeEqual } from "node:crypto";

const tokenLifetimeSeconds = 60 * 60 * 24 * 365 * 5;

export function resolveUnsubscribeSecret({ environment, unsubscribeSecret, fallbackSecret }) {
  if (unsubscribeSecret) return unsubscribeSecret;
  if (environment !== "production" && fallbackSecret) return fallbackSecret;
  throw new Error("UNSUBSCRIBE_TOKEN_SECRET must be configured to sign unsubscribe links");
}

function signature(payload, secret) {
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

export function createUnsubscribeToken(userId, secret, now = Date.now()) {
  const payload = Buffer.from(
    JSON.stringify({ sub: userId, exp: Math.floor(now / 1000) + tokenLifetimeSeconds }),
  ).toString("base64url");
  return `${payload}.${signature(payload, secret)}`;
}

export function verifyUnsubscribeToken(token, secret, now = Date.now()) {
  if (typeof token !== "string") return null;
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [payload, suppliedSignature] = parts;
  const expectedSignature = signature(payload, secret);
  const supplied = Buffer.from(suppliedSignature);
  const expected = Buffer.from(expectedSignature);
  if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) return null;

  try {
    const value = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    if (
      typeof value.sub !== "string" ||
      !/^[0-9a-f-]{36}$/i.test(value.sub) ||
      !Number.isInteger(value.exp) ||
      value.exp <= Math.floor(now / 1000)
    ) {
      return null;
    }
    return { userId: value.sub };
  } catch {
    return null;
  }
}
