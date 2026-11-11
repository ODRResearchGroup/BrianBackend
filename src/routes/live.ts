import { Router, Response } from "express";
import { requireAppSession } from "../middleware/appSession.js";

/**
 * Read-only access to the smell-walk timeseries in InfluxDB, for live viewers
 * such as SensoryDataMaps.
 *
 * BrianReactNative writes one point per sensor every 5 s during a walk:
 *   measurement = sensor key (CH4, NO2, ..., TempC, GasResOhm)
 *   tags        = walk_id, device_name, date
 *   fields      = value, latitude, longitude, accuracy_m
 * All points of one flush share a timestamp, so pivoting on time gives one
 * snapshot per flush.
 *
 * Queries use InfluxQL over the v1-compatible /query endpoint, which works on
 * InfluxDB 2.x, Cloud (TSM) and Cloud Serverless. The bucket must be mapped to
 * a database (DBRP); INFLUX_QUERY_DATABASE overrides the database name, which
 * otherwise defaults to the bucket name.
 */

const router = Router();

const MAX_WALK_LIST_HOURS = 24 * 30;
const DEFAULT_SAMPLE_WINDOW = "7d";
const MEASUREMENT_CACHE_MS = 60_000;
/** Measurements in the bucket that are not per-sensor walk points. */
const NON_SENSOR_MEASUREMENTS = new Set(["sensor_record"]);

interface InfluxSeries {
  name: string;
  tags?: Record<string, string>;
  columns: string[];
  values: unknown[][];
}

interface InfluxStatementResult {
  series?: InfluxSeries[];
  error?: string;
}

class InfluxQueryError extends Error {}

function influxConfig() {
  const url = process.env.INFLUX_URL?.replace(/\/+$/, "");
  const token = process.env.INFLUX_TOKEN;
  const database =
    process.env.INFLUX_QUERY_DATABASE || process.env.INFLUX_TIMESERIES_BUCKET;
  if (!url || !token || !database) {
    return null;
  }
  return { url, token, database };
}

function quoteIdentifier(value: string): string {
  return `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

function quoteString(value: string): string {
  return `'${value.replace(/\\/g, "\\\\").replace(/'/g, "\\'")}'`;
}

async function influxQuery(query: string): Promise<InfluxStatementResult> {
  const config = influxConfig();
  if (!config) {
    throw new InfluxQueryError("Influx configuration is incomplete");
  }
  const params = new URLSearchParams({
    db: config.database,
    q: query,
    epoch: "ms",
  });
  const response = await fetch(`${config.url}/query?${params}`, {
    headers: {
      Authorization: `Token ${config.token}`,
      Accept: "application/json",
    },
  });
  const body = await response.text();
  if (!response.ok) {
    throw new InfluxQueryError(
      `InfluxDB query failed with HTTP ${response.status}: ${body.slice(0, 300)}`,
    );
  }
  const parsed = JSON.parse(body) as {
    results?: InfluxStatementResult[];
    error?: string;
  };
  const result = parsed.results?.[0];
  const error = parsed.error ?? result?.error;
  if (error) {
    throw new InfluxQueryError(`InfluxDB query failed: ${error}`);
  }
  return result ?? {};
}

let measurementCache: { at: number; names: string[] } | null = null;

/** The sensor measurements present in the bucket (cached briefly). */
async function sensorMeasurements(): Promise<string[]> {
  if (measurementCache && Date.now() - measurementCache.at < MEASUREMENT_CACHE_MS) {
    return measurementCache.names;
  }
  const result = await influxQuery("SHOW MEASUREMENTS");
  const names = (result.series ?? [])
    .flatMap((series) => series.values.map((row) => row[0]))
    .filter(
      (name): name is string =>
        typeof name === "string" && !NON_SENSOR_MEASUREMENTS.has(name),
    );
  measurementCache = { at: Date.now(), names };
  return names;
}

function column(series: InfluxSeries, name: string): number {
  return series.columns.indexOf(name);
}

function finite(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function sendError(res: Response, error: unknown, what: string) {
  console.error(`${what} failed`, error);
  if (error instanceof InfluxQueryError) {
    res.status(502).json({ error: error.message });
    return;
  }
  res.status(502).json({ error: `${what} failed` });
}

/**
 * GET /api/live/walks?hours=24
 * Walks with data in the last `hours` hours, most recently active first.
 */
router.get("/live/walks", requireAppSession, async (req, res: Response) => {
  const hoursParam = Number(req.query.hours ?? 24);
  const hours = Number.isFinite(hoursParam)
    ? Math.min(Math.max(hoursParam, 1), MAX_WALK_LIST_HOURS)
    : 24;

  try {
    const measurements = await sensorMeasurements();
    if (measurements.length === 0) {
      res.json({ walks: [], serverTime: Date.now() });
      return;
    }
    const from = measurements.map(quoteIdentifier).join(",");
    const where = `WHERE time > now() - ${Math.round(hours)}h`;
    const groupBy = `GROUP BY "walk_id", "device_name"`;
    // Selectors return the time of the selected point, giving each walk's span.
    const [first, last] = await Promise.all([
      influxQuery(`SELECT first("value") FROM ${from} ${where} ${groupBy}`),
      influxQuery(`SELECT last("value") FROM ${from} ${where} ${groupBy}`),
    ]);

    const walks = new Map<
      string,
      { walkId: string; deviceName: string | null; firstAt: number; lastAt: number; sensors: Set<string> }
    >();
    const visit = (result: InfluxStatementResult, edge: "first" | "last") => {
      for (const series of result.series ?? []) {
        const walkId = series.tags?.walk_id;
        if (!walkId) continue;
        const timeIndex = column(series, "time");
        for (const row of series.values) {
          const time = finite(row[timeIndex]);
          if (time === null) continue;
          const walk = walks.get(walkId) ?? {
            walkId,
            deviceName: series.tags?.device_name || null,
            firstAt: time,
            lastAt: time,
            sensors: new Set<string>(),
          };
          walk.sensors.add(series.name);
          if (edge === "first") walk.firstAt = Math.min(walk.firstAt, time);
          else walk.lastAt = Math.max(walk.lastAt, time);
          walks.set(walkId, walk);
        }
      }
    };
    visit(first, "first");
    visit(last, "last");

    res.json({
      walks: [...walks.values()]
        .map((walk) => ({ ...walk, sensors: [...walk.sensors].sort() }))
        .sort((a, b) => b.lastAt - a.lastAt),
      serverTime: Date.now(),
    });
  } catch (error) {
    sendError(res, error, "Live walk listing");
  }
});

/**
 * GET /api/live/walks/:walkId/samples?since=<epoch ms>
 * One snapshot per 5 s flush, newer than `since` (default: the last 7 days),
 * oldest first. Clients poll with `since` set to the last snapshot they have.
 */
router.get(
  "/live/walks/:walkId/samples",
  requireAppSession,
  async (req, res: Response) => {
    const walkId = req.params.walkId;
    const sinceParam = Number(req.query.since);
    const since = Number.isFinite(sinceParam) && sinceParam > 0 ? Math.floor(sinceParam) : null;

    if (typeof walkId !== "string" || walkId.length === 0 || walkId.length > 200) {
      res.status(400).json({ error: "A valid walk id is required" });
      return;
    }

    try {
      const measurements = await sensorMeasurements();
      if (measurements.length === 0) {
        res.json({ samples: [], serverTime: Date.now() });
        return;
      }
      const from = measurements.map(quoteIdentifier).join(",");
      const timeFilter =
        since !== null ? `time > ${since}ms` : `time > now() - ${DEFAULT_SAMPLE_WINDOW}`;
      const result = await influxQuery(
        `SELECT "value", "latitude", "longitude", "accuracy_m" FROM ${from} ` +
          `WHERE "walk_id" = ${quoteString(walkId)} AND ${timeFilter} GROUP BY "device_name"`,
      );

      const byTime = new Map<
        number,
        {
          time: number;
          deviceName: string | null;
          latitude: number | null;
          longitude: number | null;
          accuracyM: number | null;
          readings: Record<string, number>;
        }
      >();
      for (const series of result.series ?? []) {
        const timeIndex = column(series, "time");
        const valueIndex = column(series, "value");
        const latIndex = column(series, "latitude");
        const lonIndex = column(series, "longitude");
        const accIndex = column(series, "accuracy_m");
        for (const row of series.values) {
          const time = finite(row[timeIndex]);
          if (time === null) continue;
          const sample = byTime.get(time) ?? {
            time,
            deviceName: series.tags?.device_name || null,
            latitude: null,
            longitude: null,
            accuracyM: null,
            readings: {},
          };
          const value = finite(row[valueIndex]);
          if (value !== null) sample.readings[series.name] = value;
          sample.latitude ??= latIndex >= 0 ? finite(row[latIndex]) : null;
          sample.longitude ??= lonIndex >= 0 ? finite(row[lonIndex]) : null;
          sample.accuracyM ??= accIndex >= 0 ? finite(row[accIndex]) : null;
          byTime.set(time, sample);
        }
      }

      res.json({
        samples: [...byTime.values()].sort((a, b) => a.time - b.time),
        serverTime: Date.now(),
      });
    } catch (error) {
      sendError(res, error, "Live sample query");
    }
  },
);

export default router;
