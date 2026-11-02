import { randomUUID } from "node:crypto";
import { Router, Response } from "express";
import multer from "multer";
import { compressMedia, isSupportedMediaType } from "../lib/compressMedia.js";
import { mediaUrl, signedMediaUrl, uploadMedia } from "../lib/r2.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();
const MAX_UPLOAD_BYTES = 50 * 1024 * 1024;
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_UPLOAD_BYTES, files: 1 },
});

router.post(
  "/annotations/:annotationId/media",
  requireAuth,
  upload.single("media"),
  async (req, res: Response) => {
    const file = req.file;
    const annotationIdParam = req.params.annotationId;
    const annotationId = Array.isArray(annotationIdParam)
      ? annotationIdParam[0]
      : annotationIdParam;

    if (!file) {
      res.status(400).json({ error: "A media file is required in field 'media'" });
      return;
    }
    if (!annotationId || !/^[a-zA-Z0-9_-]+$/.test(annotationId)) {
      res.status(400).json({ error: "Invalid annotationId" });
      return;
    }
    if (!isSupportedMediaType(file.mimetype)) {
      res.status(415).json({ error: `Unsupported media type: ${file.mimetype}` });
      return;
    }

    try {
      const compressed = await compressMedia(file.buffer, file.mimetype);
      const kind = compressed.contentType.startsWith("image/") ? "images" : "audio";
      const key = `${kind}/${annotationId}/${randomUUID()}.${compressed.extension}`;

      await uploadMedia(key, compressed.body, compressed.contentType);
      res.status(201).json({
        key,
        url: await mediaUrl(key),
        contentType: compressed.contentType,
        byteSize: compressed.body.length,
        originalByteSize: file.size,
      });
    } catch (error) {
      console.error("Media processing/upload failed", error);
      res.status(502).json({
        error: error instanceof Error ? error.message : "Media processing or upload failed",
      });
    }
  },
);

router.get("/media", requireAuth, async (req, res: Response) => {
  const key = typeof req.query.key === "string" ? req.query.key : "";
  if (!key || key.length > 1024 || key.includes("..") || key.startsWith("/")) {
    res.status(400).json({ error: "Invalid media key" });
    return;
  }

  try {
    const signedUrl = await signedMediaUrl(key);
    res.redirect(302, signedUrl);
  } catch (error) {
    console.error("Media access URL generation failed", error);
    res.status(502).json({ error: "Media access is unavailable" });
  }
});

export default router;
