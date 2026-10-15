import { describe, expect, it, vi } from "vitest";
import { createLocalViewModeGuard } from "../../middleware/local-view-mode.js";

function makeResponse() {
  const response = {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
  };
  return response;
}

describe("local view mode API guard", () => {
  it.each(["GET", "HEAD", "OPTIONS"])("allows %s requests", (method) => {
    const next = vi.fn();
    const response = makeResponse();

    createLocalViewModeGuard(true)({ method }, response, next);

    expect(next).toHaveBeenCalledOnce();
    expect(response.statusCode).toBe(200);
  });

  it.each(["POST", "PUT", "PATCH", "DELETE"])("rejects %s requests", (method) => {
    const next = vi.fn();
    const response = makeResponse();

    createLocalViewModeGuard(true)({ method }, response, next);

    expect(next).not.toHaveBeenCalled();
    expect(response.statusCode).toBe(503);
    expect(response.body.error.code).toBe("LOCAL_VIEW_MODE");
  });

  it("leaves requests unchanged when the mode is disabled", () => {
    const next = vi.fn();
    const response = makeResponse();

    createLocalViewModeGuard(false)({ method: "POST" }, response, next);

    expect(next).toHaveBeenCalledOnce();
    expect(response.statusCode).toBe(200);
  });
});
