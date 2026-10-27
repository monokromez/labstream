import { Router } from "express";
import PDFDocument from "pdfkit";
import { parsePhoneNumberFromString } from "libphonenumber-js/min";
import { allowRoles, createRequireAuth, requirePasswordSetupComplete } from "../auth/middleware.js";

const patientNamePattern = /^[\p{L}\p{M}]+(?:[ '\u2019.-][\p{L}\p{M}]+)*$/u;

export function validatePatientProfile(body) {
  const errors = {};
  for (const field of ["firstName", "middleName", "lastName"]) {
    const value = body[field] ?? "";
    if (typeof value !== "string") {
      errors[field] = "Enter a valid name.";
    } else if (field === "middleName" && !value) {
      continue;
    } else if (value !== value.trim() || value.length > 50
      || (field !== "middleName" && value.length < 2)
      || !patientNamePattern.test(value)) {
      errors[field] = field === "middleName"
        ? "Enter a valid middle name or initial (up to 50 characters)."
        : "Names must be valid and between 2 and 50 characters.";
    }
  }
  if (body.email != null && body.email !== "") {
    if (typeof body.email !== "string" || body.email.length > 254
      || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email.trim())) {
      errors.email = "Enter a valid email address (up to 254 characters).";
    }
  }
  if (typeof body.phone !== "string" || body.phone.length > 32) {
    errors.phone = "Enter a valid phone number.";
  } else {
    const phone = parsePhoneNumberFromString(body.phone.trim());
    if (!phone?.isValid()) errors.phone = "Enter a valid international phone number.";
  }
  return errors;
}

export function createPatientRouter({ client }) {
  const router = Router();
  router.use(createRequireAuth(client), requirePasswordSetupComplete, allowRoles("patient"));

  router.get("/results", async (req, res, next) => {
    try {
      const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
      const pageSize = Math.min(100, Math.max(1, Number.parseInt(req.query.pageSize, 10) || 10));
      const offset = (page - 1) * pageSize;
      const [patient] = await client.unsafe(
        `select p.id, p.pid, p.first_name, p.middle_name, p.last_name, p.date_of_birth, p.sex, p.email, p.phone,
                c.name as clinic_name
           from public.patients p join public.clinics c on c.id = p.clinic_id
          where p.portal_user_id = $1 and p.clinic_id = $2`,
        [req.user.sub, req.user.clinicId],
      );
      if (!patient) return res.status(404).json({ error: "PATIENT_PROFILE_NOT_FOUND" });
      const [count] = await client.unsafe(
        `select count(*)::integer as total from public.test_requests
          where clinic_id = $1 and patient_id = $2 and status <> 'cancelled'`,
        [req.user.clinicId, patient.id],
      );
      const [testSummary] = await client.unsafe(
        `select count(ri.id)::integer as total_tests,
                count(ri.id) filter (where r.status = 'released')::integer as released_tests,
                count(ri.id) filter (where r.status <> 'released')::integer as unreleased_tests
           from public.test_requests r join public.request_items ri on ri.request_id = r.id and ri.clinic_id = r.clinic_id
          where r.clinic_id = $1 and r.patient_id = $2 and r.status <> 'cancelled'`,
        [req.user.clinicId, patient.id],
      );
      const data = await client.unsafe(
        `select r.id, r.request_number, r.status, r.priority, r.requested_at, r.released_at,
                count(ri.id)::integer as test_count,
                case when r.status = 'released' then 'released' else 'unreleased' end as result_visibility
           from public.test_requests r
           join public.request_items ri on ri.request_id = r.id and ri.clinic_id = r.clinic_id
          where r.clinic_id = $1 and r.patient_id = $2 and r.status <> 'cancelled'
          group by r.id order by r.requested_at desc limit $3 offset $4`,
        [req.user.clinicId, patient.id, pageSize, offset],
      );
      // Results are intentionally omitted for unreleased requests. A request is
      // visible as a result only when all its test items have been released.
      for (const request of data) {
        if (request.status !== "released") continue;
        request.tests = await client.unsafe(
          `select ri.id as request_item_id, ri.test_name_snapshot as test_name,
                  rs.pathologist_interpretation,
                  coalesce((select jsonb_agg(jsonb_build_object(
                    'label', a.label, 'valueType', a.value_type,
                    'numericValue', rv.numeric_value, 'textValue', rv.text_value,
                    'selectValue', rv.select_value, 'booleanValue', rv.boolean_value, 'structuredValue', rv.structured_value,
                    'unit', rv.unit_snapshot, 'lowerLimit', rv.lower_limit_snapshot,
                    'upperLimit', rv.upper_limit_snapshot, 'isAbnormal', rv.is_abnormal) order by a.sort_order)
                    from public.result_values rv join public.test_analytes a on a.id = rv.analyte_id and a.clinic_id = rv.clinic_id
                   where rv.result_submission_id = rs.id), '[]'::jsonb) as values
             from public.request_items ri
             join lateral (select rs.* from public.result_submissions rs
                            where rs.request_item_id = ri.id and rs.clinic_id = ri.clinic_id and rs.status = 'approved'
                            order by rs.revision_number desc limit 1) rs on true
            where ri.request_id = $1 and ri.clinic_id = $2 order by ri.created_at`,
          [request.id, req.user.clinicId],
        );
        await client.unsafe(
          `insert into public.audit_logs (clinic_id, actor_user_id, action, entity_type, entity_id, details)
           values ($1, $2, 'patient.results_accessed', 'test_request', $3,
             jsonb_build_object('requestNumber', $4::text, 'accessMethod', 'portal'))`,
          [req.user.clinicId, req.user.sub, request.id, request.request_number],
        );
      }
      return res.json({
        data,
        patient: {
          pid: patient.pid,
          name: [patient.first_name, patient.middle_name, patient.last_name].filter(Boolean).join(" "),
          firstName: patient.first_name,
          middleName: patient.middle_name ?? "",
          lastName: patient.last_name,
          email: patient.email,
          phone: patient.phone,
          dateOfBirth: patient.date_of_birth,
          sex: patient.sex,
        },
        clinic: { name: patient.clinic_name },
        summary: testSummary,
        pagination: { page, pageSize, total: count.total, totalPages: Math.ceil(count.total / pageSize) },
      });
    } catch (error) {
      return next(error);
    }
  });

  router.patch("/profile", async (req, res, next) => {
    try {
      const body = req.body ?? {};
      const validationErrors = validatePatientProfile(body);
      if (Object.keys(validationErrors).length) {
        return res.status(400).json({
          error: "INVALID_PATIENT_PROFILE",
          message: "Correct the profile details and try again.",
          fields: validationErrors,
        });
      }
      const phone = parsePhoneNumberFromString(body.phone.trim()).number;
      const email = body.email?.trim()?.toLowerCase() || null;
      const updated = await client.begin(async (tx) => {
        const [patient] = await tx.unsafe(
          `select id from public.patients where portal_user_id = $1 and clinic_id = $2 for update`,
          [req.user.sub, req.user.clinicId],
        );
        if (!patient) return null;
        const [profile] = await tx.unsafe(
          `update public.patients
              set first_name = $1, middle_name = $2, last_name = $3,
                  email = $4, phone = $5, updated_at = now()
            where id = $6 and clinic_id = $7
            returning id, pid, first_name, middle_name, last_name, email, phone`,
          [body.firstName.trim(), body.middleName.trim() || null, body.lastName.trim(),
            email, phone, patient.id, req.user.clinicId],
        );
        await tx.unsafe(
          `update public.users set email = $1, updated_at = now()
            where id = $2 and clinic_id = $3 and role = 'patient'`,
          [email, req.user.sub, req.user.clinicId],
        );
        await tx.unsafe(
          `insert into public.audit_logs (clinic_id, actor_user_id, action, entity_type, entity_id, details)
           values ($1, $2, 'patient.profile_updated', 'patient', $3,
             jsonb_build_object('fields', $4::jsonb))`,
          [req.user.clinicId, req.user.sub, patient.id,
            JSON.stringify(["firstName", "middleName", "lastName", "email", "phone"])],
        );
        return profile;
      });
      if (!updated) return res.status(404).json({ error: "PATIENT_PROFILE_NOT_FOUND" });
      return res.json({ data: updated });
    } catch (error) {
      if (error.code === "23505") {
        return res.status(409).json({ error: "EMAIL_ALREADY_IN_USE", message: "That email address is already used by another account." });
      }
      return next(error);
    }
  });

  router.get("/results/:requestId/pdf", async (req, res, next) => {
    try {
      const [patient] = await client.unsafe(
        `select p.id, p.pid, p.first_name, p.middle_name, p.last_name, p.date_of_birth, p.sex, c.name as clinic_name
           from public.patients p join public.clinics c on c.id = p.clinic_id
          where p.portal_user_id = $1 and p.clinic_id = $2`, [req.user.sub, req.user.clinicId]);
      if (!patient) return res.status(404).json({ error: "PATIENT_PROFILE_NOT_FOUND" });
      const [request] = await client.unsafe(
        `select id, request_number, released_at from public.test_requests
          where id = $1 and clinic_id = $2 and patient_id = $3 and status = 'released'`,
        [req.params.requestId, req.user.clinicId, patient.id]);
      if (!request) return res.status(404).json({ error: "RELEASED_RESULT_NOT_FOUND", message: "This released result was not found in your account." });
      const tests = await client.unsafe(
        `select ri.test_name_snapshot as test_name, rs.pathologist_interpretation,
                coalesce((select jsonb_agg(jsonb_build_object(
                  'label', a.label, 'numericValue', rv.numeric_value, 'textValue', rv.text_value,
                  'selectValue', rv.select_value, 'booleanValue', rv.boolean_value,
                  'structuredValue', rv.structured_value, 'unit', rv.unit_snapshot,
                  'lowerLimit', rv.lower_limit_snapshot, 'upperLimit', rv.upper_limit_snapshot)
                  order by a.sort_order) from public.result_values rv
                  join public.test_analytes a on a.id = rv.analyte_id and a.clinic_id = rv.clinic_id
                 where rv.result_submission_id = rs.id), '[]'::jsonb) as values
           from public.request_items ri
           join lateral (select rs.* from public.result_submissions rs
                          where rs.request_item_id = ri.id and rs.clinic_id = ri.clinic_id and rs.status = 'approved'
                          order by rs.revision_number desc limit 1) rs on true
          where ri.request_id = $1 and ri.clinic_id = $2 order by ri.created_at`,
        [request.id, req.user.clinicId]);
      await client.unsafe(
        `insert into public.audit_logs (clinic_id, actor_user_id, action, entity_type, entity_id, details)
         values ($1, $2, 'patient.result_pdf_downloaded', 'test_request', $3,
           jsonb_build_object('requestNumber', $4::text, 'format', 'pdf'))`,
        [req.user.clinicId, req.user.sub, request.id, request.request_number]);
      const safeRequestNumber = String(request.request_number).replace(/[^a-zA-Z0-9_-]/g, "-");
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `attachment; filename="labstream-result-${safeRequestNumber}.pdf"`);
      const pdf = new PDFDocument({ margin: 48, size: "A4" });
      pdf.pipe(res);
      pdf.fontSize(18).fillColor("#14564f").text(patient.clinic_name || "Diagnostic Laboratory");
      pdf.moveDown(0.2).fontSize(13).fillColor("#183f43").text("Released Diagnostic Result");
      pdf.moveDown(0.5).fontSize(10).fillColor("#183f43")
        .text(`Request: ${request.request_number}`)
        .text(`Patient: ${[patient.first_name, patient.middle_name, patient.last_name].filter(Boolean).join(" ")}`)
        .text(`PID: ${patient.pid}`)
        .text(`Date of birth: ${patient.date_of_birth ?? "—"}    Sex: ${patient.sex ?? "—"}`)
        .text(`Released: ${new Date(request.released_at).toLocaleString("en-PH")}`);
      tests.forEach((test) => {
        pdf.moveDown(0.8).fontSize(12).fillColor("#14564f").text(test.test_name);
        for (const value of test.values ?? []) {
          const result = Array.isArray(value.structuredValue)
            ? value.structuredValue.map((row) => Object.entries(row).map(([key, cell]) => `${key}: ${cell}`).join(" · ")).join(" | ")
            : [value.numericValue, value.textValue, value.selectValue, value.booleanValue == null ? null : (value.booleanValue ? "Yes" : "No")].find((entry) => entry != null) ?? "—";
          pdf.fontSize(9).fillColor("#183f43").text(`${value.label}: ${result}${value.unit ? ` ${value.unit}` : ""}`);
          if (value.lowerLimit != null || value.upperLimit != null) pdf.fontSize(8).fillColor("#526d70").text(`Reference range: ${value.lowerLimit ?? "—"} – ${value.upperLimit ?? "—"}${value.unit ? ` ${value.unit}` : ""}`);
        }
        if (test.pathologist_interpretation) pdf.moveDown(0.3).fontSize(9).fillColor("#183f43").text(`Pathologist interpretation: ${test.pathologist_interpretation}`);
      });
      pdf.moveDown(1).fontSize(8).fillColor("#526d70").text("This report contains the released results recorded by the laboratory.");
      pdf.end();
    } catch (error) { return next(error); }
  });

  router.get("/test-history", async (req, res, next) => {
    try {
      const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
      const pageSize = Math.min(100, Math.max(1, Number.parseInt(req.query.pageSize, 10) || 10));
      const offset = (page - 1) * pageSize;
      const query = String(req.query.q ?? '').trim();
      const status = String(req.query.status ?? '').trim();
      const [patient] = await client.unsafe(`select id from public.patients where portal_user_id = $1 and clinic_id = $2`, [req.user.sub, req.user.clinicId]);
      if (!patient) return res.status(404).json({ error: "PATIENT_PROFILE_NOT_FOUND" });
      const [count] = await client.unsafe(
        `select count(*)::integer as total from public.request_items ri
          join public.test_requests r on r.id = ri.request_id and r.clinic_id = ri.clinic_id
         where r.clinic_id = $1 and r.patient_id = $2 and r.status <> 'cancelled'
           and ($3 = '' or r.request_number ilike '%' || $3 || '%' or ri.test_name_snapshot ilike '%' || $3 || '%')
           and ($4 = '' or ri.status::text = $4)`,
        [req.user.clinicId, patient.id, query, status],
      );
      const data = await client.unsafe(
        `select ri.id, r.request_number, ri.test_name_snapshot as test_name,
                ri.category_name_snapshot as category, ri.status, r.priority, r.requested_at, r.released_at,
                case when r.status = 'released' then 'released' else 'unreleased' end as result_visibility
           from public.request_items ri
           join public.test_requests r on r.id = ri.request_id and r.clinic_id = ri.clinic_id
          where r.clinic_id = $1 and r.patient_id = $2 and r.status <> 'cancelled'
            and ($5 = '' or r.request_number ilike '%' || $5 || '%' or ri.test_name_snapshot ilike '%' || $5 || '%')
            and ($6 = '' or ri.status::text = $6)
          order by r.requested_at desc, ri.created_at
          limit $3 offset $4`,
        [req.user.clinicId, patient.id, pageSize, offset, query, status],
      );
      return res.json({ data, pagination: { page, pageSize, total: count.total, totalPages: Math.ceil(count.total / pageSize) } });
    } catch (error) {
      return next(error);
    }
  });
  return router;
}
