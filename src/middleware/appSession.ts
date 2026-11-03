import { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";

export function requireAppSession(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const header = req.headers.authorization;
  const secret = process.env.JWT_SECRET;

  if (!secret) {
    res.status(500).json({ error: "JWT_SECRET is not configured" });
    return;
  }
  if (!header?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Missing or invalid authorization" });
    return;
  }

  try {
    const payload = jwt.verify(header.slice(7), secret);
    if (
      typeof payload !== "object" ||
      payload === null ||
      payload.aud !== "brian-mobile"
    ) {
      res.status(401).json({ error: "Invalid app session" });
      return;
    }
    next();
  } catch {
    res.status(401).json({ error: "Invalid or expired app session" });
  }
}
