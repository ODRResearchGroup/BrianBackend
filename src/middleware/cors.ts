import { NextFunction, Request, Response } from "express";

/**
 * CORS for browser clients on other origins (e.g. SensoryDataMaps on GitHub
 * Pages). Only origins listed in CORS_ORIGINS (comma-separated) are allowed;
 * with the variable unset, no cross-origin access is granted.
 */
export function allowListedOrigins(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const allowed = (process.env.CORS_ORIGINS ?? "")
    .split(",")
    .map((origin) => origin.trim().replace(/\/+$/, ""))
    .filter(Boolean);
  const origin = req.headers.origin;

  if (origin && allowed.includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Authorization, Content-Type");
    res.setHeader("Access-Control-Max-Age", "600");
  }
  res.setHeader("Vary", "Origin");

  if (req.method === "OPTIONS") {
    res.sendStatus(204);
    return;
  }
  next();
}
