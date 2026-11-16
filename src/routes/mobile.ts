import { Router, Response } from "express";
import jwt from "jsonwebtoken";
import { requireAppSession } from "../middleware/appSession.js";

const router = Router();

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function escapeInflux(value: string): string {
  return value.replace(/([,= ])/g, "\\$1");
}

router.post("/session", (req, res: Response) => {
  const secret = process.env.JWT_SECRET;
  const installationId = isRecord(req.body)
    ? req.body.installationId
    : undefined;

  if (!secret) {
    res.status(500).json({ error: "JWT_SECRET is not configured" });
    return;
  }
  if (
    typeof installationId !== "string" ||
    !/^[a-zA-Z0-9_-]{16,128}$/.test(installationId)
  ) {
    res.status(400).json({ error: "A valid installationId is required" });
    return;
  }

  const token = jwt.sign({ aud: "brian-mobile", installationId }, secret, {
    expiresIn: "1h",
  });
  res.json({ token, expiresIn: 3600 });
});

router.post(
  "/mobile/influx/timeseries",
  requireAppSession,
  async (req, res: Response) => {
    const influxUrl = process.env.INFLUX_URL?.replace(/\/+$/, "");
    const token = process.env.INFLUX_TOKEN;
    const org = process.env.INFLUX_ORG;
    const bucket = process.env.INFLUX_TIMESERIES_BUCKET;
    const point = isRecord(req.body) ? req.body.point : undefined;

    if (!influxUrl || !token || !org || !bucket) {
      res.status(500).json({ error: "Influx configuration is incomplete" });
      return;
    }
    if (!isRecord(point) || typeof point.lineProtocol !== "string") {
      res.status(400).json({ error: "A point is required" });
      return;
    }

    try {
      const response = await fetch(
        `${influxUrl}/api/v2/write?org=${encodeURIComponent(org)}&bucket=${encodeURIComponent(bucket)}&precision=ns`,
        {
          method: "POST",
          headers: {
            Authorization: `Token ${token}`,
            "Content-Type": "text/plain; charset=utf-8",
            Accept: "application/json",
          },
          body: point.lineProtocol,
        },
      );

      const body = await response.text();

      if (!response.ok) {
        console.error(
          `Influx timeseries write rejected with HTTP ${response.status}: ${body}`,
        );
      }

      res
        .status(response.status)
        .type(response.headers.get("content-type") ?? "application/json")
        .send(body);
    } catch (error) {
      console.error("Influx proxy failed", error);
      res.status(502).json({ error: "Influx request failed" });
    }
  },
);

router.post(
  "/mobile/sensor-record",
  requireAppSession,
  async (req, res: Response) => {
    const record = req.body;
    const influxUrl = process.env.INFLUX_URL?.replace(/\/+$/, "");
    const token = process.env.INFLUX_TOKEN;
    const org = process.env.INFLUX_ORG;
    const bucket = process.env.INFLUX_TIMESERIES_BUCKET;

    if (!influxUrl || !token || !org || !bucket) {
      res.status(500).json({ error: "Influx configuration is incomplete" });
      return;
    }
    if (!isRecord(record) || typeof record.id !== "string") {
      res.status(400).json({ error: "A valid sensor record is required" });
      return;
    }

    const fields = Object.entries(record)
      .filter(
        ([key, value]) =>
          key !== "id" &&
          key !== "title" &&
          key !== "description" &&
          key !== "recordedAt" &&
          typeof value === "number" &&
          Number.isFinite(value),
      )
      .map(([key, value]) => `${escapeInflux(key)}=${value}`)
      .join(",");
    if (!fields) {
      res
        .status(400)
        .json({ error: "Sensor record contains no numeric fields" });
      return;
    }

    const line = `sensor_record,record_id=${escapeInflux(record.id)} ${fields} ${
      typeof record.recordedAt === "number"
        ? Math.round(record.recordedAt * 1_000_000)
        : Date.now() * 1_000_000
    }`;

    try {
      const response = await fetch(
        `${influxUrl}/api/v2/write?org=${encodeURIComponent(org)}&bucket=${encodeURIComponent(bucket)}&precision=ns`,
        {
          method: "POST",
          headers: {
            Authorization: `Token ${token}`,
            "Content-Type": "text/plain; charset=utf-8",
          },
          body: line,
        },
      );
      const body = await response.text();

      if (!response.ok) {
        console.error(
          `Influx sensor record write rejected with HTTP ${response.status}: ${body}`,
        );
      }

      res
        .status(response.status)
        .type(response.headers.get("content-type") ?? "application/json")
        .send(body);
    } catch (error) {
      console.error("Sensor record proxy failed", error);
      res.status(502).json({ error: "Sensor record upload failed" });
    }
  },
);

export default router;
