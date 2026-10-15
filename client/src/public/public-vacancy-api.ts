export type PublicVacancy = {
  id: string;
  title: string;
  recruiting_organization: string;
  official_source_url: string;
  pdf_url: string | null;
  application_url: string;
  application_start_date: string | null;
  deadline: string;
  age_cutoff_date: string | null;
  last_verified_at: string;
  qualification_level: string | null;
  allowed_disciplines: string[];
  location_state: string | null;
  eligibility: {
    min_age: number | null;
    max_age: number | null;
    age_relaxations: Record<string, number> | null;
    domicile_states: string[];
    min_experience_years: number | null;
  };
};

const apiUrl = import.meta.env.VITE_API_URL || "http://localhost:3000/api";

async function readVacancyResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    if (response.status === 404) throw new Error("VACANCY_NOT_FOUND");
    throw new Error(`Vacancy request failed (${response.status})`);
  }
  return (await response.json()) as T;
}

export async function fetchPublicVacancies() {
  const response = await fetch(`${apiUrl}/public/vacancies`);
  return readVacancyResponse<{ vacancies: PublicVacancy[] }>(response);
}

export async function fetchPublicVacancy(id: string) {
  const response = await fetch(`${apiUrl}/public/vacancies/${encodeURIComponent(id)}`);
  return readVacancyResponse<{ vacancy: PublicVacancy }>(response);
}
