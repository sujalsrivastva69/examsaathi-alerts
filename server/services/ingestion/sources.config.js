export const sources = [
  {
    id: "ssc",
    name: "Staff Selection Commission",
    url: "https://ssc.gov.in/",
    robots_url: "https://ssc.gov.in/robots.txt",
    terms_url: "https://ssc.gov.in/terms-and-conditions",
    type: "html_list",
    parser: {
      item_selector: "a[href$='.pdf'], a[href*='notice']",
      title_selector: null,
      url_attribute: "href",
    },
    check_interval_hours: 4,
    minimum_interval_ms: 3000,
    user_agent: "ExamSaathiAlertsBot/0.1 (official recruitment notice monitoring)",
    allowed_hosts: ["ssc.gov.in"],
    terms_reviewed: false,
    enabled: false,
    disabled_reason:
      "SSC robots.txt returned 404 and its terms URL returned the site homepage; scraping permission is unverified.",
  },
];

export function getEnabledSources() {
  return sources.filter((source) => source.enabled && source.terms_reviewed);
}
