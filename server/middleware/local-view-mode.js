export function createLocalViewModeGuard(enabled) {
  return (req, res, next) => {
    if (enabled && !["GET", "HEAD", "OPTIONS"].includes(req.method)) {
      return res.status(503).json({
        error: {
          code: "LOCAL_VIEW_MODE",
          message: "Changes are disabled while local view mode is enabled",
        },
      });
    }
    return next();
  };
}
