export function getHealthStatus() {
  return {
    status: "ok",
    service: "examsaathi-api",
    timestamp: new Date().toISOString(),
  };
}
