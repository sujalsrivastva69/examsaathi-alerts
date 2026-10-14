const educationRanks = {
  secondary: 0,
  higher_secondary: 1,
  undergraduate: 2,
  postgraduate: 3,
  doctoral: 3,
};

const relaxationCategories = ["sc", "st", "obc", "ews", "pwd", "ex_serviceman"];

function isValidDate(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  return (
    parsed.getUTCFullYear() === year &&
    parsed.getUTCMonth() === month - 1 &&
    parsed.getUTCDate() === day
  );
}

function dateInIndia() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  return `${values.year}-${values.month}-${values.day}`;
}

export function calculateAgeOnDate(dateOfBirth, cutoffDate) {
  if (!isValidDate(dateOfBirth) || !isValidDate(cutoffDate)) return null;
  const [birthYear, birthMonth, birthDay] = dateOfBirth.split("-").map(Number);
  const [cutoffYear, cutoffMonth, cutoffDay] = cutoffDate.split("-").map(Number);
  const birthdayNotReached =
    cutoffMonth < birthMonth || (cutoffMonth === birthMonth && cutoffDay < birthDay);
  return cutoffYear - birthYear - (birthdayNotReached ? 1 : 0);
}

function result(status, reasonEn, reasonHi) {
  return { status, reason: { en: reasonEn, hi: reasonHi } };
}

function unknown(reasonEn, reasonHi) {
  return result("unknown", reasonEn, reasonHi);
}

function normalize(value) {
  return typeof value === "string" ? value.trim().toLocaleLowerCase("en") : "";
}

function checkQualification(candidate, rules) {
  const required = rules?.qualification_level;
  const level = candidate?.qualification_level ?? candidate?.education;
  if (!required) {
    return unknown(
      "Qualification requirement is missing from the rules.",
      "नियमों में आवश्यक योग्यता नहीं दी गई है।",
    );
  }
  if (!level) {
    return unknown("Candidate qualification is missing.", "उम्मीदवार की योग्यता उपलब्ध नहीं है।");
  }
  if (level === "other" || required === "other") {
    if (level === required) {
      return unknown(
        "The qualification is marked as other and needs manual review.",
        "योग्यता 'अन्य' के रूप में दी गई है; मैन्युअल समीक्षा आवश्यक है।",
      );
    }
    return result(
      "not_matched",
      "The candidate's qualification does not establish the required qualification.",
      "उम्मीदवार की योग्यता से आवश्यक योग्यता सिद्ध नहीं होती है।",
    );
  }
  if (level === required) {
    return result(
      "matched",
      "The candidate has the required qualification.",
      "उम्मीदवार के पास आवश्यक योग्यता है।",
    );
  }
  if (rules.equivalent_qualifications?.includes(level)) {
    return result(
      "matched",
      "The rules explicitly accept this qualification as equivalent.",
      "नियम इस योग्यता को स्पष्ट रूप से समकक्ष मानते हैं।",
    );
  }

  const candidateRank = educationRanks[level];
  const requiredRank = educationRanks[required];
  if (candidateRank !== undefined && requiredRank !== undefined) {
    if (candidateRank >= requiredRank) {
      return result(
        "matched",
        "The candidate's education meets or exceeds the required level.",
        "उम्मीदवार की शिक्षा आवश्यक स्तर के बराबर या उससे अधिक है।",
      );
    }
    return result(
      "not_matched",
      "The candidate's education is below the required level.",
      "उम्मीदवार की शिक्षा आवश्यक स्तर से कम है।",
    );
  }

  if (level === "diploma" || level === "iti" || required === "diploma" || required === "iti") {
    return result(
      "not_matched",
      "Diploma and ITI qualifications are treated separately; no equivalence is stated in the rules.",
      "डिप्लोमा और ITI योग्यताओं को अलग माना जाता है; नियमों में समकक्षता नहीं दी गई है।",
    );
  }
  return unknown(
    "The qualification relationship is unclear and needs review.",
    "योग्यताओं का संबंध स्पष्ट नहीं है; समीक्षा आवश्यक है।",
  );
}

function checkAge(candidate, vacancy, rules) {
  const dateOfBirth = candidate?.date_of_birth;
  const cutoffDate = vacancy?.age_cutoff_date;
  if (!dateOfBirth) {
    return unknown("Candidate date of birth is missing.", "उम्मीदवार की जन्मतिथि उपलब्ध नहीं है।");
  }
  if (!cutoffDate || !isValidDate(cutoffDate)) {
    return unknown(
      "The vacancy age cutoff date is missing or invalid.",
      "भर्ती की आयु-गणना की कटऑफ तिथि उपलब्ध नहीं है या अमान्य है।",
    );
  }
  const age = calculateAgeOnDate(dateOfBirth, cutoffDate);
  if (age === null || age < 0) {
    return unknown(
      "Candidate date of birth is invalid or after the cutoff date.",
      "उम्मीदवार की जन्मतिथि अमान्य है या कटऑफ तिथि के बाद है।",
    );
  }

  const minAge = rules?.min_age;
  const maxAge = rules?.max_age;
  if (!Number.isInteger(minAge) || !Number.isInteger(maxAge) || minAge > maxAge) {
    return unknown(
      "The age limits are missing or invalid in the rules.",
      "नियमों में आयु सीमा उपलब्ध नहीं है या अमान्य है।",
    );
  }
  if (age < minAge) {
    return result(
      "not_matched",
      `Candidate is ${age}, below the minimum age of ${minAge} on the cutoff date.`,
      `कटऑफ तिथि पर उम्मीदवार की आयु ${age} वर्ष है, जो न्यूनतम ${minAge} वर्ष से कम है।`,
    );
  }
  if (age <= maxAge) {
    return result(
      "matched",
      `Candidate is ${age}, within the ${minAge}–${maxAge} year age range on the cutoff date.`,
      `कटऑफ तिथि पर उम्मीदवार की आयु ${age} वर्ष है, जो ${minAge}–${maxAge} वर्ष की सीमा में है।`,
    );
  }

  const relaxations = rules.age_relaxations;
  const hasExplicitRelaxation =
    relaxations &&
    relaxationCategories.some(
      (category) => Number.isInteger(relaxations[category]) && relaxations[category] > 0,
    );
  const category = normalize(candidate.category);
  if (!category && hasExplicitRelaxation) {
    return unknown(
      "Candidate category is needed to determine whether an explicit age relaxation applies.",
      "स्पष्ट आयु छूट लागू होती है या नहीं, यह जानने के लिए उम्मीदवार की श्रेणी आवश्यक है।",
    );
  }
  if (!relaxationCategories.includes(category)) {
    return result(
      "not_matched",
      `Candidate is ${age}, above the maximum age of ${maxAge}; no applicable relaxation is established.`,
      `उम्मीदवार की आयु ${age} वर्ष है, जो अधिकतम ${maxAge} वर्ष से अधिक है; लागू छूट सिद्ध नहीं है।`,
    );
  }

  const relaxation = relaxations?.[category];
  if (!Number.isInteger(relaxation) || relaxation <= 0) {
    return result(
      "not_matched",
      `Candidate is ${age}, above the maximum age of ${maxAge}, and no relaxation is specified for this category.`,
      `उम्मीदवार की आयु ${age} वर्ष अधिकतम ${maxAge} वर्ष से अधिक है और इस श्रेणी के लिए छूट निर्दिष्ट नहीं है।`,
    );
  }
  if (age <= maxAge + relaxation) {
    return result(
      "matched",
      `Candidate is ${age}; the rules explicitly allow ${relaxation} years of relaxation for this category.`,
      `उम्मीदवार की आयु ${age} वर्ष है; नियम इस श्रेणी के लिए स्पष्ट रूप से ${relaxation} वर्ष की छूट देते हैं।`,
    );
  }
  return result(
    "not_matched",
    `Candidate is ${age}, above the maximum age of ${maxAge} even with the ${relaxation}-year relaxation.`,
    `उम्मीदवार की आयु ${age} वर्ष है, जो ${relaxation} वर्ष की छूट के बाद भी अधिकतम ${maxAge} वर्ष से अधिक है।`,
  );
}

function checkDiscipline(candidate, rules) {
  const allowed = rules?.allowed_disciplines;
  if (!Array.isArray(allowed)) {
    return unknown(
      "Allowed disciplines are missing from the rules.",
      "नियमों में अनुमत विषय उपलब्ध नहीं हैं।",
    );
  }
  if (allowed.length === 0) {
    return result(
      "matched",
      "The rules do not restrict the candidate's discipline.",
      "नियम उम्मीदवार के विषय पर कोई प्रतिबंध नहीं लगाते हैं।",
    );
  }
  const discipline = candidate?.discipline;
  if (!discipline) {
    return unknown("Candidate discipline is missing.", "उम्मीदवार का विषय उपलब्ध नहीं है।");
  }
  if (allowed.some((value) => normalize(value) === normalize(discipline))) {
    return result(
      "matched",
      "The candidate's discipline is allowed by the rules.",
      "नियमों के अनुसार उम्मीदवार का विषय अनुमत है।",
    );
  }
  return result(
    "not_matched",
    "The candidate's discipline is not in the allowed list.",
    "उम्मीदवार का विषय अनुमत सूची में नहीं है।",
  );
}

function checkState(candidate, rules) {
  const allowed = rules?.domicile_states;
  if (!Array.isArray(allowed)) {
    return unknown(
      "Domicile requirements are missing from the rules.",
      "नियमों में अधिवास संबंधी जानकारी उपलब्ध नहीं है।",
    );
  }
  if (allowed.length === 0) {
    return result(
      "matched",
      "The rules do not restrict domicile state.",
      "नियम अधिवास राज्य पर कोई प्रतिबंध नहीं लगाते हैं।",
    );
  }
  const state = candidate?.state;
  if (!state) {
    return unknown("Candidate state is missing.", "उम्मीदवार का राज्य उपलब्ध नहीं है।");
  }
  if (allowed.some((value) => normalize(value) === normalize(state))) {
    return result(
      "matched",
      "The candidate's state meets the domicile requirement.",
      "उम्मीदवार का राज्य अधिवास की आवश्यकता पूरी करता है।",
    );
  }
  return result(
    "not_matched",
    "The candidate's state is not in the allowed domicile list.",
    "उम्मीदवार का राज्य अनुमत अधिवास सूची में नहीं है।",
  );
}

function checkExperience(candidate, rules) {
  const minimum = rules?.min_experience_years;
  if (!Number.isInteger(minimum) || minimum < 0) {
    return unknown(
      "The minimum experience requirement is missing or invalid.",
      "न्यूनतम अनुभव की आवश्यकता उपलब्ध नहीं है या अमान्य है।",
    );
  }
  if (minimum === 0) {
    return result(
      "matched",
      "The rules do not require prior experience.",
      "नियमों में पूर्व अनुभव आवश्यक नहीं है।",
    );
  }
  const experience = candidate?.experience_years;
  if (!Number.isFinite(experience) || experience < 0) {
    return unknown("Candidate experience is missing.", "उम्मीदवार का अनुभव उपलब्ध नहीं है।");
  }
  if (experience >= minimum) {
    return result(
      "matched",
      `Candidate has ${experience} years of experience; ${minimum} are required.`,
      `उम्मीदवार के पास ${experience} वर्ष का अनुभव है; ${minimum} वर्ष आवश्यक हैं।`,
    );
  }
  return result(
    "not_matched",
    `Candidate has ${experience} years of experience; ${minimum} are required.`,
    `उम्मीदवार के पास ${experience} वर्ष का अनुभव है; ${minimum} वर्ष आवश्यक हैं।`,
  );
}

function rulesVersion(vacancy, rules) {
  const version = vacancy?.rules_version ?? rules?.rules_version ?? rules?.version ?? 1;
  return Number.isInteger(version) && version > 0 ? version : 1;
}

export function evaluateVacancy(candidate, vacancy, rules, { asOfDate = dateInIndia() } = {}) {
  const version = rulesVersion(vacancy, rules);
  const explanation = {
    qualification: unknown(
      "Eligibility cannot be assessed until the vacancy is verified.",
      "भर्ती सत्यापित होने तक योग्यता का आकलन नहीं किया जा सकता।",
    ),
    age: unknown(
      "Eligibility cannot be assessed until the vacancy is verified.",
      "भर्ती सत्यापित होने तक आयु का आकलन नहीं किया जा सकता।",
    ),
    discipline: unknown(
      "Eligibility cannot be assessed until the vacancy is verified.",
      "भर्ती सत्यापित होने तक विषय का आकलन नहीं किया जा सकता।",
    ),
    state: unknown(
      "Eligibility cannot be assessed until the vacancy is verified.",
      "भर्ती सत्यापित होने तक राज्य का आकलन नहीं किया जा सकता।",
    ),
    experience: unknown(
      "Eligibility cannot be assessed until the vacancy is verified.",
      "भर्ती सत्यापित होने तक अनुभव का आकलन नहीं किया जा सकता।",
    ),
  };
  const base = { explanation, missing: [], failed: [], rulesVersion: version };

  if (
    vacancy?.status !== "verified_open" ||
    vacancy?.verification_status !== "verified" ||
    !vacancy?.last_verified_at
  ) {
    return { status: "under_verification", ...base };
  }
  if (
    vacancy.deadline &&
    isValidDate(vacancy.deadline) &&
    isValidDate(asOfDate) &&
    asOfDate > vacancy.deadline
  ) {
    return { status: "expired", ...base };
  }

  explanation.qualification = checkQualification(candidate, rules);
  explanation.age = checkAge(candidate, vacancy, rules);
  explanation.discipline = checkDiscipline(candidate, rules);
  explanation.state = checkState(candidate, rules);
  explanation.experience = checkExperience(candidate, rules);

  const missing = Object.entries(explanation)
    .filter(([, item]) => item.status === "unknown")
    .map(([field]) => field);
  if (!isValidDate(vacancy?.deadline) || !isValidDate(asOfDate)) missing.push("deadline");
  const failed = Object.entries(explanation)
    .filter(([, item]) => item.status === "not_matched")
    .map(([field]) => field);
  const status = failed.length
    ? "not_matched"
    : missing.length
      ? "needs_review"
      : "preliminary_match";
  return { status, explanation, missing, failed, rulesVersion: version };
}
