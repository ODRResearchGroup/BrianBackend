import { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";

export function requireAuth(
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
    jwt.verify(header.slice(7), secret);
    next();
  } catch {
    res.status(401).json({ error: "Invalid or expired token" });
  }
}
