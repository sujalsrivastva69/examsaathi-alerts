import { getPublicVacancy, listPublicVacancies } from "../services/public-vacancy.service.js";

export async function readPublicVacancies(_req, res, next) {
  try {
    return res.status(200).json(await listPublicVacancies());
  } catch (error) {
    return next(error);
  }
}

export async function readPublicVacancy(req, res, next) {
  try {
    return res.status(200).json(await getPublicVacancy(req.validated.params.id));
  } catch (error) {
    return next(error);
  }
}
