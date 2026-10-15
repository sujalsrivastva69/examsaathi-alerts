import { evaluateVacancy } from "./evaluate-vacancy.js";

export function rebuildMatchExplanation(match, profile, vacancy) {
  if (!profile || !vacancy) return match.explanation ?? {};
  return evaluateVacancy(profile, vacancy, vacancy.rule_json).explanation;
}
