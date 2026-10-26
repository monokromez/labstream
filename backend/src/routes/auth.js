import argon2 from "argon2";
import { Router } from "express";
import { createAccessToken } from "../auth/accessToken.js";
import { requireAuth, requireSameOrigin, SESSION_COOKIE } from "../auth/middleware.js";
import { hashOneTimeCode } from "../auth/oneTimeCode.js";

const STAFF_ROLES = new Set(["administrator", "cashier", "medical_technologist", "pathologist"]);

export function createAuthRouter(client) {
  const router = Router();
  const cookieOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
    path: "/api",
    maxAge: 8 * 60 * 60 * 1000,
  };
  router.use(requireSameOrigin);

  router.post("/activate", async (req, res, next) => {
    try {
      const identifier = String(req.body?.identifier ?? "").trim().toUpperCase();
      const activationCode = String(req.body?.activationCode ?? "").trim();
      const newPassword = req.body?.newPassword;
      if (!identifier || !activationCode || typeof newPassword !== "string" || newPassword.length < 12) {
        return res.status(400).json({ error: "INVALID_ACTIVATION", message: "Provide your account ID, activation code, and a password of at least 12 characters." });
      }
      const passwordHash = await argon2.hash(newPassword, { type: argon2.argon2id });
      const hash = hashOneTimeCode(activationCode);
      const result = await client.begin(async (tx) => {
        const [account] = await tx.unsafe(
          `select u.id, u.clinic_id, u.role, u.username, p.pid,
                  coalesce(nullif(concat_ws(' ', p.first_name, p.middle_name, p.last_name), ''), nullif(concat_ws(' ', sp.first_name, sp.middle_name, sp.last_name), ''), u.username) as display_name,
                  at.id as token_id
             from public.account_tokens at
             join public.users u on u.id = at.user_id and u.clinic_id = at.clinic_id
             left join public.patients p on p.portal_user_id = u.id and p.clinic_id = u.clinic_id
             left join public.staff_profiles sp on sp.user_id = u.id and sp.clinic_id = u.clinic_id
            where (upper(u.username) = $1 or upper(p.pid) = $1)
            and at.token_hash = $2 and at.purpose = 'activation'
              and at.consumed_at is null and (at.expires_at is null or at.expires_at > now())
              and u.is_active = false
            for update of at, u`,
          [identifier, hash],
        );
        if (!account) return null;
        await tx.unsafe(
          `update public.users set password_hash = $1, is_active = true,
                  must_change_password = false, updated_at = now()
            where id = $2 and clinic_id = $3`,
          [passwordHash, account.id, account.clinic_id],
        );
        await tx.unsafe(`update public.account_tokens set consumed_at = now() where id = $1`, [account.token_id]);
        return account;
      });
      if (!result) return res.status(400).json({ error: "INVALID_ACTIVATION", message: "The activation details are invalid or already used." });
      const token = createAccessToken({
        id: result.id,
        clinic_id: result.clinic_id,
        role: result.role,
        must_change_password: false,
      }, process.env.AUTH_TOKEN_SECRET);
      res.cookie(SESSION_COOKIE, token, cookieOptions);
      res.set("Cache-Control", "no-store");
      return res.json({ message: "Account activated.", user: { id: result.id, role: result.role, username: result.username, displayName: result.display_name, pid: result.pid } });
    } catch (error) {
      return next(error);
    }
  });

  router.post("/login", async (req, res, next) => {
    try {
      const identifier = String(req.body?.identifier ?? "").trim().toUpperCase();
      const password = req.body?.password;
      if (!identifier || typeof password !== "string" || !password) {
        return res.status(400).json({ error: "INVALID_CREDENTIALS", message: "Enter your username or PID and password." });
      }
      const [user] = await client.unsafe(
        `select u.id, u.clinic_id, u.role, u.password_hash, u.is_active,
                u.must_change_password, u.username, p.pid,
                coalesce(nullif(concat_ws(' ', p.first_name, p.middle_name, p.last_name), ''), nullif(concat_ws(' ', sp.first_name, sp.middle_name, sp.last_name), ''), u.username) as display_name
           from public.users u
           left join public.patients p on p.portal_user_id = u.id and p.clinic_id = u.clinic_id
           left join public.staff_profiles sp on sp.user_id = u.id and sp.clinic_id = u.clinic_id
          where u.clinic_id = (select id from public.clinics where is_active = true)
            and (upper(u.username) = $1 or upper(p.pid) = $1)
          limit 1`,
        [identifier],
      );
      const verified = user?.password_hash && user.is_active
        ? await argon2.verify(user.password_hash, password).catch(() => false)
        : false;
      if (!verified) return res.status(401).json({ error: "INVALID_CREDENTIALS", message: "The supplied sign-in details are not valid." });
      if (!STAFF_ROLES.has(user.role) && user.role !== "patient") {
        return res.status(403).json({ error: "ACCOUNT_ROLE_INVALID" });
      }
      const [updated] = await client.unsafe(
        `update public.users set last_sign_in_at = now(), updated_at = now()
          where id = $1 and clinic_id = $2
          returning id`,
        [user.id, user.clinic_id],
      );
      if (!updated) return res.status(401).json({ error: "INVALID_CREDENTIALS" });
      const token = createAccessToken(user, process.env.AUTH_TOKEN_SECRET);
      res.cookie(SESSION_COOKIE, token, cookieOptions);
      res.set("Cache-Control", "no-store");
      return res.json({
        user: {
          id: user.id,
          clinicId: user.clinic_id,
          role: user.role,
          username: user.username,
          displayName: user.display_name,
          pid: user.pid,
          mustChangePassword: user.must_change_password,
        },
      });
    } catch (error) {
      return next(error);
    }
  });

  router.get("/me", requireAuth, async (req, res, next) => {
    try {
      const [user] = await client.unsafe(
        `select u.id, u.clinic_id, u.role, u.username, u.is_active, u.must_change_password,
                coalesce(nullif(concat_ws(' ', p.first_name, p.middle_name, p.last_name), ''), nullif(concat_ws(' ', sp.first_name, sp.middle_name, sp.last_name), ''), u.username) as display_name
           from public.users u
           left join public.patients p on p.portal_user_id = u.id and p.clinic_id = u.clinic_id
           left join public.staff_profiles sp on sp.user_id = u.id and sp.clinic_id = u.clinic_id
          where u.id = $1 and u.clinic_id = $2 and u.is_active = true`,
        [req.user.sub, req.user.clinicId],
      );
      if (!user) return res.status(401).json({ error: "ACCOUNT_INACTIVE" });
      res.set("Cache-Control", "no-store");
      return res.json({
        id: user.id,
        clinicId: user.clinic_id,
        role: user.role,
        username: user.username,
        displayName: user.display_name,
        mustChangePassword: user.must_change_password,
      });
    } catch (error) {
      return next(error);
    }
  });

  router.post("/change-password", requireAuth, async (req, res, next) => {
    try {
      const currentPassword = req.body?.currentPassword;
      const newPassword = req.body?.newPassword;
      if (typeof currentPassword !== "string" || typeof newPassword !== "string" || newPassword.length < 12) {
        return res.status(400).json({ error: "INVALID_PASSWORD", message: "Enter your current password and a new password of at least 12 characters." });
      }
      const [user] = await client.unsafe(
        `select id, clinic_id, role, username, password_hash, is_active
           from public.users where id = $1 and clinic_id = $2`,
        [req.user.sub, req.user.clinicId],
      );
      if (!user?.is_active || !user.password_hash || !await argon2.verify(user.password_hash, currentPassword).catch(() => false)) {
        return res.status(401).json({ error: "INVALID_CURRENT_PASSWORD" });
      }
      const passwordHash = await argon2.hash(newPassword, { type: argon2.argon2id });
      await client.unsafe(
        `update public.users set password_hash = $1, must_change_password = false, updated_at = now()
          where id = $2 and clinic_id = $3`,
        [passwordHash, user.id, user.clinic_id],
      );
      const token = createAccessToken({ ...user, must_change_password: false }, process.env.AUTH_TOKEN_SECRET);
      res.cookie(SESSION_COOKIE, token, cookieOptions);
      res.set("Cache-Control", "no-store");
      return res.json({ message: "Password updated." });
    } catch (error) {
      return next(error);
    }
  });

  router.post("/logout", (_req, res) => {
    res.clearCookie(SESSION_COOKIE, { ...cookieOptions, maxAge: undefined });
    res.set("Cache-Control", "no-store");
    return res.status(204).end();
  });

  return router;
}
