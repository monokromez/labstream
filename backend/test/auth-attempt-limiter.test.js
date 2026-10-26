import assert from "node:assert/strict";
import { createServer } from "node:http";
import express from "express";
import { test } from "node:test";
import { createAuthAttemptLimiter } from "../src/auth/authAttemptLimiter.js";
import { createApp } from "../src/app.js";

test("successful auth requests do not use the failed-attempt allowance", async (context) => {
  const app = express();
  app.use(createAuthAttemptLimiter({ limit: 1 }));
  app.post("/login", (req, res) => res.sendStatus(Number(req.query.status) || 200));
  const server = createServer(app);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  context.after(() => new Promise((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
  }));

  const address = server.address();
  const url = `http://127.0.0.1:${address.port}/login`;
  const sendLogin = (target) => fetch(target, { method: "POST" });
  assert.equal((await sendLogin(url)).status, 200);
  assert.equal((await sendLogin(url)).status, 200);
  assert.equal((await sendLogin(`${url}?status=401`)).status, 401);
  assert.equal((await sendLogin(`${url}?status=401`)).status, 429);
});

test("production trusts exactly one proxy hop for client IP detection", () => {
  const previousNodeEnv = process.env.NODE_ENV;
  process.env.NODE_ENV = "production";
  try {
    assert.equal(createApp().get("trust proxy"), 1);
  } finally {
    if (previousNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = previousNodeEnv;
  }
});
