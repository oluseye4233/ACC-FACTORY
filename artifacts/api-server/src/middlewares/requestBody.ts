import express, { type Express, type ErrorRequestHandler } from "express";

export const GITHUB_BUNDLE_MAX_BYTES = 2_000_000;

// JSON escaping can expand a valid 2 MB source bundle by up to six times.
// Only this exact POST endpoint receives the larger transport allowance.
export function configureRequestBodyParsers(app: Express): void {
  app.post("/api/integrations/github/push-codebase", express.json({ limit: "16mb" }));
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  app.use(requestBodyError);
}

const requestBodyError: ErrorRequestHandler = (err, _req, res, next) => {
  if (err?.type === "entity.too.large") {
    res.status(413).json({ error: "Request body exceeds the allowed size.", code: "REQUEST_TOO_LARGE" });
    return;
  }
  if (err?.type === "entity.parse.failed") {
    res.status(400).json({ error: "Invalid JSON request body.", code: "INVALID_JSON" });
    return;
  }
  next(err);
};
