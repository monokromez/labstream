import { verifyAccessToken } from "./accessToken.js";

export const SESSION_COOKIE = "labstream_session";

function readSessionToken(req) {
  const [scheme, bearer] = (req.get("authorization") ?? "").split(" ");
  if (scheme?.toLowerCase() === "bearer" && bearer) return bearer;
  const cookie = (req.get("cookie") ?? "").split(";").map((part) => part.trim())
    .find((part) => part.startsWith(`${SESSION_COOKIE}=`));
  return cookie ? decodeURIComponent(cookie.slice(SESSION_COOKIE.length + 1)) : null;
}

export function requireAuth(req, res, next) {
  const token = readSessionToken(req);
  if (!token) {
    return res.status(401).json({ error: "AUTH_REQUIRED", message: "Sign in to continue." });
  }
  const user = verifyAccessToken(token, process.env.AUTH_TOKEN_SECRET);
  if (!user) return res.status(401).json({ error: "INVALID_SESSION", message: "Your session is invalid or expired." });
  req.user = user;
  return next();
}

export function createRequireAuth(client) {
  return async (req, res, next) => {
    const token = readSessionToken(req);
    if (!token) {
      return res.status(401).json({ error: "AUTH_REQUIRED", message: "Sign in to continue." });
    }
    const claims = verifyAccessToken(token, process.env.AUTH_TOKEN_SECRET);
    if (!claims) return res.status(401).json({ error: "INVALID_SESSION", message: "Your session is invalid or expired." });
    try {
      const [account] = await client.unsafe(
        `select id, clinic_id, role, is_active, must_change_password
           from public.users where id = $1 and clinic_id = $2`,
        [claims.sub, claims.clinicId],
      );
      if (!account?.is_active || account.role !== claims.role) {
        return res.status(401).json({ error: "ACCOUNT_INACTIVE", message: "This account is no longer active." });
      }
      req.user = {
        ...claims,
        role: account.role,
        mustChangePassword: account.must_change_password,
      };
      return next();
    } catch (error) {
      return next(error);
    }
  };
}

export function requireSameOrigin(req, res, next) {
  if (["GET", "HEAD", "OPTIONS"].includes(req.method)) return next();
  const expectedOrigin = process.env.FRONTEND_ORIGIN || "http://localhost:5173";
  if (req.get("origin") !== expectedOrigin) {
    return res.status(403).json({ error: "ORIGIN_NOT_ALLOWED", message: "This request did not come from the configured application origin." });
  }
  return next();
}

export function allowRoles(...roles) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: "AUTH_REQUIRED" });
    if (!roles.includes(req.user.role)) return res.status(403).json({ error: "FORBIDDEN" });
    return next();
  };
}

export function requirePasswordSetupComplete(req, res, next) {
  if (req.user?.mustChangePassword) {
    return res.status(403).json({
      error: "PASSWORD_CHANGE_REQUIRED",
      message: "Change your temporary password before using the system.",
    });
  }
  return next();
}
