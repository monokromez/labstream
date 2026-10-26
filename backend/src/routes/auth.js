import argon2 from "argon2";
import { Router } from "express";
import rateLimit from "express-rate-limit";
import { client } from "../db/index.js";
import { createSessionToken, requireAuth, SESSION_COOKIE_NAME } from "../middleware/auth.js";

const router = Router();
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { error: "Too many sign-in attempts. Try again in 15 minutes." },
});

router.post("/login", loginLimiter, async (req, res) => {
  const email = typeof req.body?.email === "string" ? req.body.email.trim().toLowerCase() : "";
  const password = typeof req.body?.password === "string" ? req.body.password : "";
  if (!email || !password || email.length > 254 || password.length > 1024) {
    return res.status(400).json({ error: "Enter your email and password." });
  }

  if (!process.env.SESSION_SECRET || process.env.SESSION_SECRET.length < 32) {
    return res.status(503).json({ error: "Sign-in is not configured on this server." });
  }

  const [user] = await client`
    SELECT id, email, role, password_hash, is_active
    FROM public.users
    WHERE lower(email) = ${email}
    LIMIT 1
  `;

  let passwordMatches = false;
  if (user?.password_hash) {
    try {
      passwordMatches = await argon2.verify(user.password_hash, password);
    } catch {
      passwordMatches = false;
    }
  }

  if (!user || !user.is_active || !passwordMatches) {
    return res.status(401).json({ error: "Email or password is incorrect." });
  }

  const accessToken = createSessionToken(user);
  res.cookie(SESSION_COOKIE_NAME, accessToken, {
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    maxAge: 8 * 60 * 60 * 1000,
    path: "/api",
  });
  return res.json({
    expiresIn: 8 * 60 * 60,
    user: { id: user.id, email: user.email, role: user.role },
  });
});

router.get("/me", requireAuth, (req, res) => {
  res.json({ user: req.authUser });
});

router.post("/logout", (_req, res) => {
  res.clearCookie(SESSION_COOKIE_NAME, {
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    path: "/api",
  });
  res.status(204).end();
});

export default router;
