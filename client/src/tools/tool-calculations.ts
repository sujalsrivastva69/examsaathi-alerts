import { calculateAgeOnDate, isValidDate } from "../../../shared/age.js";

export { calculateAgeOnDate, isValidDate };

export interface AgeDetails {
  years: number;
  months: number;
  days: number;
}

export function evaluateAgeLimits(
  age: number,
  minimum: number | null,
  maximum: number | null,
  relaxation = 0,
  relaxationVerified = false,
): { withinLimits: boolean; maximumAllowed: number | null } | null {
  if (
    !Number.isInteger(age) ||
    (minimum !== null && (!Number.isInteger(minimum) || minimum < 0)) ||
    (maximum !== null && (!Number.isInteger(maximum) || maximum < 0)) ||
    (minimum !== null && maximum !== null && minimum > maximum) ||
    !Number.isFinite(relaxation) ||
    relaxation < 0
  ) {
    return null;
  }
  const maximumAllowed =
    maximum === null ? null : maximum + (relaxationVerified ? relaxation : 0);
  return {
    withinLimits:
      (minimum === null || age >= minimum) &&
      (maximumAllowed === null || age <= maximumAllowed),
    maximumAllowed,
  };
}

export function calculateAgeDetails(dateOfBirth: string, cutoffDate: string): AgeDetails | null {
  const years = calculateAgeOnDate(dateOfBirth, cutoffDate);
  if (years === null || cutoffDate < dateOfBirth) return null;

  const [birthYear, birthMonth, birthDay] = dateOfBirth.split("-").map(Number);
  const [cutoffYear, cutoffMonth, cutoffDay] = cutoffDate.split("-").map(Number);
  const leapBirthday = birthMonth === 2 && birthDay === 29;
  const birthdayYear = birthYear + years;
  const anniversaryMonth = leapBirthday && !isLeapYear(birthdayYear) ? 3 : birthMonth;
  const anniversaryDay = leapBirthday && !isLeapYear(birthdayYear) ? 1 : birthDay;
  let months = cutoffMonth - anniversaryMonth;
  if (cutoffDay < anniversaryDay) months -= 1;
  if (months < 0) months += 12;

  const anchorMonth = anniversaryMonth + months;
  const anchorYear = birthdayYear + Math.floor((anchorMonth - 1) / 12);
  const normalizedMonth = ((anchorMonth - 1) % 12) + 1;
  const anchorDay = Math.min(anniversaryDay, daysInMonth(anchorYear, normalizedMonth));
  const anchor = Date.UTC(anchorYear, normalizedMonth - 1, anchorDay);
  const cutoff = Date.UTC(cutoffYear, cutoffMonth - 1, cutoffDay);
  const days = Math.floor((cutoff - anchor) / 86_400_000);
  return { years, months, days };
}

export function isLeapYear(year: number): boolean {
  return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
}

function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

export function validateDimensions(width: number, height: number): string | null {
  if (!Number.isInteger(width) || !Number.isInteger(height)) {
    return "Dimensions must be whole numbers.";
  }
  if (width < 1 || height < 1 || width > 10_000 || height > 10_000) {
    return "Each dimension must be between 1 and 10,000 pixels.";
  }
  if (width * height > 40_000_000) return "Output dimensions exceed the safe 40-megapixel limit.";
  return null;
}

export function estimateMonthlySalary(input: {
  basicPay: number;
  daPercent: number;
  hraPercent: number;
  transportAllowance: number;
  deductions: number[];
}): { gross: number; deductions: number; takeHome: number } | null {
  const values = [
    input.basicPay,
    input.daPercent,
    input.hraPercent,
    input.transportAllowance,
    ...input.deductions,
  ];
  if (values.some((value) => !Number.isFinite(value) || value < 0)) return null;
  const gross =
    input.basicPay +
    input.basicPay * (input.daPercent / 100) +
    input.basicPay * (input.hraPercent / 100) +
    input.transportAllowance;
  const deductions = input.deductions.reduce((total, amount) => total + amount, 0);
  return { gross, deductions, takeHome: gross - deductions };
}

export function validateOfficialSource(source: {
  label: string;
  url: string;
  verifiedOn: string;
}): boolean {
  try {
    const parsed = new URL(source.url);
    return (
      source.label.trim().length > 0 &&
      parsed.protocol === "https:" &&
      isValidDate(source.verifiedOn)
    );
  } catch {
    return false;
  }
}
