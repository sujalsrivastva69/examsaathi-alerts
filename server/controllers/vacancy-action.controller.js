import { updateCandidateVacancyAction } from "../services/candidate-dashboard.service.js";

export async function saveVacancyAction(req, res, next) {
  try {
    await updateCandidateVacancyAction(req.user.id, req.validated.params.id, req.validated.body);
    return res.status(200).json({ status: req.validated.body.status });
  } catch (error) {
    return next(error);
  }
}
