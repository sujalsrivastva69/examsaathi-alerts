const requestTargets = new Set(["body", "params", "query"]);

export function validateRequest(schema, target = "body") {
  if (!requestTargets.has(target)) {
    throw new TypeError(`Unsupported request validation target: ${target}`);
  }

  return (req, _res, next) => {
    const result = schema.safeParse(req[target]);

    if (!result.success) {
      return next(result.error);
    }

    req.validated ??= {};
    req.validated[target] = result.data;
    return next();
  };
}
