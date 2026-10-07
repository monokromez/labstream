import cors from "cors";
import express from "express";
import rateLimit from "express-rate-limit";
import helmet from "helmet";

export function createApp() {
  const app = express();

  app.use(helmet());
  app.use(cors({ origin: process.env.FRONTEND_ORIGIN }));
  app.use(express.json({ limit: "1mb" }));
  app.use(rateLimit({ windowMs: 15 * 60 * 1000, limit: 300 }));

  app.get("/health", (_req, res) => {
    res.json({ status: "ok" });
  });

  return app;
}
