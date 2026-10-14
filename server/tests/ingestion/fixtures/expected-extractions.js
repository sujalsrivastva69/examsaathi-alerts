const blankFields = {
  recruiting_body: null,
  department: null,
  post_title: null,
  publication_date: null,
  application_start_date: null,
  application_deadline: null,
  age_cutoff_date: null,
  min_age: null,
  max_age: null,
  age_relaxations: null,
  education_level: null,
  allowed_disciplines: null,
  domicile_states: null,
  experience: null,
  location_state: null,
  application_url: null,
};

function quoted(value, confidence = 0.98) {
  return { value, source_quote: null, confidence };
}

function absent() {
  return { value: null, source_quote: null, confidence: 0.98 };
}

function makePost(values) {
  return Object.fromEntries(
    Object.keys(blankFields).map((key) => [
      key,
      Object.hasOwn(values, key) ? quoted(values[key].value, values[key].confidence) : absent(),
    ]),
  );
}

export const expectedPosts = [
  makePost({
    recruiting_body: { value: "The Public Works Department" },
    department: { value: "Public Works Department" },
    post_title: { value: "Junior Engineer" },
    publication_date: { value: "2026-10-01" },
    application_start_date: { value: "2026-10-10" },
    application_deadline: { value: "2026-11-10" },
    age_cutoff_date: { value: "2027-01-01" },
    min_age: { value: 18 },
    max_age: { value: 35 },
    education_level: { value: "undergraduate" },
    allowed_disciplines: { value: ["civil engineering"] },
    experience: { value: 2 },
    location_state: { value: "Maharashtra" },
  }),
  makePost({
    recruiting_body: { value: "The National Records Office" },
    department: { value: "National Records Office" },
    post_title: { value: "Clerk" },
    publication_date: { value: "2026-09-05" },
    application_start_date: { value: "2026-09-12" },
    application_deadline: { value: "2026-09-30" },
    education_level: { value: "higher_secondary" },
    location_state: { value: "Delhi" },
  }),
  makePost({
    recruiting_body: { value: "The Central Water Laboratory" },
    department: { value: "Central Water Laboratory" },
    post_title: { value: "Lab Technician" },
    publication_date: { value: "2026-08-15" },
    application_start_date: { value: "2026-08-20" },
    application_deadline: { value: "2026-09-20" },
    age_cutoff_date: { value: "2026-07-01" },
    min_age: { value: 21 },
    max_age: { value: 32 },
    education_level: { value: "diploma" },
    allowed_disciplines: { value: ["chemistry"] },
    location_state: { value: "Kerala" },
  }),
  makePost({
    recruiting_body: { value: "The Sample University" },
    department: { value: "Sample University" },
    post_title: { value: "Assistant Professor" },
    publication_date: { value: "2026-07-02" },
    application_start_date: { value: "2026-07-08" },
    application_deadline: { value: "2026-08-08" },
    education_level: { value: "postgraduate" },
    allowed_disciplines: { value: ["mathematics"] },
    location_state: { value: "Rajasthan" },
  }),
  makePost({
    recruiting_body: { value: "The Sample Agriculture Board" },
    department: { value: "Sample Agriculture Board" },
    post_title: { value: "Field Officer" },
    publication_date: { value: "2026-06-03" },
    application_start_date: { value: "2026-06-10" },
    application_deadline: { value: "2026-07-10" },
    age_cutoff_date: { value: "2026-05-01" },
    min_age: { value: 20 },
    max_age: { value: 30 },
    age_relaxations: {
      value: { sc: 5, st: null, obc: null, ews: null, pwd: null, ex_serviceman: null },
    },
    education_level: { value: "undergraduate" },
    allowed_disciplines: { value: ["agriculture"] },
    experience: { value: 1 },
    location_state: { value: "Punjab" },
  }),
];

export function expectedExtraction(index, noticeText) {
  const post = structuredClone(expectedPosts[index]);
  for (const [key, entry] of Object.entries(post)) {
    if (entry.value === null) continue;
    const patterns = {
      recruiting_body: /published the .+ notice/i,
      department: /published the .+ notice/i,
      post_title: /published the .+ notice/i,
      publication_date: /published the .+ notice/i,
      application_start_date: /applications open/i,
      application_deadline: /applications close/i,
      age_cutoff_date: /age as of/i,
      min_age: /age as of/i,
      max_age: /age as of/i,
      age_relaxations: /age relaxation/i,
      education_level: /applicants must/i,
      allowed_disciplines: /applicants must/i,
      domicile_states: /domicile|residency/i,
      experience: /years? of experience/i,
      location_state: /post is based/i,
      application_url: /apply at/i,
    };
    const candidate = noticeText.split(/\r?\n/).find((line) => patterns[key]?.test(line));
    if (candidate) entry.source_quote = candidate;
  }
  return { posts: [post] };
}
