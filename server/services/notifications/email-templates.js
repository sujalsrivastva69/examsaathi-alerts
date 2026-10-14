const copy = {
  en: {
    new_vacancy: {
      subject: "A government vacancy may match your profile: {{post}}",
      heading: "A vacancy may match your profile",
      matched: "Why it matched",
      review: "Why it needs review",
      official: "Official notification",
      apply: "Application link",
      verified: "Last verified",
      disclaimer:
        "This is a preliminary match, not a promise of eligibility. The official notice is final.",
    },
    deadline_reminder_3d: {
      subject: "Deadline in 3 days: {{post}}",
      heading: "Application deadline in 3 days",
      matched: "Why it matched",
      review: "Why it needs review",
      official: "Official notification",
      apply: "Application link",
      verified: "Last verified",
      disclaimer:
        "This is a preliminary match, not a promise of eligibility. The official notice is final.",
    },
    deadline_reminder_1d: {
      subject: "Deadline tomorrow: {{post}}",
      heading: "Application deadline is tomorrow",
      matched: "Why it matched",
      review: "Why it needs review",
      official: "Official notification",
      apply: "Application link",
      verified: "Last verified",
      disclaimer:
        "This is a preliminary match, not a promise of eligibility. The official notice is final.",
    },
    deadline_extended: {
      subject: "Application deadline extended: {{post}}",
      heading: "The application deadline has been extended",
      matched: "Why it matched",
      review: "Why it needs review",
      official: "Official notification",
      apply: "Application link",
      verified: "Last verified",
      disclaimer:
        "This is a preliminary match, not a promise of eligibility. The official notice is final.",
    },
    important_correction: {
      subject: "Important notice correction: {{post}}",
      heading: "An important vacancy notice correction",
      matched: "Why it matched",
      review: "Why it needs review",
      official: "Official notification",
      apply: "Application link",
      verified: "Last verified",
      disclaimer:
        "This is a preliminary match, not a promise of eligibility. The official notice is final.",
    },
  },
  hi: {
    new_vacancy: {
      subject: "आपकी प्रोफ़ाइल से मेल खा सकती है सरकारी भर्ती: {{post}}",
      heading: "एक भर्ती आपकी प्रोफ़ाइल से मेल खा सकती है",
      matched: "मेल का कारण",
      review: "समीक्षा का कारण",
      official: "आधिकारिक सूचना",
      apply: "आवेदन लिंक",
      verified: "अंतिम सत्यापन",
      disclaimer: "यह केवल प्रारंभिक मिलान है, पात्रता की गारंटी नहीं। आधिकारिक सूचना ही अंतिम है।",
    },
    deadline_reminder_3d: {
      subject: "आवेदन की अंतिम तारीख 3 दिन में: {{post}}",
      heading: "आवेदन की अंतिम तारीख 3 दिन में है",
      matched: "मेल का कारण",
      review: "समीक्षा का कारण",
      official: "आधिकारिक सूचना",
      apply: "आवेदन लिंक",
      verified: "अंतिम सत्यापन",
      disclaimer: "यह केवल प्रारंभिक मिलान है, पात्रता की गारंटी नहीं। आधिकारिक सूचना ही अंतिम है।",
    },
    deadline_reminder_1d: {
      subject: "आवेदन की अंतिम तारीख कल: {{post}}",
      heading: "आवेदन की अंतिम तारीख कल है",
      matched: "मेल का कारण",
      review: "समीक्षा का कारण",
      official: "आधिकारिक सूचना",
      apply: "आवेदन लिंक",
      verified: "अंतिम सत्यापन",
      disclaimer: "यह केवल प्रारंभिक मिलान है, पात्रता की गारंटी नहीं। आधिकारिक सूचना ही अंतिम है।",
    },
    deadline_extended: {
      subject: "आवेदन की अंतिम तारीख बढ़ाई गई: {{post}}",
      heading: "आवेदन की अंतिम तारीख बढ़ाई गई है",
      matched: "मेल का कारण",
      review: "समीक्षा का कारण",
      official: "आधिकारिक सूचना",
      apply: "आवेदन लिंक",
      verified: "अंतिम सत्यापन",
      disclaimer: "यह केवल प्रारंभिक मिलान है, पात्रता की गारंटी नहीं। आधिकारिक सूचना ही अंतिम है।",
    },
    important_correction: {
      subject: "भर्ती सूचना में महत्वपूर्ण सुधार: {{post}}",
      heading: "भर्ती सूचना में महत्वपूर्ण सुधार",
      matched: "मेल का कारण",
      review: "समीक्षा का कारण",
      official: "आधिकारिक सूचना",
      apply: "आवेदन लिंक",
      verified: "अंतिम सत्यापन",
      disclaimer: "यह केवल प्रारंभिक मिलान है, पात्रता की गारंटी नहीं। आधिकारिक सूचना ही अंतिम है।",
    },
  },
};

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => {
    const entities = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
    return entities[character];
  });
}

function safeHttpsUrl(value, fallback) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url.href : fallback;
  } catch {
    return fallback;
  }
}

function formatDate(value, language) {
  if (!value) return language === "hi" ? "उपलब्ध नहीं" : "Not provided";
  const date = new Date(`${value.slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(language === "hi" ? "hi-IN" : "en-IN", {
    dateStyle: "long",
    timeZone: "UTC",
  }).format(date);
}

function whyMatched(match, language) {
  if (match.status === "needs_review") {
    return Object.values(match.explanation ?? {})
      .filter((entry) => entry.status === "unknown")
      .map((entry) => entry.reason?.[language])
      .filter(Boolean);
  }
  return Object.values(match.explanation ?? {})
    .filter((entry) => entry.status === "matched")
    .map((entry) => entry.reason?.[language])
    .filter(Boolean);
}

export function renderVacancyEmail({ notificationType, language, vacancy, match, unsubscribeUrl }) {
  const locale = language === "hi" ? "hi" : "en";
  const labels = copy[locale][notificationType];
  if (!labels) throw new Error(`Unsupported notification type: ${notificationType}`);
  const post = vacancy.title || (locale === "hi" ? "सरकारी भर्ती" : "Government vacancy");
  const department =
    vacancy.recruiting_organization ||
    (locale === "hi" ? "विभाग नहीं दिया गया" : "Department not provided");
  const why = whyMatched(match, locale);
  const officialUrl = safeHttpsUrl(vacancy.official_source_url, "https://example.invalid/");
  const link = safeHttpsUrl(vacancy.application_url, officialUrl);
  const values = {
    post,
    department,
    deadline: formatDate(vacancy.deadline, locale),
    official: officialUrl,
    application: link,
    verified: formatDate(vacancy.last_verified_at, locale),
    unsubscribe: unsubscribeUrl,
  };
  const subject = labels.subject.replace("{{post}}", post);
  const whyHtml = why.length
    ? `<ul>${why.map((reason) => `<li>${escapeHtml(reason)}</li>`).join("")}</ul>`
    : `<p>${escapeHtml(
        locale === "hi"
          ? "इस भर्ती का मिलान अभी समीक्षा के अधीन है।"
          : "This vacancy match still needs a manual review.",
      )}</p>`;
  const html = `<!doctype html><html lang="${locale}"><body style="font-family:Arial,sans-serif;line-height:1.6;color:#17211b"><main style="max-width:640px;margin:auto;padding:24px"><h1>${escapeHtml(labels.heading)}</h1><p><strong>${escapeHtml(post)}</strong></p><p>${escapeHtml(department)}</p><p><strong>${locale === "hi" ? "अंतिम तारीख" : "Deadline"}:</strong> ${escapeHtml(values.deadline)}</p><h2>${escapeHtml(match.status === "needs_review" ? labels.review : labels.matched)}</h2>${whyHtml}<p><a href="${escapeHtml(values.official)}">${escapeHtml(labels.official)}</a></p><p><a href="${escapeHtml(values.application)}">${escapeHtml(labels.apply)}</a></p><p><strong>${escapeHtml(labels.verified)}:</strong> ${escapeHtml(values.verified)}</p><p>${escapeHtml(labels.disclaimer)}</p><hr><p><a href="${escapeHtml(values.unsubscribe)}">${locale === "hi" ? "ईमेल अलर्ट बंद करें" : "Unsubscribe from email alerts"}</a></p></main></body></html>`;
  const text = [
    labels.heading,
    `${locale === "hi" ? "पद" : "Post"}: ${post}`,
    `${locale === "hi" ? "विभाग" : "Department"}: ${department}`,
    `${locale === "hi" ? "अंतिम तारीख" : "Deadline"}: ${values.deadline}`,
    `${match.status === "needs_review" ? labels.review : labels.matched}:`,
    ...(why.length
      ? why.map((reason) => `- ${reason}`)
      : [locale === "hi" ? "मिलान समीक्षा के अधीन है।" : "Match needs review."]),
    `${labels.official}: ${values.official}`,
    `${labels.apply}: ${values.application}`,
    `${labels.verified}: ${values.verified}`,
    labels.disclaimer,
    `${locale === "hi" ? "ईमेल अलर्ट बंद करें" : "Unsubscribe"}: ${values.unsubscribe}`,
  ].join("\n");
  return { subject, html, text, unsubscribeUrl: values.unsubscribe };
}
