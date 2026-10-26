import { randomBytes } from "node:crypto";
import { Router } from "express";
import { isSupportedCountry, parsePhoneNumberFromString } from "libphonenumber-js/min";
import { allowRoles, createRequireAuth, requirePasswordSetupComplete, requireSameOrigin } from "../auth/middleware.js";
import { createOneTimeCode } from "../auth/oneTimeCode.js";
import { emailService } from "../email.js";

const ACTIVE_REQUEST_STATUSES = ["awaiting_payment", "paid", "specimen_collection", "processing", "for_validation", "correction"];
const code = (prefix) => `${prefix}-${new Date().getFullYear()}-${randomBytes(6).toString("hex").toUpperCase()}`;
const patientNamePattern = /^[\p{L}\p{M}]+(?: [\p{L}\p{M}]+)*$/u;
const patientIdNumberPattern = /^[\p{L}\p{N}][\p{L}\p{N} /-]*$/u;

export function validatePatientDetails(body) {
  const errors = {};
  const requiredStrings = ["firstName", "lastName", "dateOfBirth", "sex", "phone", "country", "city", "countryCode", "validIdType", "validIdNumber"];
  for (const field of requiredStrings) {
    if (typeof body[field] !== "string" || !body[field].trim()) errors[field] = "This field is required.";
  }

  for (const field of ["firstName", "middleName", "lastName"]) {
    const value = body[field] ?? "";
    if (typeof value !== "string") {
      errors[field] = "Use letters only.";
      continue;
    }
    if (!value && field === "middleName") continue;
    if (!value) continue;
    if (field !== "middleName" && typeof value === "string" && value.trim() && value.trim().length < 2) {
      errors[field] = "Enter at least two characters.";
      continue;
    }
    if (value !== value.trim()) errors[field] = "Names cannot start or end with spaces.";
    else if (value.length < 2 || value.length > 50) errors[field] = "Names must be between 2 and 50 characters.";
    else if (!patientNamePattern.test(value)) {
      errors[field] = "Names can contain letters and single spaces only.";
    }
  }

  const dateValue = body.dateOfBirth;
  if (typeof dateValue === "string" && /^\d{4}-\d{2}-\d{2}$/.test(dateValue)) {
    const date = new Date(`${dateValue}T00:00:00.000Z`);
    const today = new Date().toISOString().slice(0, 10);
    const earliest = new Date(`${today}T00:00:00.000Z`);
    earliest.setUTCFullYear(earliest.getUTCFullYear() - 120);
    if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== dateValue) errors.dateOfBirth = "Enter a valid date.";
    else if (dateValue > today) errors.dateOfBirth = "Date of birth cannot be in the future.";
    else if (dateValue < earliest.toISOString().slice(0, 10)) errors.dateOfBirth = "Date of birth must be within the last 120 years.";
  } else if (dateValue) {
    errors.dateOfBirth = "Use a valid YYYY-MM-DD date.";
  }

  if (typeof body.sex === "string" && !["Female", "Male"].includes(body.sex)) errors.sex = "Select a valid sex.";
  if (typeof body.country === "string" && body.country.trim().length > 100) errors.country = "Country cannot exceed 100 characters.";
  if (typeof body.city === "string" && (body.city.trim().length < 2 || body.city.trim().length > 100)) errors.city = "City must be between 2 and 100 characters.";

  for (const [field, min, max] of [["houseNumber", 1, 30], ["street", 2, 100]]) {
    const value = body[field];
    if (value != null && value !== "") {
      if (typeof value !== "string") errors[field] = "Use text for this field.";
      else if (value.trim().length < min || value.trim().length > max) errors[field] = `Must be between ${min} and ${max} characters.`;
    }
  }

  if (body.email != null && body.email !== "") {
    if (typeof body.email !== "string" || body.email.length > 254 || body.email.trim().length < 6 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email.trim())) {
      errors.email = "Enter a valid email address (up to 254 characters).";
    }
  }
  if (typeof body.countryCode !== "string" || !isSupportedCountry(body.countryCode)) {
    errors.countryCode = "Select a valid country.";
  } else if (typeof body.phone === "string" && body.phone.trim()) {
    const phone = parsePhoneNumberFromString(body.phone.trim(), body.countryCode);
    if (!phone?.isValid() || phone.country !== body.countryCode) errors.phone = "Enter a valid phone number for the selected country.";
  }

  if (typeof body.validIdType === "string" && (body.validIdType.trim().length < 2 || body.validIdType.trim().length > 80)) errors.validIdType = "ID type must be between 2 and 80 characters.";
  if (typeof body.validIdNumber === "string") {
    const number = body.validIdNumber.trim();
    if (number.length < 3 || number.length > 50) errors.validIdNumber = "ID number must be between 3 and 50 characters.";
    else if (!patientIdNumberPattern.test(number)) errors.validIdNumber = "ID number contains unsupported characters.";
  }
  return errors;
}

export function createCashierRouter({ client }) {
  const router = Router();
  router.use(createRequireAuth(client), requirePasswordSetupComplete, requireSameOrigin);

  router.get("/dashboard", allowRoles("cashier"), async (req, res, next) => {
    try {
      const [summary] = await client.unsafe(
        `select count(*) filter (where r.requested_at::date = current_date)::integer as requests_today,
                count(*) filter (where r.status = 'awaiting_payment')::integer as unpaid_requests,
                count(*) filter (where r.status in ('paid','specimen_collection','processing','for_validation','correction'))::integer as awaiting_next_step,
                coalesce((select sum(p.amount) from public.payments p join public.test_requests paid on paid.id = p.request_id and paid.clinic_id = p.clinic_id
                  where p.clinic_id = $1 and p.paid_at::date = current_date and p.voided_at is null), 0) as payments_today
           from public.test_requests r where r.clinic_id = $1`
        , [req.user.clinicId],
      );
      const recent = await client.unsafe(
        `select r.id, r.request_number, r.status, r.total_amount, r.requested_at,
                p.pid, concat_ws(' ', p.first_name, p.middle_name, p.last_name) as patient_name,
                coalesce(jsonb_agg(distinct ri.test_name_snapshot) filter (where ri.id is not null), '[]'::jsonb) as tests,
                exists(select 1 from public.payments pay where pay.request_id = r.id and pay.clinic_id = r.clinic_id and pay.voided_at is null) as is_paid
           from public.test_requests r join public.patients p on p.id = r.patient_id and p.clinic_id = r.clinic_id
           left join public.request_items ri on ri.request_id = r.id and ri.clinic_id = r.clinic_id
          where r.clinic_id = $1
          group by r.id, p.id order by r.requested_at desc limit 100`,
        [req.user.clinicId],
      );
      return res.json({ data: { summary, recent } });
    } catch (error) { return next(error); }
  });

  router.post("/patients", allowRoles("cashier"), async (req, res, next) => {
    try {
      const body = req.body ?? {};
      const validationErrors = validatePatientDetails(body);
      if (Object.keys(validationErrors).length) {
        return res.status(400).json({
          error: "INVALID_PATIENT_DETAILS",
          message: "Correct the patient details and try again.",
          fields: validationErrors,
        });
      }
      const phone = parsePhoneNumberFromString(body.phone.trim(), body.countryCode).number;
      const pid = `PID-${new Date().getFullYear()}-${randomBytes(4).toString("hex").toUpperCase()}`;
      const patient = await client.begin(async (tx) => {
        const [created] = await tx.unsafe(
          `insert into public.patients
            (clinic_id, pid, first_name, middle_name, last_name, date_of_birth, sex,
             email, phone, country, city, house_number, street, valid_id_type, valid_id_number, registered_by)
           values ($1, $2, $3, $4, $5, $6::date, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
           returning id, pid, created_at`,
          [req.user.clinicId, pid, String(body.firstName).trim(), body.middleName?.trim() || null,
            String(body.lastName).trim(), body.dateOfBirth, String(body.sex).trim(), body.email?.trim()?.toLowerCase() || null,
            phone, String(body.country).trim(), String(body.city).trim(), body.houseNumber?.trim() || null,
            body.street?.trim() || null, String(body.validIdType).trim(), String(body.validIdNumber).trim(), req.user.sub],
        );
        await tx.unsafe(
          `insert into public.audit_logs (clinic_id, actor_user_id, action, entity_type, entity_id, details)
           values ($1, $2, 'patient.registered', 'patient', $3, jsonb_build_object('pid', $4::text))`,
          [req.user.clinicId, req.user.sub, created.id, created.pid],
        );
        return created;
      });
      return res.status(201).json({ data: patient, portalAccess: "not_created" });
    } catch (error) {
      return next(error);
    }
  });

  router.post("/patients/:id/portal-activation", allowRoles("cashier"), async (req, res, next) => {
    try {
      const activation = createOneTimeCode();
      const data = await client.begin(async (tx) => {
        const [patient] = await tx.unsafe(
          `select id, pid, email, portal_user_id, first_name, middle_name, last_name
             from public.patients where id = $1 and clinic_id = $2 for update`,
          [req.params.id, req.user.clinicId],
        );
        if (!patient) throw Object.assign(new Error("Patient was not found in this laboratory."), { code: "PATIENT_NOT_FOUND" });
        let userId = patient.portal_user_id;
        if (userId) {
          const [existing] = await tx.unsafe(`select id, is_active from public.users where id = $1 and clinic_id = $2 for update`, [userId, req.user.clinicId]);
          if (existing?.is_active) throw Object.assign(new Error("This patient already has an active portal account."), { code: "PORTAL_ALREADY_ACTIVE" });
          await tx.unsafe(`update public.account_tokens set consumed_at = now() where user_id = $1 and purpose = 'activation' and consumed_at is null`, [userId]);
        } else {
          let [createdUser] = await tx.unsafe(
            `insert into public.users (clinic_id, role, email, is_active, must_change_password)
             values ($1, 'patient', $2, false, true)
             on conflict (clinic_id, email) do nothing returning id`,
            [req.user.clinicId, patient.email || null],
          );
          if (!createdUser) {
            [createdUser] = await tx.unsafe(
              `insert into public.users (clinic_id, role, email, is_active, must_change_password)
               values ($1, 'patient', null, false, true) returning id`,
              [req.user.clinicId],
            );
          }
          userId = createdUser.id;
          await tx.unsafe(`update public.patients set portal_user_id = $1, updated_at = now() where id = $2 and clinic_id = $3`, [userId, patient.id, req.user.clinicId]);
        }
        await tx.unsafe(
          `insert into public.account_tokens (clinic_id, user_id, token_hash, purpose, expires_at)
           values ($1, $2, $3, 'activation', null)`,
          [req.user.clinicId, userId, activation.hash],
        );
        await tx.unsafe(
          `insert into public.audit_logs (clinic_id, actor_user_id, action, entity_type, entity_id, details)
           values ($1, $2, 'patient.portal_activation_issued', 'patient', $3, jsonb_build_object('pid', $4::text))`,
          [req.user.clinicId, req.user.sub, patient.id, patient.pid],
        );
        return {
          patientId: patient.id,
          pid: patient.pid,
          email: patient.email,
          name: [patient.first_name, patient.middle_name, patient.last_name].filter(Boolean).join(" "),
        };
      });
      const emailDelivery = await emailService.sendActivationEmail({
        to: data.email,
        name: data.name,
        accountId: data.pid,
        code: activation.code,
        role: "patient",
      });
      return res.status(201).json({
        data: { patientId: data.patientId, pid: data.pid },
        activation: { code: activation.code, revealOnce: true, expires: null },
        emailDelivery,
      });
    } catch (error) {
      if (["PATIENT_NOT_FOUND", "PORTAL_ALREADY_ACTIVE"].includes(error.code)) return res.status(error.code === "PATIENT_NOT_FOUND" ? 404 : 409).json({ error: error.code, message: error.message });
      return next(error);
    }
  });

  router.post("/requests", allowRoles("cashier"), async (req, res, next) => {
    try {
      const patientId = String(req.body?.patientId ?? "");
      const testIds = [...new Set(Array.isArray(req.body?.testIds) ? req.body.testIds : [])];
      const priority = req.body?.priority === "urgent" ? "urgent" : "routine";
      if (!patientId || testIds.length === 0 || testIds.length > 50) {
        return res.status(400).json({ error: "INVALID_REQUEST", message: "Choose a patient and between 1 and 50 tests." });
      }
      const request = await client.begin(async (tx) => {
        const [patient] = await tx.unsafe(
          `select id from public.patients where id = $1 and clinic_id = $2 for update`,
          [patientId, req.user.clinicId],
        );
        if (!patient) throw Object.assign(new Error("Patient was not found in this laboratory."), { code: "PATIENT_NOT_FOUND" });
        const [existing] = await tx.unsafe(
          `select id from public.test_requests where clinic_id = $1 and patient_id = $2 and status = 'awaiting_payment' limit 1`,
          [req.user.clinicId, patientId],
        );
        if (existing) throw Object.assign(new Error("This patient already has a request awaiting payment."), { code: "REQUEST_AWAITING_PAYMENT" });
        const tests = await tx.unsafe(
          `select t.id, t.code, t.name, t.price, c.name as category_name,
                  exists(select 1 from public.test_specimen_requirements sr
                          where sr.test_id = t.id and sr.clinic_id = t.clinic_id and sr.is_required = true) as has_specimen
             from public.test_catalog t
             join public.test_categories c on c.id = t.category_id and c.clinic_id = t.clinic_id
            where t.clinic_id = $1 and t.id = any($2::uuid[])
              and t.is_available = true and exists (select 1 from public.test_category_memberships m
                join public.test_categories active_category on active_category.id = m.category_id and active_category.clinic_id = m.clinic_id
                where m.test_id = t.id and m.clinic_id = t.clinic_id and active_category.is_active = true)`,
          [req.user.clinicId, testIds],
        );
        if (tests.length !== testIds.length) throw Object.assign(new Error("One or more selected tests are unavailable."), { code: "TEST_UNAVAILABLE" });
        const missingSpecimen = tests.filter((test) => !test.has_specimen);
        if (missingSpecimen.length) throw Object.assign(new Error("Every available test needs at least one required specimen configured."), { code: "SPECIMEN_SETUP_MISSING", details: missingSpecimen.map(({ id, name }) => ({ id, name })) });
        const [created] = await tx.unsafe(
          `insert into public.test_requests
            (clinic_id, request_number, patient_id, created_by, status, priority, total_amount)
           select $1, $2, $3, $4, 'awaiting_payment', $5, coalesce(sum(t.price), 0)
             from public.test_catalog t where t.clinic_id = $1 and t.id = any($6::uuid[])
           returning id, request_number, total_amount, status, requested_at`,
          [req.user.clinicId, code("REQ"), patientId, req.user.sub, priority, testIds],
        );
        for (const test of tests) {
          await tx.unsafe(
            `insert into public.request_items
              (clinic_id, request_id, test_id, test_code_snapshot, test_name_snapshot, category_name_snapshot, price_snapshot)
             values ($1, $2, $3, $4, $5, $6, $7)`,
            [req.user.clinicId, created.id, test.id, test.code, test.name, test.category_name, test.price],
          );
        }
        await tx.unsafe(
          `insert into public.request_status_history (clinic_id, request_id, old_status, new_status, changed_by)
           values ($1, $2, null, 'awaiting_payment', $3)`,
          [req.user.clinicId, created.id, req.user.sub],
        );
        await tx.unsafe(
          `insert into public.audit_logs (clinic_id, actor_user_id, action, entity_type, entity_id, details)
           values ($1, $2, 'request.created', 'test_request', $3, jsonb_build_object('itemCount', $4::integer, 'priority', $5::text))`,
          [req.user.clinicId, req.user.sub, created.id, tests.length, priority],
        );
        return { ...created, items: tests.map(({ id, name, category_name, price }) => ({ testId: id, name, category: category_name, price })) };
      });
      return res.status(201).json({ data: request });
    } catch (error) {
      const known = ["PATIENT_NOT_FOUND", "REQUEST_AWAITING_PAYMENT", "TEST_UNAVAILABLE", "SPECIMEN_SETUP_MISSING"];
      if (known.includes(error.code)) return res.status(error.code === "PATIENT_NOT_FOUND" ? 404 : 409).json({ error: error.code, message: error.message, details: error.details });
      return next(error);
    }
  });

  router.get("/queue", allowRoles("cashier"), async (req, res, next) => {
    try {
      const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
      const pageSize = Math.min(100, Math.max(1, Number.parseInt(req.query.pageSize, 10) || 10));
      const offset = (page - 1) * pageSize;
      const [count] = await client.unsafe(
        `select count(*)::integer as total from public.test_requests r
          where r.clinic_id = $1 and r.status = 'awaiting_payment'`,
        [req.user.clinicId],
      );
      const data = await client.unsafe(
        `select r.id, r.request_number, r.queue_ticket::text as queue_ticket, r.queue_called_at, r.priority, r.total_amount, r.requested_at,
                p.pid, concat_ws(' ', p.first_name, p.middle_name, p.last_name) as patient_name,
                count(ri.id)::integer as test_count,
                jsonb_agg(jsonb_build_object(
                  'id', ri.id, 'testId', ri.test_id, 'name', ri.test_name_snapshot,
                  'category', ri.category_name_snapshot, 'price', ri.price_snapshot
                ) order by ri.created_at) as tests
           from public.test_requests r
           join public.patients p on p.id = r.patient_id and p.clinic_id = r.clinic_id
           join public.request_items ri on ri.request_id = r.id and ri.clinic_id = r.clinic_id
          where r.clinic_id = $1 and r.status = 'awaiting_payment'
          group by r.id, p.id order by r.requested_at
          limit $2 offset $3`,
        [req.user.clinicId, pageSize, offset],
      );
      return res.json({ data, pagination: { page, pageSize, total: count.total, totalPages: Math.ceil(count.total / pageSize) } });
    } catch (error) {
      return next(error);
    }
  });

  router.post("/queue/:id/call", allowRoles("cashier"), async (req, res, next) => {
    try {
      const called = await client.begin(async (tx) => {
        await tx.unsafe(`select pg_advisory_xact_lock(hashtextextended($1, 0))`, [req.user.clinicId]);
        const [target] = await tx.unsafe(
          `select id, request_number, queue_ticket::text as queue_ticket from public.test_requests
            where id = $1 and clinic_id = $2 and status = 'awaiting_payment' for update`,
          [req.params.id, req.user.clinicId],
        );
        if (!target) throw Object.assign(new Error("Request was not found in the payment queue."), { code: "QUEUE_REQUEST_NOT_FOUND" });
        await tx.unsafe(`update public.test_requests set queue_called_at = null, queue_called_by = null where clinic_id = $1 and status = 'awaiting_payment' and queue_called_at is not null`, [req.user.clinicId]);
        await tx.unsafe(`update public.test_requests set queue_called_at = now(), queue_called_by = $1 where id = $2 and clinic_id = $3`, [req.user.sub, target.id, req.user.clinicId]);
        await tx.unsafe(`insert into public.audit_logs (clinic_id, actor_user_id, action, entity_type, entity_id) values ($1,$2,'cashier.queue_called','test_request',$3)`, [req.user.clinicId, req.user.sub, target.id]);
        return target;
      });
      return res.json({ data: called });
    } catch (error) {
      if (error.code === "QUEUE_REQUEST_NOT_FOUND") return res.status(404).json({ error: error.code, message: error.message });
      return next(error);
    }
  });

  router.post("/queue/call-next", allowRoles("cashier"), async (req, res, next) => {
    try {
      const called = await client.begin(async (tx) => {
        await tx.unsafe(`select pg_advisory_xact_lock(hashtextextended($1, 0))`, [req.user.clinicId]);
        const [target] = await tx.unsafe(`select id, request_number, queue_ticket::text as queue_ticket from public.test_requests where clinic_id = $1 and status = 'awaiting_payment' and queue_called_at is null order by requested_at, queue_ticket limit 1 for update skip locked`, [req.user.clinicId]);
        if (!target) return null;
        await tx.unsafe(`update public.test_requests set queue_called_at = null, queue_called_by = null where clinic_id = $1 and status = 'awaiting_payment' and queue_called_at is not null`, [req.user.clinicId]);
        await tx.unsafe(`update public.test_requests set queue_called_at = now(), queue_called_by = $1 where id = $2 and clinic_id = $3`, [req.user.sub, target.id, req.user.clinicId]);
        await tx.unsafe(`insert into public.audit_logs (clinic_id, actor_user_id, action, entity_type, entity_id) values ($1,$2,'cashier.queue_called','test_request',$3)`, [req.user.clinicId, req.user.sub, target.id]);
        return target;
      });
      return called ? res.json({ data: called }) : res.status(404).json({ error: "QUEUE_EMPTY", message: "No waiting requests are available to call." });
    } catch (error) { return next(error); }
  });

  router.delete("/queue/call", allowRoles("cashier"), async (req, res, next) => {
    try {
      await client.begin(async (tx) => {
        await tx.unsafe(`select pg_advisory_xact_lock(hashtextextended($1, 0))`, [req.user.clinicId]);
        await tx.unsafe(`update public.test_requests set queue_called_at = null, queue_called_by = null where clinic_id = $1 and status = 'awaiting_payment' and queue_called_at is not null`, [req.user.clinicId]);
      });
      return res.json({ data: { dismissed: true } });
    } catch (error) { return next(error); }
  });

  router.post("/requests/:id/payment", allowRoles("cashier"), async (req, res, next) => {
    try {
      const result = await client.begin(async (tx) => {
        const [request] = await tx.unsafe(
          `select r.id, r.request_number, r.total_amount, r.status,
                  pt.email as patient_email,
                  concat_ws(' ', pt.first_name, pt.middle_name, pt.last_name) as patient_name,
                  c.name as clinic_name
             from public.test_requests r
             join public.patients pt on pt.id = r.patient_id and pt.clinic_id = r.clinic_id
             join public.clinics c on c.id = r.clinic_id
            where r.id = $1 and r.clinic_id = $2 for update of r`,
          [req.params.id, req.user.clinicId],
        );
        if (!request) throw Object.assign(new Error("Request was not found."), { code: "REQUEST_NOT_FOUND" });
        if (request.status !== "awaiting_payment") throw Object.assign(new Error("Only requests awaiting payment can be processed."), { code: "INVALID_REQUEST_STATUS" });
        const [technologist] = await tx.unsafe(
          `select u.id
             from public.users u
            where u.clinic_id = $1 and u.role = 'medical_technologist' and u.is_active = true
            order by (select count(*) from public.test_requests active
                       where active.clinic_id = u.clinic_id and active.assigned_technologist_id = u.id
                         and active.status = any($2::public.request_status[])) asc,
                     u.last_sign_in_at nulls first
            limit 1 for update of u skip locked`,
          [req.user.clinicId, ACTIVE_REQUEST_STATUSES],
        );
        if (!technologist) throw Object.assign(new Error("No active medical technologist is available."), { code: "NO_TECHNOLOGIST_AVAILABLE" });
        const paymentMethod = Number(request.total_amount) === 0 ? "waiver" : "cash";
        const [payment] = await tx.unsafe(
          `insert into public.payments (clinic_id, request_id, amount, method, recorded_by)
           values ($1, $2, $3, $4::public.payment_method, $5) returning id, paid_at, amount, method`,
          [req.user.clinicId, request.id, request.total_amount, paymentMethod, req.user.sub],
        );
        const invoiceNumber = code("INV");
        const [invoice] = await tx.unsafe(
          `insert into public.invoices (clinic_id, payment_id, invoice_number)
           values ($1, $2, $3) returning id, invoice_number, issued_at`,
          [req.user.clinicId, payment.id, invoiceNumber],
        );
        await tx.unsafe(
          `update public.test_requests set status = 'paid', paid_at = $1, assigned_technologist_id = $2, updated_at = now()
            where id = $3 and clinic_id = $4`,
          [payment.paid_at, technologist.id, request.id, req.user.clinicId],
        );
        const requirements = await tx.unsafe(
          `select sr.specimen_type, string_agg(distinct sr.collection_instructions, E'\n') as instructions
             from public.request_items ri
             join public.test_specimen_requirements sr on sr.test_id = ri.test_id and sr.clinic_id = ri.clinic_id and sr.is_required = true
            where ri.request_id = $1 and ri.clinic_id = $2
            group by sr.specimen_type order by sr.specimen_type`,
          [request.id, req.user.clinicId],
        );
        for (const requirement of requirements) {
          const [specimen] = await tx.unsafe(
            `insert into public.specimens (clinic_id, request_id, specimen_type, notes)
             values ($1, $2, $3, $4) returning id`,
            [req.user.clinicId, request.id, requirement.specimen_type, requirement.instructions],
          );
          await tx.unsafe(
            `insert into public.specimen_request_items (clinic_id, request_id, specimen_id, request_item_id)
             select ri.clinic_id, ri.request_id, $3, ri.id
               from public.request_items ri
               join public.test_specimen_requirements sr on sr.test_id = ri.test_id and sr.clinic_id = ri.clinic_id
              where ri.request_id = $1 and ri.clinic_id = $2 and sr.specimen_type = $4 and sr.is_required = true
             on conflict do nothing`,
            [request.id, req.user.clinicId, specimen.id, requirement.specimen_type],
          );
        }
        await tx.unsafe(
          `insert into public.request_status_history (clinic_id, request_id, old_status, new_status, changed_by, note)
           values ($1, $2, 'awaiting_payment', 'paid', $3, $4)`,
          [req.user.clinicId, request.id, req.user.sub, paymentMethod === "waiver" ? "Zero-fee waiver approved" : "Cash payment processed"],
        );
        await tx.unsafe(
          `insert into public.audit_logs (clinic_id, actor_user_id, action, entity_type, entity_id, details)
           values ($1, $2, 'request.paid', 'test_request', $3, jsonb_build_object('paymentId', $4::uuid, 'invoiceId', $5::uuid, 'technologistId', $6::uuid, 'paymentMethod', $7::text))`,
          [req.user.clinicId, req.user.sub, request.id, payment.id, invoice.id, technologist.id, paymentMethod],
        );
        return {
          requestId: request.id,
          requestNumber: request.request_number,
          payment,
          invoice,
          assignedTechnologistId: technologist.id,
          patientEmail: request.patient_email,
          patientName: request.patient_name,
          clinicName: request.clinic_name,
        };
      });
      const emailDelivery = await emailService.sendPaymentReceiptEmail({
        to: result.patientEmail,
        name: result.patientName,
        requestNumber: result.requestNumber,
        invoiceNumber: result.invoice.invoice_number,
        amount: result.payment.amount,
        paidAt: result.payment.paid_at,
        paymentMethod: result.payment.method,
        clinicName: result.clinicName,
      });
      return res.status(201).json({
        data: {
          requestId: result.requestId,
          requestNumber: result.requestNumber,
          payment: result.payment,
          invoice: result.invoice,
          assignedTechnologistId: result.assignedTechnologistId,
        },
        emailDelivery,
      });
    } catch (error) {
      if (["REQUEST_NOT_FOUND", "INVALID_REQUEST_STATUS", "NO_TECHNOLOGIST_AVAILABLE"].includes(error.code)) {
        return res.status(error.code === "REQUEST_NOT_FOUND" ? 404 : 409).json({ error: error.code, message: error.message });
      }
      return next(error);
    }
  });

  router.patch("/requests/:id/cancel", allowRoles("cashier"), async (req, res, next) => {
    try {
      const reason = String(req.body?.reason ?? "").trim();
      if (!reason) return res.status(400).json({ error: "CANCELLATION_REASON_REQUIRED" });
      const updated = await client.begin(async (tx) => {
        const [request] = await tx.unsafe(
          `select id, status from public.test_requests where id = $1 and clinic_id = $2 for update`,
          [req.params.id, req.user.clinicId],
        );
        if (!request) throw Object.assign(new Error("Request was not found."), { code: "REQUEST_NOT_FOUND" });
        if (request.status !== "awaiting_payment") throw Object.assign(new Error("Only unpaid requests can be cancelled. Paid requests require a separate void/refund workflow."), { code: "CANNOT_CANCEL_PAID_REQUEST" });
        await tx.unsafe(
          `update public.test_requests set status = 'cancelled', cancelled_at = now(), cancellation_reason = $1, updated_at = now()
            where id = $2 and clinic_id = $3`,
          [reason, request.id, req.user.clinicId],
        );
        await tx.unsafe(
          `update public.request_items set status = 'cancelled', updated_at = now() where request_id = $1 and clinic_id = $2`,
          [request.id, req.user.clinicId],
        );
        await tx.unsafe(
          `insert into public.request_status_history (clinic_id, request_id, old_status, new_status, changed_by, note)
           values ($1, $2, 'awaiting_payment', 'cancelled', $3, $4)`,
          [req.user.clinicId, request.id, req.user.sub, reason],
        );
        await tx.unsafe(
          `insert into public.audit_logs (clinic_id, actor_user_id, action, entity_type, entity_id, details)
           values ($1, $2, 'request.cancelled', 'test_request', $3, jsonb_build_object('reason', $4::text))`,
          [req.user.clinicId, req.user.sub, request.id, reason],
        );
        return request.id;
      });
      return res.json({ data: { requestId: updated, status: "cancelled" } });
    } catch (error) {
      if (["REQUEST_NOT_FOUND", "CANNOT_CANCEL_PAID_REQUEST"].includes(error.code)) return res.status(error.code === "REQUEST_NOT_FOUND" ? 404 : 409).json({ error: error.code, message: error.message });
      return next(error);
    }
  });

  router.get("/invoices", allowRoles("cashier"), async (req, res, next) => {
    try {
      const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
      const pageSize = Math.min(100, Math.max(1, Number.parseInt(req.query.pageSize, 10) || 10));
      const offset = (page - 1) * pageSize;
      const date = String(req.query.date ?? "");
      const query = String(req.query.q ?? '').trim();
      const period = String(req.query.period ?? '');
      if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) return res.status(400).json({ error: "INVALID_DATE_FILTER" });
      if (period && !['today', '7days', 'month'].includes(period)) return res.status(400).json({ error: 'INVALID_PERIOD_FILTER' });
      const [count] = await client.unsafe(
        `select count(*)::integer as total
           from public.invoices i join public.payments p on p.id = i.payment_id and p.clinic_id = i.clinic_id
           join public.test_requests r on r.id = p.request_id and r.clinic_id = p.clinic_id
           join public.patients pt on pt.id = r.patient_id and pt.clinic_id = r.clinic_id
          where i.clinic_id = $1
            and ($2::date is null or p.paid_at::date = $2::date) and p.voided_at is null
            and ($3 = '' or r.request_number ilike '%' || $3 || '%' or pt.pid ilike '%' || $3 || '%'
              or pt.first_name ilike '%' || $3 || '%' or pt.last_name ilike '%' || $3 || '%' or i.invoice_number ilike '%' || $3 || '%')
            and ($4 = '' or ($4 = 'today' and p.paid_at::date = current_date)
              or ($4 = '7days' and p.paid_at >= current_date - interval '6 days')
              or ($4 = 'month' and p.paid_at >= date_trunc('month', current_date)))`,
        [req.user.clinicId, date || null, query, period],
      );
      const data = await client.unsafe(
        `select i.id, i.invoice_number, i.issued_at, p.amount, p.paid_at, p.method,
                r.id as request_id, r.request_number, pt.pid,
                concat_ws(' ', pt.first_name, pt.middle_name, pt.last_name) as patient_name,
                coalesce((select jsonb_agg(jsonb_build_object(
                  'id', ri.id, 'name', ri.test_name_snapshot, 'price', ri.price_snapshot
                ) order by ri.created_at) from public.request_items ri
                   where ri.request_id = r.id and ri.clinic_id = r.clinic_id), '[]'::jsonb) as tests
           from public.invoices i join public.payments p on p.id = i.payment_id and p.clinic_id = i.clinic_id
           join public.test_requests r on r.id = p.request_id and r.clinic_id = p.clinic_id
           join public.patients pt on pt.id = r.patient_id and pt.clinic_id = r.clinic_id
          where i.clinic_id = $1
            and ($2::date is null or p.paid_at::date = $2::date) and p.voided_at is null
            and ($3 = '' or r.request_number ilike '%' || $3 || '%' or pt.pid ilike '%' || $3 || '%'
              or pt.first_name ilike '%' || $3 || '%' or pt.last_name ilike '%' || $3 || '%' or i.invoice_number ilike '%' || $3 || '%')
            and ($4 = '' or ($4 = 'today' and p.paid_at::date = current_date)
              or ($4 = '7days' and p.paid_at >= current_date - interval '6 days')
              or ($4 = 'month' and p.paid_at >= date_trunc('month', current_date)))
          order by p.paid_at desc limit $5 offset $6`,
        [req.user.clinicId, date || null, query, period, pageSize, offset],
      );
      return res.json({ data, pagination: { page, pageSize, total: count.total, totalPages: Math.ceil(count.total / pageSize) } });
    } catch (error) {
      return next(error);
    }
  });

  return router;
}
