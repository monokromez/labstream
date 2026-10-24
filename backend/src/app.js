import cors from "cors";
import express from "express";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import { createAuthRouter } from "./routes/auth.js";
import { createApiRouter } from "./routes/api.js";
import { createCashierRouter } from "./routes/cashier.js";
import { createStaffRouter } from "./routes/staff.js";
import { createTechnologistRouter } from "./routes/technologist.js";
import { createPathologistRouter } from "./routes/pathologist.js";
import { createPatientRouter } from "./routes/patient.js";
import { createAdministratorRouter } from "./routes/administrator.js";
import { toApiShape } from "./apiShape.js";

export function createApp({ database = null, publishCatalogChanged = null, publishClinicChanged = null } = {}) {
  const app = express();
  const allowedOrigin = process.env.FRONTEND_ORIGIN || "http://localhost:5173";

  app.disable("x-powered-by");
  app.use(helmet());
  app.use(cors({ origin: allowedOrigin, credentials: true }));
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

  if (database) {
    const authAttemptLimiter = rateLimit({
      windowMs: 15 * 60 * 1000,
      // Keep production protection strict, while allowing realistic local
      // activation and sign-in retries during development.
      limit: process.env.NODE_ENV === "production" ? 10 : 60,
      standardHeaders: "draft-8",
      legacyHeaders: false,
      skip: (req) => req.method !== "POST",
      handler: (_req, res) => res.status(429).json({
        error: "AUTH_RATE_LIMITED",
        message: "Too many sign-in or activation attempts. Wait a few minutes, then try again.",
      }),
    });
    app.use("/api/auth/login", authAttemptLimiter);
    app.use("/api/auth/activate", authAttemptLimiter);
    // Notify other signed-in users in the same laboratory after a successful write.
    // req.user is populated by the route's auth middleware before the response finishes.
    app.use("/api", (req, res, next) => {
      if (["GET", "HEAD", "OPTIONS"].includes(req.method) || req.path.startsWith("/auth/")) return next();
      res.once("finish", () => {
        if (res.statusCode >= 200 && res.statusCode < 400 && req.user?.clinicId) {
          publishClinicChanged?.(req.user.clinicId);
        }
      });
      next();
    });
    app.use("/api/auth", createAuthRouter(database.client));
    app.use("/api/cashier", createCashierRouter(database));
    app.use("/api/admin/staff", createStaffRouter(database));
    app.use("/api/technologist", createTechnologistRouter(database));
    app.use("/api/pathologist", createPathologistRouter(database));
    app.use("/api/patient", createPatientRouter(database));
    app.use("/api/admin", createAdministratorRouter({ ...database, publishCatalogChanged }));
    app.use("/api", createApiRouter(database));
    app.use("/api", (_req, res) => res.status(404).json({ error: "NOT_FOUND" }));
  } else {
    app.use("/api", (_req, res) => res.status(503).json({
      error: "DATABASE_NOT_ENABLED",
      message: "API data routes are unavailable while DATABASE_ENABLED is false.",
    }));
  }

  app.use((error, _req, res, _next) => {
    if (error?.type === "entity.parse.failed") {
      return res.status(400).json({ error: "INVALID_JSON", message: "Request body must be valid JSON." });
    }
    console.error("Unhandled API error", error);
    return res.status(500).json({ error: "INTERNAL_ERROR", message: "An unexpected server error occurred." });
  });
  return app;
}
