import { unsubscribeWithToken } from "../services/notifications/unsubscribe.service.js";

export async function showUnsubscribeConfirmation(req, res, next) {
  try {
    res.set("Cache-Control", "no-store");
    return res
      .status(200)
      .type("html")
      .send(
        `<!doctype html><html lang="en"><meta charset="utf-8"><title>Unsubscribe from email alerts</title><main><h1>Unsubscribe from email alerts?</h1><p>Confirm to stop ExamSaathi email alerts.</p><form method="post" action="/api/unsubscribe/${encodeURIComponent(req.params.token)}"><button type="submit">Unsubscribe</button></form></main></html>`,
      );
  } catch (error) {
    return next(error);
  }
}

export async function unsubscribe(req, res, next) {
  try {
    const ok = await unsubscribeWithToken(req.params.token);
    if (!ok) {
      return res.status(400).type("text").send("This unsubscribe link is invalid or expired.");
    }
    res.set("Cache-Control", "no-store");
    return res
      .status(200)
      .type("html")
      .send(
        '<!doctype html><html lang="en"><meta charset="utf-8"><title>Email alerts stopped</title><main><h1>Email alerts stopped</h1><p>You have been unsubscribed from ExamSaathi email alerts.</p></main></html>',
      );
  } catch (error) {
    return next(error);
  }
}
