import { Router } from "express";
import { createOneTimeCode } from "../auth/oneTimeCode.js";
import { allowRoles, createRequireAuth, requirePasswordSetupComplete, requireSameOrigin } from "../auth/middleware.js";
import { emailService } from "../email.js";

const STAFF_ROLES = new Set(["cashier", "medical_technologist", "pathologist"]);
const ACTIVE_REQUEST_STATUSES = ["paid", "specimen_collection", "processing", "for_validation", "correction"];
const PUBLIC_EMAIL_DOMAINS = new Set([
  "gmail.com", "googlemail.com", "outlook.com", "hotmail.com", "live.com",
  "yahoo.com", "yahoo.com.ph", "icloud.com", "me.com",
]);

export function createStaffRouter({ client }) {
  const router = Router();
  router.use(createRequireAuth(client), requirePasswordSetupComplete, requireSameOrigin, allowRoles("administrator"));

  router.get("/", async (req, res, next) => {
    try {
      const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
      const pageSize = Math.min(100, Math.max(1, Number.parseInt(req.query.pageSize, 10) || 10));
      const offset = (page - 1) * pageSize;
      const role = String(req.query.role ?? "");
      const status = String(req.query.status ?? "");
      const [count] = await client.unsafe(
        `select count(*)::integer as total
           from public.users u
          where u.clinic_id = $1 and u.role <> 'patient'
            and ($2 = '' or u.role::text = $2)
            and ($3 = '' or u.is_active::text = $3)`,
        [req.user.clinicId, role, status],
      );
      const staff = await client.unsafe(
        `select u.id, u.username, u.email, u.role, u.is_active, u.last_sign_in_at,
                p.first_name, p.middle_name, p.last_name, p.date_of_birth,
                p.phone, p.country, p.city, p.house_number, p.street
           from public.users u
           join public.staff_profiles p on p.user_id = u.id and p.clinic_id = u.clinic_id
          where u.clinic_id = $1 and u.role <> 'patient'
            and ($2 = '' or u.role::text = $2)
            and ($3 = '' or u.is_active::text = $3)
          order by p.last_name, p.first_name
          limit $4 offset $5`,
        [req.user.clinicId, role, status, pageSize, offset],
      );
      return res.json({ data: staff, pagination: { page, pageSize, total: count.total, totalPages: Math.ceil(count.total / pageSize) } });
    } catch (error) {
      return next(error);
    }
  });

  router.post("/", async (req, res, next) => {
    try {
      const body = req.body ?? {};
      const role = String(body.role ?? "");
      const firstName = String(body.firstName ?? "").trim();
      const middleName = String(body.middleName ?? "").trim() || null;
      const lastName = String(body.lastName ?? "").trim();
      const email = String(body.email ?? "").trim().toLowerCase();
      const phone = String(body.phone ?? "").trim();
      const dateOfBirth = String(body.dateOfBirth ?? "").trim();
      if (!STAFF_ROLES.has(role)) return res.status(400).json({ error: "INVALID_STAFF_ROLE", message: "Choose a non-administrator staff role." });
      if (!firstName || !lastName || !email || !phone || !/^\d{4}-\d{2}-\d{2}$/.test(dateOfBirth)) {
        return res.status(400).json({ error: "INVALID_STAFF_DETAILS", message: "Provide first name, surname, date of birth, contact number, and email." });
      }
      const emailDomain = email.slice(email.lastIndexOf("@") + 1);
      if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !PUBLIC_EMAIL_DOMAINS.has(emailDomain)) {
        return res.status(400).json({ error: "INVALID_STAFF_EMAIL", message: "Use a valid personal email address from a supported public email provider." });
      }
      const activation = createOneTimeCode();
      const result = await client.begin(async (tx) => {
        const [user] = await tx.unsafe(
          `insert into public.users (clinic_id, role, email, is_active, must_change_password)
           values ($1, $2, $3, false, true)
           returning id, clinic_id, staff_number, username, role`,
          [req.user.clinicId, role, email],
        );
        await tx.unsafe(
          `insert into public.staff_profiles
            (user_id, clinic_id, first_name, middle_name, last_name, date_of_birth, phone, email,
             country, city, house_number, street)
           values ($1, $2, $3, $4, $5, $6::date, $7, $8, $9, $10, $11, $12)`,
          [user.id, user.clinic_id, firstName, middleName, lastName, dateOfBirth, phone, email,
            body.country || null, body.city || null, body.houseNumber || null, body.street || null],
        );
        await tx.unsafe(
          `insert into public.account_tokens (clinic_id, user_id, token_hash, purpose, expires_at)
           values ($1, $2, $3, 'activation', null)`,
          [user.clinic_id, user.id, activation.hash],
        );
        await tx.unsafe(
          `insert into public.audit_logs (clinic_id, actor_user_id, action, entity_type, entity_id, details)
           values ($1, $2, 'staff.created', 'user', $3, jsonb_build_object('role', $4::text, 'username', $5::text))`,
          [user.clinic_id, req.user.sub, user.id, role, user.username],
        );
        return { ...user, email, firstName, lastName };
      });
      const emailDelivery = await emailService.sendActivationEmail({
        to: result.email,
        name: `${result.firstName} ${result.lastName}`,
        accountId: result.username,
        code: activation.code,
        role: result.role.replaceAll("_", " "),
      });
      return res.status(201).json({
        data: { id: result.id, username: result.username, role: result.role, isActive: false },
        activation: { code: activation.code, revealOnce: true, expires: null },
        emailDelivery,
      });
    } catch (error) {
      if (error.code === "23505") return res.status(409).json({ error: "STAFF_EMAIL_EXISTS", message: "This email is already assigned to an account in the clinic." });
      return next(error);
    }
  });

  router.patch("/:id/status", async (req, res, next) => {
    try {
      const userId = req.params.id;
      const isActive = req.body?.isActive;
      if (typeof isActive !== "boolean") return res.status(400).json({ error: "INVALID_STATUS" });
      if (userId === req.user.sub) return res.status(409).json({ error: "CANNOT_CHANGE_OWN_STATUS" });
      const reassignedRequestIds = [];
      const result = await client.begin(async (tx) => {
        const [target] = await tx.unsafe(
          `select id, role, is_active, password_hash
             from public.users where id = $1 and clinic_id = $2 and role <> 'patient' for update`,
          [userId, req.user.clinicId],
        );
        if (!target) throw Object.assign(new Error("Staff account was not found."), { code: "STAFF_NOT_FOUND" });
        if (isActive && !target.password_hash) throw Object.assign(new Error("This account must be activated by its owner before it can be enabled."), { code: "ACTIVATION_REQUIRED" });
        if (!isActive && target.is_active) {
          const assignmentColumn = target.role === "medical_technologist" ? "assigned_technologist_id"
            : target.role === "pathologist" ? "assigned_pathologist_id" : null;
          if (assignmentColumn) {
            const requests = await tx.unsafe(
              `select id from public.test_requests
                where clinic_id = $1 and ${assignmentColumn} = $2 and status = any($3::public.request_status[])
                order by requested_at for update`,
              [req.user.clinicId, target.id, ACTIVE_REQUEST_STATUSES],
            );
            for (const request of requests) {
              const candidateRole = target.role;
              const [candidate] = await tx.unsafe(
                `select u.id
                   from public.users u
                  where u.clinic_id = $1 and u.role = $2::public.user_role and u.is_active = true and u.id <> $3
                  order by (select count(*) from public.test_requests active
                             where active.clinic_id = u.clinic_id
                               and active.${assignmentColumn} = u.id
                               and active.status = any($4::public.request_status[])) asc,
                           u.last_sign_in_at nulls first
                  limit 1 for update of u skip locked`,
                [req.user.clinicId, candidateRole, target.id, ACTIVE_REQUEST_STATUSES],
              );
              if (!candidate) throw Object.assign(new Error("No active qualified staff member is available to take this work. The account remains active."), { code: "NO_REASSIGNEE" });
              await tx.unsafe(`update public.test_requests set ${assignmentColumn} = $1, updated_at = now() where id = $2 and clinic_id = $3`, [candidate.id, request.id, req.user.clinicId]);
              reassignedRequestIds.push(request.id);
            }
          }
        }
        const [updated] = await tx.unsafe(
          `update public.users set is_active = $1, updated_at = now() where id = $2 and clinic_id = $3 returning id, role, is_active`,
          [isActive, target.id, req.user.clinicId],
        );
        await tx.unsafe(
          `insert into public.audit_logs (clinic_id, actor_user_id, action, entity_type, entity_id, details)
           values ($1, $2, $3, 'user', $4, jsonb_build_object('isActive', $5::boolean, 'reassignedRequestIds', $6::jsonb))`,
          [req.user.clinicId, req.user.sub, isActive ? "staff.activated" : "staff.deactivated", target.id, isActive, JSON.stringify(reassignedRequestIds)],
        );
        return updated;
      });
      return res.json({ data: result, reassignedRequestCount: reassignedRequestIds.length });
    } catch (error) {
      if (["STAFF_NOT_FOUND", "ACTIVATION_REQUIRED", "NO_REASSIGNEE"].includes(error.code)) {
        const status = error.code === "STAFF_NOT_FOUND" ? 404 : 409;
        return res.status(status).json({ error: error.code, message: error.message });
      }
      return next(error);
    }
  });

  return router;
}
