import cors from "cors";
import express from "express";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import authRoutes from "./routes/auth.js";
import pathologistRoutes from "./routes/pathologist.js";

export function createApp({ database = null, publishCatalogChanged = null, publishClinicChanged = null } = {}) {
  const app = express();
  const allowedOrigin = process.env.FRONTEND_ORIGIN || "http://localhost:5173";

  app.disable("x-powered-by");
  app.use(helmet());
  app.use(cors({ origin: allowedOrigin, credentials: true, exposedHeaders: ["Content-Disposition"] }));
  app.use(express.json({ limit: "1mb" }));
  app.use((_req, res, next) => {
    const sendJson = res.json.bind(res);
    res.json = (body) => sendJson(toApiShape(body));
    next();
  });
  app.use(rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: process.env.NODE_ENV === "production" ? 300 : 1200,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    // Page loads and polling should not exhaust the write-request allowance.
    skip: (req) => ["GET", "HEAD", "OPTIONS"].includes(req.method),
    handler: (_req, res) => res.status(429).json({
      error: "RATE_LIMITED",
      message: "Too many update requests. Wait briefly, then try again.",
    }),
  }));

  app.get("/health", async (_req, res) => {
    if (!database) return res.status(503).json({ status: "degraded", database: "not_connected" });
    try {
      await database.client.unsafe("select 1 as connected");
      return res.json({ status: "ok", database: "connected" });
    } catch {
      return res.status(503).json({ status: "degraded", database: "unavailable" });
    }
  });

  app.use("/api/auth", authRoutes);
  app.use("/api/pathologist", pathologistRoutes);

  app.use((error, _req, res, _next) => {
    console.error(error);
    res.status(500).json({ error: "The server could not complete the request." });
  });

  return app;
}
