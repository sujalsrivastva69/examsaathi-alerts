import {
  getNotificationPreferences,
  updateNotificationPreferences,
} from "../services/notification-preferences.service.js";

export async function readNotificationPreferences(req, res, next) {
  try {
    return res.status(200).json({
      preferences: await getNotificationPreferences(req.user.id),
    });
  } catch (error) {
    return next(error);
  }
}

export async function patchNotificationPreferences(req, res, next) {
  try {
    return res.status(200).json({
      preferences: await updateNotificationPreferences(req.user.id, req.validated.body),
    });
  } catch (error) {
    return next(error);
  }
}
