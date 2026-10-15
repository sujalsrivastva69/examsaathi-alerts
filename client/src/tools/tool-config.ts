export interface OfficialSource {
  label: string;
  url: string;
  verifiedOn: string;
}

export interface PayLevelConfig {
  id: string;
  label: string;
  basicPay: number;
  source: OfficialSource;
}

export interface SalaryConfig {
  lastUpdated: string | null;
  sources: OfficialSource[];
  payLevels: PayLevelConfig[];
  daPercent: number | null;
  hraPercentByCity: Record<"x" | "y" | "z", number | null>;
  transportAllowanceByLevel: Array<{ levelId: string; amount: number; source: OfficialSource }>;
  deductions: Array<{ id: string; label: string; amount: number; source: OfficialSource }>;
}

export interface DocumentRule {
  id: string;
  label: string;
  condition: string | null;
  source: OfficialSource;
}

export interface DocumentRuleSet {
  examId: string;
  examLabel: string;
  verifiedOn: string;
  sources: OfficialSource[];
  items: DocumentRule[];
}

export interface FeeRule {
  categoryId: string;
  fee: number | null;
  exemptions: Array<{ condition: string; source: OfficialSource }>;
}

export interface FeeRuleSet {
  examId: string;
  examLabel: string;
  verifiedOn: string;
  sources: OfficialSource[];
  genderConditionsSupported: boolean;
  fees: FeeRule[];
}

export interface PhotoPreset {
  id: string;
  label: string;
  width: number;
  height: number;
  sourceStatus: "verified" | "sample";
  source: OfficialSource | null;
}

// No exam-specific rules or salary figures are loaded until verified official sources are reviewed.
export const salaryConfig: SalaryConfig = {
  lastUpdated: null,
  sources: [],
  payLevels: [],
  daPercent: null,
  hraPercentByCity: { x: null, y: null, z: null },
  transportAllowanceByLevel: [],
  deductions: [],
};

export const documentRuleSets: DocumentRuleSet[] = [];
export const feeRuleSets: FeeRuleSet[] = [];

export const photoPresets: PhotoPreset[] = [
  {
    id: "sample-square",
    label: "Square image — sample only",
    width: 600,
    height: 600,
    sourceStatus: "sample",
    source: null,
  },
  {
    id: "sample-portrait",
    label: "Portrait 35 × 45 mm at 300 DPI — sample only",
    width: 413,
    height: 531,
    sourceStatus: "sample",
    source: null,
  },
];
