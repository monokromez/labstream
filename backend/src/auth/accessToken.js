import { createHmac, timingSafeEqual } from "node:crypto";

const ISSUER = "labstream-api";
const AUDIENCE = "labstream-client";
const TOKEN_TTL_SECONDS = 60 * 60 * 8;

function encode(value) {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}

function sign(input, secret) {
  return createHmac("sha256", secret).update(input).digest("base64url");
}

export function createAccessToken(user, secret, now = Date.now()) {
  if (!secret || Buffer.byteLength(secret) < 32) {
    throw new Error("AUTH_TOKEN_SECRET must contain at least 32 bytes.");
  }
  const issuedAt = Math.floor(now / 1000);
  const header = encode({ alg: "HS256", typ: "JWT" });
  const payload = encode({
    sub: user.id,
    clinicId: user.clinic_id,
    branchId: user.branch_id ?? null,
    role: user.role,
    mustChangePassword: Boolean(user.must_change_password),
    iss: ISSUER,
    aud: AUDIENCE,
    iat: issuedAt,
    exp: issuedAt + TOKEN_TTL_SECONDS,
  });
  const content = `${header}.${payload}`;
  return `${content}.${sign(content, secret)}`;
}

export function verifyAccessToken(token, secret, now = Date.now()) {
  if (!secret || typeof token !== "string") return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [headerPart, payloadPart, signature] = parts;
  const expected = sign(`${headerPart}.${payloadPart}`, secret);
  const actualBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  if (actualBuffer.length !== expectedBuffer.length || !timingSafeEqual(actualBuffer, expectedBuffer)) return null;

  try {
    const header = JSON.parse(Buffer.from(headerPart, "base64url").toString("utf8"));
    const payload = JSON.parse(Buffer.from(payloadPart, "base64url").toString("utf8"));
    const nowSeconds = Math.floor(now / 1000);
    if (header.alg !== "HS256" || payload.iss !== ISSUER || payload.aud !== AUDIENCE) return null;
    if (typeof payload.sub !== "string" || typeof payload.clinicId !== "string") return null;
    if (!Number.isInteger(payload.exp) || payload.exp <= nowSeconds) return null;
    if (!Number.isInteger(payload.iat) || payload.iat > nowSeconds + 30) return null;
    return payload;
  } catch {
    return null;
  }
}
