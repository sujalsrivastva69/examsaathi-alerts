export type MatchStatus = "preliminary_match" | "needs_review";
export const actionStatuses = [
  "saved",
  "interested",
  "application_started",
  "submitted",
  "admit_card_available",
  "exam_appeared",
  "result_declared",
  "next_stage",
  "not_interested",
] as const;
export const legacyActionStatuses = ["interested", "started", "applied", "not_interested"] as const;
export type ActionStatus = (typeof actionStatuses)[number] | (typeof legacyActionStatuses)[number];

export type Vacancy = {
  id: string;
  title: string;
  recruiting_organization: string;
  official_source_url: string;
  application_url: string;
  location_state: string | null;
  sectors: string[];
  pdf_url: string | null;
  application_start_date: string;
  deadline: string;
  age_cutoff_date: string;
  rule_json: {
    domicile_states?: string[];
    allowed_disciplines?: string[];
  };
  last_verified_at: string | null;
};

export type ExplanationItem = {
  status: "matched" | "not_matched" | "unknown";
  reason: { en: string; hi: string };
};

export type CandidateMatch = {
  vacancy_id: string;
  status: MatchStatus;
  explanation: Record<string, ExplanationItem>;
  missing: string[];
  failed: string[];
  rules_version: number;
  evaluated_at: string;
  vacancy: Vacancy;
  action: { status: ActionStatus; notes: string | null; updated_at: string } | null;
};

export type MatchDetail = {
  trackerLifecycleEnabled: boolean;
  match: CandidateMatch;
  changes: Array<{
    id: number;
    field_name: string;
    old_value: unknown;
    new_value: unknown;
    changed_at: string;
  }>;
  action: { status: ActionStatus; notes: string | null; updated_at: string } | null;
  actionHistory: Array<{
    id: number;
    previous_status: ActionStatus | null;
    status: ActionStatus;
    changed_at: string;
  }>;
};
