export function isValidDate(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  return (
    parsed.getUTCFullYear() === year &&
    parsed.getUTCMonth() === month - 1 &&
    parsed.getUTCDate() === day
  );
}

export function calculateAgeOnDate(dateOfBirth, cutoffDate) {
  if (!isValidDate(dateOfBirth) || !isValidDate(cutoffDate)) return null;
  const [birthYear, birthMonth, birthDay] = dateOfBirth.split("-").map(Number);
  const [cutoffYear, cutoffMonth, cutoffDay] = cutoffDate.split("-").map(Number);
  const birthdayNotReached =
    cutoffMonth < birthMonth || (cutoffMonth === birthMonth && cutoffDay < birthDay);
  return cutoffYear - birthYear - (birthdayNotReached ? 1 : 0);
}
