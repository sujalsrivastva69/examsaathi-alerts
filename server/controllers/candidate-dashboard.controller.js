import {
  getCandidateMatch,
  listCandidateMatches,
  updateCandidateVacancyAction,
} from "../services/candidate-dashboard.service.js";

export async function readCandidateMatches(req, res, next) {
  try {
    return res.status(200).json(await listCandidateMatches(req.user.id));
  } catch (error) {
    return next(error);
  }
}

export async function readCandidateMatch(req, res, next) {
  try {
    return res.status(200).json(await getCandidateMatch(req.user.id, req.validated.params.id));
  } catch (error) {
    return next(error);
  }
}

export async function patchCandidateVacancyAction(req, res, next) {
  try {
    return res
      .status(200)
      .json(
        await updateCandidateVacancyAction(
          req.user.id,
          req.validated.params.id,
          req.validated.body,
        ),
      );
  } catch (error) {
    return next(error);
  }
}
