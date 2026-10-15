export const sources = [
  {
    id: "ssc",
    name: "Staff Selection Commission",
    url: "https://ssc.gov.in/",
    robots_url: "https://ssc.gov.in/robots.txt",
    terms_url: "https://ssc.gov.in/Home/Disclaimer",
    type: "unconfigured",
    parser: null,
    check_interval_hours: 8,
    minimum_interval_ms: 3000,
    user_agent: "ExamSaathiAlertsBot/0.1 (government vacancy notice discovery)",
    allowed_hosts: ["ssc.gov.in"],
    access_permission: "unverified",
    access_review_note:
      "robots.txt returned 404 and the available disclaimer did not establish automated discovery permission; no notices endpoint or feed has been verified.",
    terms_reviewed: false,
    enabled: false,
    disabled_reason: "Automated access permission and an official notices feed need verification.",
  },
  {
    id: "employment-news",
    name: "Employment News - Web Advertisements",
    url: "https://employmentnews.gov.in/NewEmp/MoreContentS.aspx?n=WebAdvertisement",
    robots_url: "https://employmentnews.gov.in/robots.txt",
    terms_url: "https://employmentnews.gov.in/NewEmp/Policy.aspx",
    type: "html_list",
    parser: {
      item_selector: "#ContentPlaceHolder1_RepEditorial a[href$='.pdf']",
      title_selector: null,
      url_attribute: "href",
    },
    check_interval_hours: 8,
    minimum_interval_ms: 3000,
    user_agent: "ExamSaathiAlertsBot/0.1 (government vacancy notice discovery)",
    allowed_hosts: ["employmentnews.gov.in"],
    access_permission: "unverified",
    access_review_note:
      "robots.txt returned 404 and the available policy describes the publication but does not establish automated-fetch permission.",
    terms_reviewed: false,
    enabled: false,
    disabled_reason: "Automated access permission needs confirmation before fetching.",
  },
];

export function isSourceEnabled(source) {
  return (
    source.enabled &&
    source.access_permission === "confirmed" &&
    source.terms_reviewed &&
    source.type !== "unconfigured" &&
    source.parser !== null
  );
}

export function getEnabledSources() {
  return sources.filter(isSourceEnabled);
}

export function getDisabledSources() {
  return sources.filter((source) => !isSourceEnabled(source));
}
