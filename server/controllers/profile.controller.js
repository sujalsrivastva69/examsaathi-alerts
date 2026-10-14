import { getProfile, updateProfile } from "../services/profile.service.js";

export async function readProfile(req, res, next) {
  try {
    return res.status(200).json({ profile: await getProfile(req.user.id) });
  } catch (error) {
    return next(error);
  }
}

export async function patchProfile(req, res, next) {
  try {
    return res.status(200).json({
      profile: await updateProfile(req.user.id, req.validated.body),
    });
  } catch (error) {
    return next(error);
  }
}
