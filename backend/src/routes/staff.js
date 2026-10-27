import { Router } from "express";
import { createOneTimeCode } from "../auth/oneTimeCode.js";
import { allowRoles, createRequireAuth, requirePasswordSetupComplete, requireSameOrigin } from "../auth/middleware.js";
import { emailService } from "../email.js";
import { isUuid, validateStaffDetails, validateStaffRoleChange } from "../adminValidation.js";
import { isUniqueViolation } from "../db/errors.js";

const STAFF_ROLES = new Set(["cashier", "medical_technologist", "pathologist"]);
const ACTIVE_REQUEST_STATUSES = ["paid", "specimen_collection", "processing", "for_validation", "correction"];

export function createStaffRouter({ client }) {
  const router = Router();
  router.use(createRequireAuth(client), requirePasswordSetupComplete, requireSameOrigin, allowRoles("administrator"));

  router.get("/", async (req, res, next) => {
    try {
      const parsedPage = Number.parseInt(req.query.page, 10);
      const requestedPage = Number.isSafeInteger(parsedPage) && parsedPage > 0 ? parsedPage : 1;
      const pageSize = Math.min(100, Math.max(1, Number.parseInt(req.query.pageSize, 10) || 10));
      const role = String(req.query.role ?? "");
      const status = String(req.query.status ?? "");
      const query = String(req.query.q ?? "").trim();
      if (query.length > 100) return res.status(400).json({ error: "INVALID_SEARCH", message: "Staff search cannot exceed 100 characters." });
      if (role && !STAFF_ROLES.has(role)) return res.status(400).json({ error: "INVALID_STAFF_ROLE", message: "Choose a supported staff role." });
      if (status && !["true", "false"].includes(status)) return res.status(400).json({ error: "INVALID_STATUS_FILTER", message: "Choose Active or Inactive." });
      const [count] = await client.unsafe(
        `select count(*)::integer as total
           from public.users u
           join public.staff_profiles p on p.user_id = u.id and p.clinic_id = u.clinic_id
          where u.clinic_id = $1 and u.role <> 'patient' and u.deleted_at is null
            and ($2 = '' or u.role::text = $2)
            and ($3 = '' or u.is_active::text = $3)
            and ($4 = '' or u.username ilike '%' || $4 || '%' or u.email ilike '%' || $4 || '%'
              or p.first_name ilike '%' || $4 || '%' or p.middle_name ilike '%' || $4 || '%'
              or p.last_name ilike '%' || $4 || '%')`,
        [req.user.clinicId, role, status, query],
      );
      const totalPages = Math.ceil(count.total / pageSize);
      const page = Math.min(requestedPage, Math.max(1, totalPages));
      const offset = (page - 1) * pageSize;
      const staff = await client.unsafe(
        `select u.id, u.username, u.email, u.role, u.is_active, u.last_sign_in_at, (u.password_hash is null) as pending_activation,
                p.first_name, p.middle_name, p.last_name, p.date_of_birth,
                p.phone, p.country, p.city, p.house_number, p.street
           from public.users u
           join public.staff_profiles p on p.user_id = u.id and p.clinic_id = u.clinic_id
          where u.clinic_id = $1 and u.role <> 'patient' and u.deleted_at is null
            and ($2 = '' or u.role::text = $2)
            and ($3 = '' or u.is_active::text = $3)
            and ($6 = '' or u.username ilike '%' || $6 || '%' or u.email ilike '%' || $6 || '%'
              or p.first_name ilike '%' || $6 || '%' or p.middle_name ilike '%' || $6 || '%'
              or p.last_name ilike '%' || $6 || '%')
          order by p.last_name, p.first_name
          limit $4 offset $5`,
        [req.user.clinicId, role, status, pageSize, offset, query],
      );
      return res.json({ data: staff, pagination: { page, pageSize, total: count.total, totalPages } });
    } catch (error) {
      return next(error);
    }
  });

  router.get("/:id", async (req, res, next) => {
    try {
      if (!isUuid(req.params.id)) return res.status(400).json({ error: "INVALID_STAFF_ID" });
      const [staff] = await client.unsafe(
        `select u.id, u.username, u.email, u.role, u.is_active, u.last_sign_in_at,
                (u.password_hash is null) as pending_activation,
                p.first_name, p.middle_name, p.last_name, p.date_of_birth, p.phone,
                p.country, p.city, p.house_number, p.street
           from public.users u
           join public.staff_profiles p on p.user_id = u.id and p.clinic_id = u.clinic_id
          where u.id = $1 and u.clinic_id = $2 and u.role <> 'patient' and u.deleted_at is null`,
        [req.params.id, req.user.clinicId],
      );
      if (!staff) return res.status(404).json({ error: "STAFF_NOT_FOUND", message: "Staff account was not found." });
      return res.json({ data: staff });
    } catch (error) {
      return next(error);
    }
  });

  router.get("/:id/assignments", async (req, res, next) => {
    try {
      if (!isUuid(req.params.id)) return res.status(400).json({ error: "INVALID_STAFF_ID" });
      const [person] = await client.unsafe(
        `select id, role from public.users
          where id = $1 and clinic_id = $2 and role in ('medical_technologist', 'pathologist') and deleted_at is null`,
        [req.params.id, req.user.clinicId],
      );
      if (!person) return res.status(404).json({ error: "STAFF_NOT_FOUND" });
      const assignmentColumn = person.role === "medical_technologist" ? "assigned_technologist_id" : "assigned_pathologist_id";
      const assignments = await client.unsafe(
        `select r.id, r.request_number, r.status, r.requested_at,
                p.pid, concat_ws(' ', p.first_name, p.middle_name, p.last_name) as patient_name
           from public.test_requests r
           join public.patients p on p.id = r.patient_id and p.clinic_id = r.clinic_id
          where r.clinic_id = $1 and r.${assignmentColumn} = $2
            and r.status = any($3::public.request_status[])
          order by r.requested_at`,
        [req.user.clinicId, person.id, ACTIVE_REQUEST_STATUSES],
      );
      const reassignees = await client.unsafe(
        `select u.id, concat_ws(' ', p.first_name, p.middle_name, p.last_name) as name
           from public.users u
           join public.staff_profiles p on p.user_id = u.id and p.clinic_id = u.clinic_id
          where u.clinic_id = $1 and u.role = $2::public.user_role and u.is_active = true and u.id <> $3
          order by p.last_name, p.first_name`,
        [req.user.clinicId, person.role, person.id],
      );
      return res.json({ data: { role: person.role, assignments, reassignees } });
    } catch (error) {
      return next(error);
    }
  });

  router.patch("/:id", async (req, res, next) => {
    try {
      if (!isUuid(req.params.id)) return res.status(400).json({ error: "INVALID_STAFF_ID" });
      const body = req.body ?? {};
      const updated = await client.begin(async (tx) => {
        const [target] = await tx.unsafe(
          `select id, username, role, is_active, password_hash from public.users
            where id = $1 and clinic_id = $2 and role <> 'patient' and deleted_at is null
            for update`,
          [req.params.id, req.user.clinicId],
        );
        if (!target) throw Object.assign(new Error("Staff account was not found."), { code: "STAFF_NOT_FOUND" });
        const validationErrors = validateStaffDetails(body, { allowAdministrator: target.role === "administrator" });
        const roleChanged = body.role !== target.role;
        if (roleChanged && !STAFF_ROLES.has(target.role)) validationErrors.role = "Administrator account roles cannot be changed here.";
        if (Object.keys(validationErrors).length) {
          throw Object.assign(new Error("Correct the staff details and try again."), {
            code: "INVALID_STAFF_DETAILS",
            fields: validationErrors,
          });
        }
        if (roleChanged) {
          const rolePolicyError = validateStaffRoleChange({
            currentRole: target.role,
            nextRole: body.role,
            isActive: target.is_active,
            isPendingActivation: !target.password_hash,
            hasActiveWork: false,
          });
          if (rolePolicyError) throw Object.assign(new Error(rolePolicyError.message), { code: rolePolicyError.code });
          const [assignedWork] = await tx.unsafe(
            `select exists(
               select 1 from public.test_requests
                where clinic_id = $1 and status = any($2::public.request_status[])
                  and (($3 = 'medical_technologist' and assigned_technologist_id = $4)
                    or ($3 = 'pathologist' and assigned_pathologist_id = $4))
             ) as has_active_work`,
            [req.user.clinicId, ACTIVE_REQUEST_STATUSES, target.role, target.id],
          );
          const assignmentPolicyError = validateStaffRoleChange({
             currentRole: target.role,
             nextRole: body.role,
             isActive: target.is_active,
             isPendingActivation: !target.password_hash,
             hasActiveWork: assignedWork.has_active_work,
          });
          if (assignmentPolicyError) throw Object.assign(new Error(assignmentPolicyError.message), { code: assignmentPolicyError.code });
        }

        const firstName = body.firstName.trim();
        const middleName = body.middleName?.trim() || null;
        const lastName = body.lastName.trim();
        const email = body.email.trim().toLowerCase();
        const phone = body.phone.trim();
        const [updatedUser] = await tx.unsafe(
          `update public.users set email = $1, role = $2::public.user_role, updated_at = now()
            where id = $3 and clinic_id = $4
            returning id, username, role`,
          [email, body.role, target.id, req.user.clinicId],
        );
        const [profile] = await tx.unsafe(
          `update public.staff_profiles
              set first_name = $1, middle_name = $2, last_name = $3, date_of_birth = $4::date,
                  phone = $5, email = $6, country = $7, city = $8, house_number = $9, street = $10,
                  updated_at = now()
            where user_id = $11 and clinic_id = $12
            returning user_id`,
          [firstName, middleName, lastName, body.dateOfBirth, phone, email, body.country.trim(),
            body.city.trim(), body.houseNumber.trim(), body.street.trim(), target.id, req.user.clinicId],
        );
        if (!profile) throw Object.assign(new Error("Staff profile was not found."), { code: "STAFF_NOT_FOUND" });
        await tx.unsafe(
          `insert into public.audit_logs (clinic_id, actor_user_id, action, entity_type, entity_id, details)
           values ($1, $2, $3, 'user', $4, jsonb_build_object('fields', $5::jsonb, 'previousRole', $6::text, 'role', $7::text, 'previousUsername', $8::text, 'username', $9::text))`,
          [req.user.clinicId, req.user.sub, roleChanged ? "staff.role_changed" : "staff.updated", target.id, JSON.stringify([
            "firstName", "middleName", "lastName", "dateOfBirth", "phone", "email",
            "country", "city", "houseNumber", "street", ...(roleChanged ? ["role"] : []),
          ]), target.role, updatedUser.role, target.username, updatedUser.username],
        );
        return { id: target.id, role: updatedUser.role, username: updatedUser.username, roleChanged };
      });
      return res.json({ data: updated });
    } catch (error) {
      if (error.code === "INVALID_STAFF_DETAILS") {
        return res.status(400).json({ error: error.code, message: error.message, fields: error.fields });
      }
      if (error.code === "STAFF_NOT_FOUND") return res.status(404).json({ error: error.code, message: error.message });
      if (["STAFF_ROLE_CHANGE_REQUIRES_INACTIVE", "STAFF_ACTIVATION_PENDING", "STAFF_ROLE_CHANGE_HAS_ACTIVE_WORK"].includes(error.code)) {
        return res.status(409).json({ error: error.code, message: error.message });
      }
      if (isUniqueViolation(error)) return res.status(409).json({ error: "STAFF_EMAIL_EXISTS", message: "That email address is already assigned to an account in this laboratory. Use a different email address." });
      return next(error);
    }
  });

  router.post("/", async (req, res, next) => {
    try {
      const body = req.body ?? {};
      const validationErrors = validateStaffDetails(body);
      if (Object.keys(validationErrors).length) {
        return res.status(400).json({
          error: "INVALID_STAFF_DETAILS",
          message: "Correct the staff details and try again.",
          fields: validationErrors,
        });
      }
      const role = String(body.role ?? "");
      const firstName = String(body.firstName ?? "").trim();
      const middleName = String(body.middleName ?? "").trim() || null;
      const lastName = String(body.lastName ?? "").trim();
      const email = String(body.email ?? "").trim().toLowerCase();
      const phone = String(body.phone ?? "").trim();
      const dateOfBirth = String(body.dateOfBirth ?? "").trim();
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
           values ($1, $2, $3, 'activation', now() + interval '24 hours')`,
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
        activation: { code: activation.code, revealOnce: true, expiresInHours: 24 },
        emailDelivery,
      });
    } catch (error) {
      if (isUniqueViolation(error)) return res.status(409).json({ error: "STAFF_EMAIL_EXISTS", message: "That email address is already assigned to an account in this laboratory. Use a different email address." });
      return next(error);
    }
  });

  router.post("/:id/activation", async (req, res, next) => {
    try {
      if (!isUuid(req.params.id)) return res.status(400).json({ error: "INVALID_STAFF_ID" });
      const activation = createOneTimeCode();
      const staff = await client.begin(async (tx) => {
        const [target] = await tx.unsafe(
          `select u.id, u.username, u.role, u.email, sp.first_name, sp.last_name
             from public.users u join public.staff_profiles sp on sp.user_id = u.id and sp.clinic_id = u.clinic_id
            where u.id = $1 and u.clinic_id = $2 and u.role <> 'patient' and u.deleted_at is null
              and u.is_active = false and u.password_hash is null for update of u`,
          [req.params.id, req.user.clinicId]);
        if (!target) throw Object.assign(new Error("Only a staff account that has not yet been activated can receive a replacement activation code."), { code: "STAFF_NOT_PENDING_ACTIVATION" });
        await tx.unsafe(`update public.account_tokens set consumed_at = now() where user_id = $1 and clinic_id = $2 and purpose = 'activation' and consumed_at is null`, [target.id, req.user.clinicId]);
        await tx.unsafe(
          `insert into public.account_tokens (clinic_id, user_id, token_hash, purpose, expires_at)
           values ($1, $2, $3, 'activation', now() + interval '24 hours')`,
          [req.user.clinicId, target.id, activation.hash]);
        await tx.unsafe(
          `insert into public.audit_logs (clinic_id, actor_user_id, action, entity_type, entity_id, details)
           values ($1, $2, 'staff.activation_reissued', 'user', $3, jsonb_build_object('username', $4::text))`,
          [req.user.clinicId, req.user.sub, target.id, target.username]);
        return target;
      });
      const emailDelivery = await emailService.sendActivationEmail({ to: staff.email, name: `${staff.first_name} ${staff.last_name}`, accountId: staff.username, code: activation.code, role: staff.role.replaceAll("_", " ") });
      return res.json({ data: { id: staff.id }, activation: { code: activation.code, revealOnce: true, expiresInHours: 24 }, emailDelivery });
    } catch (error) {
      if (error.code === "STAFF_NOT_PENDING_ACTIVATION") return res.status(409).json({ error: error.code, message: error.message });
      return next(error);
    }
  });

  router.post("/:id/password-reset", async (req, res, next) => {
    try {
      if (!isUuid(req.params.id)) return res.status(400).json({ error: "INVALID_STAFF_ID" });
      const reset = createOneTimeCode();
      const staff = await client.begin(async (tx) => {
        const [target] = await tx.unsafe(
          `select u.id, u.username, u.role, u.email, u.is_active, u.password_hash,
                  sp.first_name, sp.last_name
             from public.users u
             left join public.staff_profiles sp on sp.user_id = u.id and sp.clinic_id = u.clinic_id
            where u.id = $1 and u.clinic_id = $2 and u.role <> 'patient' and u.deleted_at is null
            for update of u`,
          [req.params.id, req.user.clinicId],
        );
        if (!target) throw Object.assign(new Error("Staff account was not found."), { code: "STAFF_NOT_FOUND" });
        if (!target.is_active || !target.password_hash) {
          throw Object.assign(
            new Error("Only an activated staff account can receive a password reset code. Reissue an activation code for an account that has never been activated."),
            { code: "STAFF_NOT_ACTIVE" },
          );
        }
        await tx.unsafe(
          `update public.account_tokens set consumed_at = now()
            where user_id = $1 and clinic_id = $2 and purpose = 'password_reset' and consumed_at is null`,
          [target.id, req.user.clinicId],
        );
        await tx.unsafe(
          `insert into public.account_tokens (clinic_id, user_id, token_hash, purpose, expires_at)
           values ($1, $2, $3, 'password_reset', now() + interval '24 hours')`,
          [req.user.clinicId, target.id, reset.hash],
        );
        await tx.unsafe(
          `insert into public.audit_logs (clinic_id, actor_user_id, action, entity_type, entity_id, details)
           values ($1, $2, 'staff.password_reset_issued', 'user', $3,
             jsonb_build_object('username', $4::text, 'expiresInHours', 24))`,
          [req.user.clinicId, req.user.sub, target.id, target.username],
        );
        return target;
      });
      const name = [staff.first_name, staff.last_name].filter(Boolean).join(" ") || staff.username;
      const emailDelivery = await emailService.sendStaffPasswordResetEmail({
        to: staff.email,
        name,
        username: staff.username,
        code: reset.code,
      });
      return res.status(201).json({
        data: { id: staff.id, username: staff.username },
        reset: { code: reset.code, revealOnce: true, expiresInHours: 24 },
        emailDelivery,
      });
    } catch (error) {
      if (error.code === "STAFF_NOT_FOUND") return res.status(404).json({ error: error.code, message: error.message });
      if (error.code === "STAFF_NOT_ACTIVE") return res.status(409).json({ error: error.code, message: error.message });
      return next(error);
    }
  });

  router.patch("/:id/status", async (req, res, next) => {
    try {
      if (!isUuid(req.params.id)) return res.status(400).json({ error: "INVALID_STAFF_ID" });
      const userId = req.params.id;
      const isActive = req.body?.isActive;
      if (typeof isActive !== "boolean") return res.status(400).json({ error: "INVALID_STATUS" });
      if (userId === req.user.sub) return res.status(409).json({ error: "CANNOT_CHANGE_OWN_STATUS" });
      const reassignedRequestIds = [];
      const result = await client.begin(async (tx) => {
        const [target] = await tx.unsafe(
          `select id, role, is_active, password_hash
             from public.users where id = $1 and clinic_id = $2 and role <> 'patient' and deleted_at is null for update`,
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

  router.delete("/:id", async (req, res, next) => {
    try {
      if (!isUuid(req.params.id)) return res.status(400).json({ error: "INVALID_STAFF_ID" });
      if (req.params.id === req.user.sub) {
        return res.status(409).json({ error: "CANNOT_DELETE_OWN_ACCOUNT", message: "You cannot delete your own account." });
      }
      const deleted = await client.begin(async (tx) => {
        const [target] = await tx.unsafe(
          `select id, username, role, is_active, deleted_at
             from public.users
            where id = $1 and clinic_id = $2 and role <> 'patient'
            for update`,
          [req.params.id, req.user.clinicId],
        );
        if (!target || target.deleted_at) throw Object.assign(new Error("Staff account was not found."), { code: "STAFF_NOT_FOUND" });
        if (target.is_active) throw Object.assign(new Error("Deactivate this account before deleting it."), { code: "STAFF_ACCOUNT_ACTIVE" });
        if (target.role === "administrator") {
          const [others] = await tx.unsafe(
            `select count(*)::integer as total
               from public.users
              where clinic_id = $1 and role = 'administrator' and deleted_at is null and id <> $2`,
            [req.user.clinicId, target.id],
          );
          if (!others.total) throw Object.assign(new Error("The last administrator account cannot be deleted."), { code: "LAST_ADMINISTRATOR" });
        }
        await tx.unsafe(
          `update public.users
              set deleted_at = now(), deleted_by = $1, is_active = false,
                  email = 'deleted+' || id::text || '@deleted.invalid',
                  password_hash = null, updated_at = now()
            where id = $2 and clinic_id = $3`,
          [req.user.sub, target.id, req.user.clinicId],
        );
        await tx.unsafe(`delete from public.staff_profiles where user_id = $1 and clinic_id = $2`, [target.id, req.user.clinicId]);
        await tx.unsafe(
          `update public.account_tokens set consumed_at = now()
            where user_id = $1 and clinic_id = $2 and consumed_at is null`,
          [target.id, req.user.clinicId],
        );
        await tx.unsafe(
          `insert into public.audit_logs (clinic_id, actor_user_id, action, entity_type, entity_id, details)
           values ($1, $2, 'staff.deleted', 'user', $3, jsonb_build_object('username', $4::text, 'role', $5::text))`,
          [req.user.clinicId, req.user.sub, target.id, target.username, target.role],
        );
        return { id: target.id };
      });
      return res.json({ data: deleted });
    } catch (error) {
      if (error.code === "STAFF_NOT_FOUND") return res.status(404).json({ error: error.code, message: error.message });
      if (["STAFF_ACCOUNT_ACTIVE", "CANNOT_DELETE_OWN_ACCOUNT", "LAST_ADMINISTRATOR"].includes(error.code)) {
        return res.status(409).json({ error: error.code, message: error.message });
      }
      return next(error);
    }
  });

  return router;
}
