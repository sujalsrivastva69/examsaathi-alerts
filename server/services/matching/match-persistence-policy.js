import { evaluateVacancy } from "./evaluate-vacancy.js";

export function isCurrentPublicVacancy(vacancy, today) {
  return (
    vacancy.status === "verified_open" &&
    vacancy.verification_status === "verified" &&
    vacancy.archived_at == null &&
    typeof vacancy.deadline === "string" &&
    vacancy.deadline.slice(0, 10) >= today
  );
}

export function buildCompactMatch(
  userId,
  candidate,
  vacancy,
  evaluatedAt = new Date().toISOString(),
) {
  const result = evaluateVacancy(candidate, vacancy, vacancy.rule_json);
  return {
    user_id: userId,
    vacancy_id: vacancy.id,
    status: result.status,
    missing: result.missing,
    failed: result.failed,
    rules_version: result.rulesVersion,
    evaluated_at: evaluatedAt,
  };
}
