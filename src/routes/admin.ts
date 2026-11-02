import { Router, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { Prisma } from "@prisma/client";
import prisma from "../lib/prisma.js";
import { deleteMediaObjects, mediaUrl, signedMediaUrl } from "../lib/r2.js";

const router = Router();
const cookieName = "brian_admin_session";

function adminConfigured(): boolean {
  return Boolean(
    process.env.ADMIN_USERNAME &&
      process.env.ADMIN_PASSWORD &&
      process.env.JWT_SECRET,
  );
}

function isAdminSession(req: Request): boolean {
  const token = req.headers.cookie
    ?.split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${cookieName}=`))
    ?.slice(cookieName.length + 1);
  if (!token || !process.env.JWT_SECRET) {
    return false;
  }
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    return (
      typeof payload === "object" &&
      payload !== null &&
      payload.role === "admin"
    );
  } catch {
    return false;
  }
}

function requireAdmin(req: Request, res: Response): boolean {
  if (!adminConfigured()) {
    res.status(503).json({ error: "Admin is not configured." });
    return false;
  }
  if (!isAdminSession(req)) {
    res.status(401).json({ error: "Admin login required." });
    return false;
  }
  return true;
}

function mediaKeyFromLink(link: string | null): string | null {
  if (!link) {
    return null;
  }
  try {
    return new URL(link, "http://localhost").searchParams.get("key");
  } catch {
    return null;
  }
}

function queryString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

router.get("/admin/api/session", (req, res) => {
  res.json({ configured: adminConfigured(), authenticated: isAdminSession(req) });
});

router.post("/admin/api/login", (req, res) => {
  if (!adminConfigured()) {
    res.status(503).json({ error: "Admin is not configured." });
    return;
  }
  if (
    req.body?.username !== process.env.ADMIN_USERNAME ||
    req.body?.password !== process.env.ADMIN_PASSWORD
  ) {
    res.status(401).json({ error: "Invalid username or password." });
    return;
  }

  const token = jwt.sign({ role: "admin" }, process.env.JWT_SECRET!, {
    expiresIn: "8h",
  });
  res.setHeader(
    "Set-Cookie",
    `${cookieName}=${token}; HttpOnly; SameSite=Lax; Path=/admin; Max-Age=28800${process.env.NODE_ENV === "production" ? "; Secure" : ""}`,
  );
  res.json({ authenticated: true });
});

router.post("/admin/api/logout", (req, res) => {
  res.setHeader(
    "Set-Cookie",
    `${cookieName}=; HttpOnly; SameSite=Lax; Path=/admin; Max-Age=0`,
  );
  res.json({ authenticated: false });
});

router.get("/admin/api/annotations", async (req, res) => {
  if (!requireAdmin(req, res)) {
    return;
  }

  try {
    const title = queryString(req.query.title).trim();
    const annotationId = queryString(req.query.annotationId).trim();
    const note = queryString(req.query.note).trim();
    const deviceName = queryString(req.query.deviceName).trim();
    const smellWalkId = queryString(req.query.smellWalkId).trim();
    const dateFrom = queryString(req.query.dateFrom).trim();
    const dateTo = queryString(req.query.dateTo).trim();
    const media = queryString(req.query.media);
    const where: Prisma.AnnotationWhereInput = {};

    if (title) where.title = { contains: title, mode: "insensitive" };
    if (annotationId) where.id = { contains: annotationId, mode: "insensitive" };
    if (note) where.note = { contains: note, mode: "insensitive" };
    if (deviceName) {
      where.deviceName = { contains: deviceName, mode: "insensitive" };
    }
    if (smellWalkId) {
      where.smellWalkId = { contains: smellWalkId, mode: "insensitive" };
    }
    if (dateFrom || dateTo) {
      where.timestamp = {};
      if (dateFrom) where.timestamp.gte = new Date(`${dateFrom}T00:00:00.000Z`);
      if (dateTo) where.timestamp.lte = new Date(`${dateTo}T23:59:59.999Z`);
    }
    if (media === "photo") where.photo = { not: null };
    if (media === "audio") where.audio = { not: null };
    if (media === "none") {
      where.photo = null;
      where.audio = null;
    }

    const annotations = await prisma.annotation.findMany({
      where,
      orderBy: { timestamp: "desc" },
    });
    const result = await Promise.all(
      annotations.map(async (annotation) => {
        const photoKey = mediaKeyFromLink(annotation.photo);
        const audioKey = mediaKeyFromLink(annotation.audio);
        const [photo, audio] = await Promise.all([
          photoKey ? signedMediaUrl(photoKey) : null,
          audioKey ? signedMediaUrl(audioKey) : null,
        ]);
        return { ...annotation, photo, audio };
      }),
    );
    res.json({ annotations: result });
  } catch (error) {
    console.error("Admin annotation listing failed", error);
    res.status(500).json({ error: "Unable to list annotations." });
  }
});

router.post("/admin/api/annotations/:annotationId/delete", async (req, res) => {
  if (!requireAdmin(req, res)) {
    return;
  }
  const annotationId = Array.isArray(req.params.annotationId)
    ? req.params.annotationId[0]
    : req.params.annotationId;
  if (!annotationId || annotationId.length > 200) {
    res.status(400).json({ error: "Invalid annotation ID." });
    return;
  }

  try {
    const annotation = await prisma.annotation.findUnique({
      where: { id: annotationId },
    });
    if (!annotation) {
      res.status(404).json({ error: "Fingerprint not found." });
      return;
    }
    const keys = [mediaKeyFromLink(annotation.photo), mediaKeyFromLink(annotation.audio)]
      .filter((key): key is string => key !== null);
    await deleteMediaObjects(keys);
    await prisma.annotation.delete({ where: { id: annotationId } });
    res.json({ deleted: true });
  } catch (error) {
    console.error("Admin annotation deletion failed", error);
    res.status(500).json({ error: "Unable to delete fingerprint and media." });
  }
});

export default router;
