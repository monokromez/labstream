import cors from "cors";
import express from "express";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import authRoutes from "./routes/auth.js";
import pathologistRoutes from "./routes/pathologist.js";

export function createApp() {
  const app = express();

  app.use(helmet());
  app.use(cors({ origin: process.env.FRONTEND_ORIGIN, credentials: true }));
  app.use(express.json({ limit: "1mb" }));
  app.use(rateLimit({ windowMs: 15 * 60 * 1000, limit: 300 }));

  app.get("/health", (_req, res) => {
    res.json({ status: "ok" });
  });

  app.use("/api/auth", authRoutes);
  app.use("/api/pathologist", pathologistRoutes);

  app.use((error, _req, res, _next) => {
    console.error(error);
    res.status(500).json({ error: "The server could not complete the request." });
  });

  return app;
}
