import { ZodError } from "zod";

export function errorHandler(error, _req, res, _next) {
  void _next;
  if (error instanceof ZodError) {
    return res.status(400).json({
      error: {
        code: "VALIDATION_ERROR",
        message: "Request validation failed",
        issues: error.issues.map((issue) => ({
          path: issue.path,
          message: issue.message,
        })),
      },
    });
  }

  const statusCode = Number.isInteger(error.statusCode) ? error.statusCode : 500;

  if (statusCode >= 500) {
    console.error("Unhandled request error", error);
  }

  return res.status(statusCode).json({
    error: {
      code: error.code ?? "INTERNAL_SERVER_ERROR",
      message: statusCode >= 500 ? "An unexpected error occurred" : error.message,
    },
  });
}
