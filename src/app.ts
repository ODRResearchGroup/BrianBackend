import "dotenv/config";
import express from "express";
import path from "node:path";
import annotationRoutes from "./routes/annotations.js";
import mediaRoutes from "./routes/media.js";
import adminRoutes from "./routes/admin.js";
import mobileRoutes from "./routes/mobile.js";

const app = express();

app.use(express.json({ limit: "256kb" }));
app.use(express.urlencoded({ extended: false }));
app.get("/health", (_req, res) => res.json({ ok: true }));
app.use("/api", mediaRoutes);
app.use("/api", annotationRoutes);
app.use("/api", mobileRoutes);
app.use(adminRoutes);
app.use("/admin", express.static(path.join(process.cwd(), "admin", "dist")));
app.get("/admin/*splat", (_req, res) => {
  res.sendFile(path.join(process.cwd(), "admin", "dist", "index.html"));
});

app.use((error: unknown, _req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (res.headersSent) {
    next(error);
    return;
  }
  if (error instanceof Error && error.message.includes("File too large")) {
    res.status(413).json({ error: "Media file is too large (maximum 50 MB)" });
    return;
  }
  console.error("Unhandled request error", error);
  res.status(500).json({ error: "Internal server error" });
});

export default app;
