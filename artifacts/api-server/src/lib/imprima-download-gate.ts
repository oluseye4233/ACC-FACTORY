import type { RequestHandler } from "express";

/** Mounted after the protected portal routes, before legacy artifact routes.
 * This controls attachment responses, not the subscriber's ability to read,
 * copy or screenshot material they are authorized to view. */
export const imprimaDownloadGate: RequestHandler = (req, res, next) => {
  // Account/privacy, activity, financial and training reports are not
  // production-floor project-artifact publication.
  if (/^\/(?:activity|billing|provider-billing|learning|verify|badges)(?:\/|$)/.test(req.path) ||
      /^\/me\/export(?:\/|$)/.test(req.path) || /^\/orgs\/[^/]+\/activity/.test(req.path)) {
    next(); return;
  }
  const end = res.end.bind(res), write = res.write.bind(res);
  let blocked = false;
  const deny = () => {
    if (blocked) return true;
    if (!/\battachment\b/i.test(String(res.getHeader("Content-Disposition") ?? ""))) return false;
    blocked = true;
    if (res.headersSent) { res.destroy(); return true; }
    for (const name of ["Content-Disposition", "Content-Length", "Content-Encoding", "ETag"]) res.removeHeader(name);
    const body = JSON.stringify({ error: "Project-artifact downloads require IMPRIMA PORTAL and a single-use emailed publication code.",
      code: "IMPRIMA_PUBLICATION_REQUIRED", portalPath: "/imprima-portal" });
    res.statusCode = 428;
    res.setHeader("Content-Type", "application/json");
    res.setHeader("Cache-Control", "private, no-store");
    end(body);
    return true;
  };
  res.write = ((...args: unknown[]) => deny() ? false : Reflect.apply(write, res, args)) as typeof res.write;
  res.end = ((...args: unknown[]) => deny() ? res : Reflect.apply(end, res, args)) as typeof res.end;
  next();
};
