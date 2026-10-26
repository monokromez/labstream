import { createHmac, timingSafeEqual } from "node:crypto";
import { client } from "../db/index.js";

const SESSION_TTL_SECONDS = 8 * 60 * 60;
export const SESSION_COOKIE_NAME = "labstream_session";

function getSessionSecret() {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("SESSION_SECRET must contain at least 32 characters");
  }
  return secret;
}

function signatureFor(payload) {
  return createHmac("sha256", getSessionSecret()).update(payload).digest("base64url");
}

export function createSessionToken(user) {
  const now = Math.floor(Date.now() / 1000);
  const payload = Buffer.from(JSON.stringify({
    sub: user.id,
    iat: now,
    exp: now + SESSION_TTL_SECONDS,
  })).toString("base64url");

  return `${payload}.${signatureFor(payload)}`;
}

function readSessionToken(token) {
  const [payload, signature, extra] = token.split(".");
  if (!payload || !signature || extra) return null;

  let expectedSignature;
  try {
    expectedSignature = Buffer.from(signatureFor(payload));
  } catch {
    return null;
  }
  const actualSignature = Buffer.from(signature);
  if (actualSignature.length !== expectedSignature.length || !timingSafeEqual(actualSignature, expectedSignature)) {
    return null;
  }

  try {
    const session = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    if (typeof session.sub !== "string" || !session.exp || session.exp <= Math.floor(Date.now() / 1000)) {
      return null;
    }
    return session;
  } catch {
    return null;
  }
}

export async function requireAuth(req, res, next) {
  const authorization = req.get("authorization") ?? "";
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  const cookie = req.get("cookie") ?? "";
  const cookieMatch = cookie.match(/(?:^|;\s*)labstream_session=([^;]+)/);
  const cookieToken = cookieMatch?.[1] ?? "";
  const session = readSessionToken(match?.[1] ?? cookieToken);
  if (!session) {
    return res.status(401).json({ error: "Sign in to continue." });
  }

  try {
    const [user] = await client`
      SELECT id, email, role, is_active
      FROM public.users
      WHERE id = ${session.sub}
      LIMIT 1
    `;
    if (!user || !user.is_active) {
      return res.status(401).json({ error: "This session is no longer active. Sign in again." });
    }
    req.authUser = { id: user.id, email: user.email, role: user.role };
    return next();
  } catch (error) {
    return next(error);
  }
}

export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.authUser) return res.status(401).json({ error: "Sign in to continue." });
    if (!roles.includes(req.authUser.role)) {
      return res.status(403).json({ error: "Your account cannot access this function." });
    }
    return next();
  };
}
