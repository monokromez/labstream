import { createHash, randomBytes } from "node:crypto";

export function createOneTimeCode() {
  const code = randomBytes(32).toString("base64url");
  return { code, hash: createHash("sha256").update(code).digest("hex") };
}

export function hashOneTimeCode(code) {
  return createHash("sha256").update(code).digest("hex");
}
