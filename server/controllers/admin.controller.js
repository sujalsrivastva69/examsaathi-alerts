import {
  approveAndPublishAdminVacancy,
  closeAdminVacancy,
  createAdminVacancy,
  deleteAdminVacancy,
  extendAdminVacancyDeadline,
  getAdminVacancy,
  getAdminVacancies,
  getAdminReviewQueue,
  getFailedAdminNotifications,
  getPreviewMatches,
  importAdminVacancies,
  publishAdminVacancy,
  reopenAdminVacancy,
  rejectIngestedAdminVacancy,
  retryAdminNotification,
  returnAdminVacancyToDraft,
  submitAdminVacancy,
  updateAdminVacancy,
  verifyAdminVacancy,
} from "../services/admin-vacancy.service.js";
import { getIngestionRuns, runIngestionOnce } from "../services/ingestion/ingestion.service.js";

async function respond(operation, req, res, next, status = 200) {
  try {
    return res.status(status).json(await operation(req));
  } catch (error) {
    return next(error);
  }
}

export const listVacancies = (req, res, next) =>
  respond((request) => getAdminVacancies(request.validated.query), req, res, next);
export const listReviewQueue = (req, res, next) =>
  respond(() => getAdminReviewQueue(), req, res, next);
export const runIngestion = (req, res, next) =>
  respond(() => runIngestionOnce({ force: true }), req, res, next);
export const listIngestionRuns = (req, res, next) =>
  respond(() => getIngestionRuns(), req, res, next);
export const listFailedNotifications = (req, res, next) =>
  respond(() => getFailedAdminNotifications(), req, res, next);
export const retryNotification = (req, res, next) =>
  respond((request) => retryAdminNotification(request.validated.params.id), req, res, next);
export const getVacancy = (req, res, next) =>
  respond((request) => getAdminVacancy(request.validated.params.id), req, res, next);
export const createVacancy = (req, res, next) =>
  respond(
    (request) => createAdminVacancy(request.user.id, request.validated.body),
    req,
    res,
    next,
    201,
  );
export const importVacancies = (req, res, next) =>
  respond(
    (request) => importAdminVacancies(request.user.id, request.validated.body.vacancies),
    req,
    res,
    next,
  );
export const deleteVacancy = (req, res, next) =>
  respond(
    (request) => deleteAdminVacancy(request.user.id, request.validated.params.id),
    req,
    res,
    next,
  );
export const rejectIngestedVacancy = (req, res, next) =>
  respond(
    (request) => rejectIngestedAdminVacancy(request.user.id, request.validated.params.id),
    req,
    res,
    next,
  );
export const approvePublishVacancy = (req, res, next) =>
  respond(
    (request) => approveAndPublishAdminVacancy(request.user.id, request.validated.params.id),
    req,
    res,
    next,
  );
export const updateVacancy = (req, res, next) =>
  respond(
    (request) =>
      updateAdminVacancy(request.user.id, request.validated.params.id, request.validated.body),
    req,
    res,
    next,
  );
export const previewMatches = (req, res, next) =>
  respond((request) => getPreviewMatches(request.validated.body), req, res, next);
export const submitVacancy = (req, res, next) =>
  respond(
    (request) => submitAdminVacancy(request.user.id, request.validated.params.id),
    req,
    res,
    next,
  );
export const returnVacancyToDraft = (req, res, next) =>
  respond(
    (request) => returnAdminVacancyToDraft(request.user.id, request.validated.params.id),
    req,
    res,
    next,
  );
export const verifyVacancy = (req, res, next) =>
  respond(
    (request) => verifyAdminVacancy(request.user.id, request.validated.params.id),
    req,
    res,
    next,
  );
export const publishVacancy = (req, res, next) =>
  respond(
    (request) => publishAdminVacancy(request.user.id, request.validated.params.id),
    req,
    res,
    next,
  );
export const closeVacancy = (req, res, next) =>
  respond(
    (request) => closeAdminVacancy(request.user.id, request.validated.params.id),
    req,
    res,
    next,
  );
export const reopenVacancy = (req, res, next) =>
  respond(
    (request) => reopenAdminVacancy(request.user.id, request.validated.params.id),
    req,
    res,
    next,
  );
export const extendVacancyDeadline = (req, res, next) =>
  respond(
    (request) =>
      extendAdminVacancyDeadline(
        request.user.id,
        request.validated.params.id,
        request.validated.body.deadline,
      ),
    req,
    res,
    next,
  );
