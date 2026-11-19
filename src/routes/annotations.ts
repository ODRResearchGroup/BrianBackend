import { Router, Response } from "express";
import { Prisma } from "@prisma/client";
import prisma from "../lib/prisma.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();

type AnnotationInput = {
  recordingId: string;
  sensorReadings?: unknown;
  title?: string;
  note?: string;
  timestamp: string;
  photo?: string | null;
  audio?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  deviceName?: string | null;
  smellWalkId?: string | null;
  installationId?: string | null;
};

function isString(value: unknown): value is string {
  return typeof value === "string";
}

function validateInput(body: unknown): {
  value?: AnnotationInput;
  error?: string;
} {
  if (!body || typeof body !== "object") {
    return { error: "JSON request body is required" };
  }

  const value = body as Partial<AnnotationInput>;
  if (
    !isString(value.recordingId) ||
    !isString(value.timestamp) ||
    (value.latitude !== undefined &&
      value.latitude !== null &&
      typeof value.latitude !== "number") ||
    (value.longitude !== undefined &&
      value.longitude !== null &&
      typeof value.longitude !== "number")
  ) {
    return {
      error:
        "recordingId and timestamp are required; latitude/longitude must be floats",
    };
  }

  const timestamp = new Date(value.timestamp);
  if (Number.isNaN(timestamp.getTime())) {
    return { error: "timestamp must be a valid ISO date" };
  }
  return { value: value as AnnotationInput };
}

function jsonValue(
  value: unknown,
): Prisma.InputJsonValue | typeof Prisma.JsonNull {
  return value === null || value === undefined
    ? Prisma.JsonNull
    : (value as Prisma.InputJsonValue);
}

router.post("/annotations", requireAuth, async (req, res: Response) => {
  const parsed = validateInput(req.body);
  if (!parsed.value) {
    res.status(400).json({ error: parsed.error });
    return;
  }

  console.log("saving annotation");

  const input = parsed.value;
  try {
    const annotation = await prisma.annotation.upsert({
      where: { id: input.recordingId },
      create: {
        id: input.recordingId,
        sensorReadings: jsonValue(input.sensorReadings ?? {}),
        title: input.title ?? "",
        note: input.note ?? "",
        timestamp: new Date(input.timestamp),
        latitude: input.latitude,
        longitude: input.longitude,
        photo: input.photo ?? null,
        audio: input.audio ?? null,
        deviceName: input.deviceName ?? null,
        smellWalkId: input.smellWalkId ?? null,
        installationId: input.installationId ?? null,
      },
      update: {
        sensorReadings: jsonValue(input.sensorReadings ?? {}),
        title: input.title ?? "",
        note: input.note ?? "",
        timestamp: new Date(input.timestamp),
        latitude: input.latitude,
        longitude: input.longitude,
        photo: input.photo ?? null,
        audio: input.audio ?? null,
        deviceName: input.deviceName ?? null,
        smellWalkId: input.smellWalkId ?? null,
        installationId: input.installationId ?? null,
      },
    });

    res.status(201).json({
      annotation,
    });
  } catch (error) {
    console.error("Failed to save annotation", error);
    res.status(500).json({ error: "Failed to save annotation" });
  }
});

export default router;
