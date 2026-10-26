import { Router } from "express";
import { allowRoles, createRequireAuth, requirePasswordSetupComplete, requireSameOrigin } from "../auth/middleware.js";

export function createTechnologistRouter({ client }) {
  const router = Router();
  router.use(createRequireAuth(client), requirePasswordSetupComplete, requireSameOrigin, allowRoles("medical_technologist"));

  router.get("/work-queue", async (req, res, next) => {
    try {
      const data = await client.unsafe(
        `select r.id, r.request_number, r.queue_ticket::text as queue_ticket, r.status, r.priority, r.requested_at, r.paid_at,
                receipt.receipt_number,
                p.pid, p.sex, p.date_of_birth, concat_ws(' ', p.first_name, p.middle_name, p.last_name) as patient_name,
                count(ri.id)::integer as test_count,
                count(ri.id) filter (where ri.status in ('drafted', 'submitted', 'approved', 'released'))::integer as completed_test_count
           from public.test_requests r
           join public.patients p on p.id = r.patient_id and p.clinic_id = r.clinic_id
           join public.request_items ri on ri.request_id = r.id and ri.clinic_id = r.clinic_id
           left join lateral (
             select i.invoice_number as receipt_number
               from public.payments payment
               join public.invoices i on i.payment_id = payment.id and i.clinic_id = payment.clinic_id
              where payment.request_id = r.id and payment.clinic_id = r.clinic_id and payment.voided_at is null
              order by payment.paid_at desc limit 1
           ) receipt on true
          where r.clinic_id = $1 and r.assigned_technologist_id = $2
            and r.status = any($3::public.request_status[])
          group by r.id, p.id, receipt.receipt_number order by r.priority desc, r.paid_at`,
        [req.user.clinicId, req.user.sub, ["paid", "specimen_collection", "processing", "correction"]],
      );
      return res.json({ data });
    } catch (error) {
      return next(error);
    }
  });

  router.get("/specimens", async (req, res, next) => {
    try {
      const status = String(req.query.status ?? "");
      const data = await client.unsafe(
        `select s.id, s.request_id, s.replaces_specimen_id, r.request_number, s.specimen_type, s.attempt_number,
                s.status, s.received_at, s.rejection_reason, s.notes,
                p.pid, concat_ws(' ', p.first_name, p.middle_name, p.last_name) as patient_name,
                array_agg(distinct jsonb_build_object('id', ri.id, 'testId', ri.test_id, 'testName', ri.test_name_snapshot, 'category', ri.category_name_snapshot, 'status', ri.status)) as tests
           from public.specimens s
           join public.test_requests r on r.id = s.request_id and r.clinic_id = s.clinic_id
           join public.patients p on p.id = r.patient_id and p.clinic_id = r.clinic_id
           join public.specimen_request_items sri on sri.specimen_id = s.id and sri.clinic_id = s.clinic_id
           join public.request_items ri on ri.id = sri.request_item_id and ri.clinic_id = sri.clinic_id
          where s.clinic_id = $1 and r.assigned_technologist_id = $2
            and ($3 = '' or s.status::text = $3)
            and s.status in ('expected', 'received', 'accepted', 'rejected', 'for_recollection')
          group by s.id, r.id, p.id order by s.created_at, s.attempt_number`,
        [req.user.clinicId, req.user.sub, status],
      );
      for (const specimen of data) {
        specimen.tests = await Promise.all(specimen.tests.map(async (test) => {
          const [latest] = await client.unsafe(
            `select rs.id, rs.status, rs.revision_number, rs.pathologist_interpretation, rs.updated_at,
                    (select rr.remarks from public.result_reviews rr
                      where rr.result_submission_id = rs.id and rr.clinic_id = rs.clinic_id
                      order by rr.reviewed_at desc limit 1) as review_remarks,
                    coalesce((select jsonb_agg(jsonb_build_object(
                      'analyteId', rv.analyte_id, 'numericValue', rv.numeric_value,
                      'textValue', rv.text_value, 'selectValue', rv.select_value,
                      'booleanValue', rv.boolean_value, 'structuredValue', rv.structured_value
                    )) from public.result_values rv where rv.result_submission_id = rs.id and rv.clinic_id = rs.clinic_id), '[]'::jsonb) as values
               from public.result_submissions rs
              where rs.request_item_id = $1 and rs.clinic_id = $2
              order by rs.revision_number desc limit 1`,
            [test.id, req.user.clinicId],
          );
          return { ...test, latestResult: latest ?? null };
        }));
      }
      return res.json({ data });
    } catch (error) {
      return next(error);
    }
  });

  router.post("/specimens/:id/receive", async (req, res, next) => {
    try {
      const data = await client.begin(async (tx) => {
        const [specimen] = await tx.unsafe(
          `select s.id, s.request_id, s.status, r.status as request_status
             from public.specimens s join public.test_requests r on r.id = s.request_id and r.clinic_id = s.clinic_id
            where s.id = $1 and s.clinic_id = $2 and r.assigned_technologist_id = $3 for update of s, r`,
          [req.params.id, req.user.clinicId, req.user.sub],
        );
        if (!specimen) throw Object.assign(new Error("Specimen was not found in your work queue."), { code: "SPECIMEN_NOT_FOUND" });
        if (!["expected", "for_recollection"].includes(specimen.status)) throw Object.assign(new Error("Only expected specimens can be marked received."), { code: "INVALID_SPECIMEN_STATUS" });
        const [updated] = await tx.unsafe(
          `update public.specimens set status = 'received', received_at = now(), received_by = $1, updated_at = now()
            where id = $2 and clinic_id = $3 returning id, status, received_at`,
          [req.user.sub, specimen.id, req.user.clinicId],
        );
        await tx.unsafe(
          `update public.test_requests set status = 'processing', updated_at = now()
            where id = $1 and clinic_id = $2 and status in ('paid', 'specimen_collection')`,
          [specimen.request_id, req.user.clinicId],
        );
        await tx.unsafe(
          `update public.request_items ri set status = case when ri.status = 'for_recollection' then 'for_recollection'::public.request_item_status else 'specimen_received'::public.request_item_status end, updated_at = now()
            where ri.id in (select request_item_id from public.specimen_request_items where specimen_id = $1 and clinic_id = $2)
              and ri.status in ('awaiting_specimen', 'for_recollection')`,
          [specimen.id, req.user.clinicId],
        );
        await tx.unsafe(
          `insert into public.audit_logs (clinic_id, actor_user_id, action, entity_type, entity_id)
           values ($1, $2, 'specimen.received', 'specimen', $3)`,
          [req.user.clinicId, req.user.sub, specimen.id],
        );
        return updated;
      });
      return res.json({ data });
    } catch (error) {
      if (["SPECIMEN_NOT_FOUND", "INVALID_SPECIMEN_STATUS"].includes(error.code)) return res.status(error.code === "SPECIMEN_NOT_FOUND" ? 404 : 409).json({ error: error.code, message: error.message });
      return next(error);
    }
  });

  router.post("/specimens/:id/accept", async (req, res, next) => {
    try {
      const data = await client.begin(async (tx) => {
        const [specimen] = await tx.unsafe(
          `select s.id, s.request_id, s.status
             from public.specimens s join public.test_requests r on r.id = s.request_id and r.clinic_id = s.clinic_id
            where s.id = $1 and s.clinic_id = $2 and r.assigned_technologist_id = $3 for update of s, r`,
          [req.params.id, req.user.clinicId, req.user.sub],
        );
        if (!specimen) throw Object.assign(new Error("Specimen was not found in your work queue."), { code: "SPECIMEN_NOT_FOUND" });
        if (specimen.status !== "received") throw Object.assign(new Error("A specimen must be received before it can be accepted."), { code: "INVALID_SPECIMEN_STATUS" });
        const [updated] = await tx.unsafe(
          `update public.specimens set status = 'accepted', accepted_at = now(), updated_at = now()
            where id = $1 and clinic_id = $2 returning id, status, accepted_at`,
          [specimen.id, req.user.clinicId],
        );
        await tx.unsafe(
          `update public.request_items ri set status = case when ri.status = 'for_recollection' then 'for_recollection'::public.request_item_status else 'processing'::public.request_item_status end, updated_at = now()
            where ri.id in (select request_item_id from public.specimen_request_items where specimen_id = $1 and clinic_id = $2)
              and ri.status in ('specimen_received', 'for_recollection')`,
          [specimen.id, req.user.clinicId],
        );
        await tx.unsafe(
          `insert into public.audit_logs (clinic_id, actor_user_id, action, entity_type, entity_id)
           values ($1, $2, 'specimen.accepted', 'specimen', $3)`,
          [req.user.clinicId, req.user.sub, specimen.id],
        );
        return updated;
      });
      return res.json({ data });
    } catch (error) {
      if (["SPECIMEN_NOT_FOUND", "INVALID_SPECIMEN_STATUS"].includes(error.code)) return res.status(error.code === "SPECIMEN_NOT_FOUND" ? 404 : 409).json({ error: error.code, message: error.message });
      return next(error);
    }
  });

  router.post("/specimens/:id/reject", async (req, res, next) => {
    try {
      const reason = String(req.body?.reason ?? "").trim();
      if (!reason) return res.status(400).json({ error: "REJECTION_REASON_REQUIRED" });
      const data = await client.begin(async (tx) => {
        const [specimen] = await tx.unsafe(
          `select s.id, s.request_id, s.specimen_type, s.attempt_number, s.status
             from public.specimens s join public.test_requests r on r.id = s.request_id and r.clinic_id = s.clinic_id
            where s.id = $1 and s.clinic_id = $2 and r.assigned_technologist_id = $3 for update of s, r`,
          [req.params.id, req.user.clinicId, req.user.sub],
        );
        if (!specimen) throw Object.assign(new Error("Specimen was not found in your work queue."), { code: "SPECIMEN_NOT_FOUND" });
        if (!["expected", "received"].includes(specimen.status)) throw Object.assign(new Error("Only an expected or received specimen can be rejected."), { code: "INVALID_SPECIMEN_STATUS" });
        const items = await tx.unsafe(
          `select ri.id from public.specimen_request_items sri
            join public.request_items ri on ri.id = sri.request_item_id and ri.clinic_id = sri.clinic_id
           where sri.specimen_id = $1 and sri.clinic_id = $2`,
          [specimen.id, req.user.clinicId],
        );
        if (!items.length) throw Object.assign(new Error("No requested tests are linked to this specimen."), { code: "SPECIMEN_HAS_NO_TESTS" });
        const [updated] = await tx.unsafe(
          `update public.specimens set status = 'rejected', rejected_at = now(), rejection_reason = $1, updated_at = now()
            where id = $2 and clinic_id = $3 returning id, status, rejection_reason`,
          [reason, specimen.id, req.user.clinicId],
        );
        const [replacement] = await tx.unsafe(
          `insert into public.specimens (clinic_id, request_id, specimen_type, attempt_number, replaces_specimen_id, status, notes)
           select $1, $2, $3, coalesce(max(attempt_number), 0) + 1, $4, 'for_recollection', $5
             from public.specimens where request_id = $2 and clinic_id = $1 and specimen_type = $3
           returning id, attempt_number, status`,
          [req.user.clinicId, specimen.request_id, specimen.specimen_type, specimen.id, `Recollection: ${reason}`],
        );
        for (const item of items) {
          await tx.unsafe(
            `insert into public.specimen_request_items (clinic_id, request_id, specimen_id, request_item_id)
             values ($1, $2, $3, $4) on conflict do nothing`,
            [req.user.clinicId, specimen.request_id, replacement.id, item.id],
          );
          await tx.unsafe(`update public.request_items set status = 'for_recollection', updated_at = now() where id = $1 and clinic_id = $2`, [item.id, req.user.clinicId]);
        }
        await tx.unsafe(
          `update public.test_requests set status = case when status = 'correction' then 'correction'::public.request_status else 'specimen_collection'::public.request_status end, updated_at = now() where id = $1 and clinic_id = $2`,
          [specimen.request_id, req.user.clinicId],
        );
        await tx.unsafe(
          `insert into public.audit_logs (clinic_id, actor_user_id, action, entity_type, entity_id, details)
           values ($1, $2, 'specimen.rejected', 'specimen', $3, jsonb_build_object('reason', $4::text, 'replacementId', $5::uuid))`,
          [req.user.clinicId, req.user.sub, specimen.id, reason, replacement.id],
        );
        return { rejected: updated, replacement, affectedTestCount: items.length };
      });
      return res.json({ data });
    } catch (error) {
      if (["SPECIMEN_NOT_FOUND", "INVALID_SPECIMEN_STATUS", "SPECIMEN_HAS_NO_TESTS"].includes(error.code)) return res.status(error.code === "SPECIMEN_NOT_FOUND" ? 404 : 409).json({ error: error.code, message: error.message });
      return next(error);
    }
  });

  router.post("/requests/:requestId/items/:itemId/draft", async (req, res, next) => {
    try {
      const specimenIds = [...new Set(Array.isArray(req.body?.specimenIds) ? req.body.specimenIds : [req.body?.specimenId].filter(Boolean))];
      const values = Array.isArray(req.body?.values) ? req.body.values : null;
      if (!specimenIds.length || specimenIds.length > 10 || !values || values.length > 100) return res.status(400).json({ error: "INVALID_RESULT_DRAFT" });
      const result = await client.begin(async (tx) => {
        const [context] = await tx.unsafe(
          `select r.id as request_id, r.status as request_status, r.assigned_technologist_id,
                  ri.id as item_id, ri.test_id, ri.status as item_status, p.date_of_birth, p.sex
             from public.test_requests r
             join public.request_items ri on ri.request_id = r.id and ri.clinic_id = r.clinic_id
             join public.patients p on p.id = r.patient_id and p.clinic_id = r.clinic_id
            where r.id = $1 and r.clinic_id = $2 and r.assigned_technologist_id = $3
              and ri.id = $4 for update of r, ri`,
          [req.params.requestId, req.user.clinicId, req.user.sub, req.params.itemId],
        );
        if (!context) throw Object.assign(new Error("Request, test, or specimen was not found in your assigned work."), { code: "RESULT_CONTEXT_NOT_FOUND" });
        if (!["processing", "correction"].includes(context.request_status) || !["processing", "drafted", "returned", "for_recollection"].includes(context.item_status)) {
          throw Object.assign(new Error("This test is not currently available for result entry."), { code: "RESULT_NOT_EDITABLE" });
        }
        const acceptedSpecimens = await tx.unsafe(
          `select s.id, s.specimen_type
             from public.specimens s
             join public.specimen_request_items sri on sri.specimen_id = s.id and sri.request_id = s.request_id and sri.clinic_id = s.clinic_id
            where sri.request_item_id = $1 and s.request_id = $2 and s.clinic_id = $3
              and s.id = any($4::uuid[]) and s.status = 'accepted'`,
          [context.item_id, context.request_id, req.user.clinicId, specimenIds],
        );
        if (acceptedSpecimens.length !== specimenIds.length) throw Object.assign(new Error("Choose only accepted specimens linked to this test."), { code: "SPECIMEN_NOT_ACCEPTED" });
        const [missingSpecimenRequirement] = await tx.unsafe(
          `select sr.specimen_type
             from public.test_specimen_requirements sr
            where sr.test_id = $1 and sr.clinic_id = $2 and sr.is_required = true
              and not exists (
                select 1 from public.specimen_request_items sri
                join public.specimens s on s.id = sri.specimen_id and s.request_id = sri.request_id and s.clinic_id = sri.clinic_id
                where sri.request_item_id = $3 and sri.request_id = $4 and sri.clinic_id = $2
                  and s.specimen_type = sr.specimen_type and s.id = any($5::uuid[]) and s.status = 'accepted'
              ) limit 1`,
          [context.test_id, req.user.clinicId, context.item_id, context.request_id, specimenIds],
        );
        if (missingSpecimenRequirement) throw Object.assign(new Error(`The required ${missingSpecimenRequirement.specimen_type} specimen must be accepted before result entry.`), { code: "SPECIMEN_NOT_ACCEPTED" });
        const analytes = await tx.unsafe(
          `select a.id, a.value_type::text as value_type, a.options, a.unit,
                  rr.lower_limit, rr.upper_limit, coalesce(rr.unit, a.unit) as result_unit, a.is_required
             from public.test_analytes a
             left join lateral (
               select r.lower_limit, r.upper_limit, r.unit
                 from public.reference_ranges r
                where r.analyte_id = a.id and r.clinic_id = a.clinic_id and r.is_active = true
                  and (r.sex is null or r.sex = $3)
                  and (r.min_age_days is null or current_date - $4::date >= r.min_age_days)
                  and (r.max_age_days is null or current_date - $4::date <= r.max_age_days)
                order by (r.sex is not null) desc, coalesce(r.min_age_days, 0) desc limit 1
             ) rr on true
            where a.test_id = $1 and a.clinic_id = $2 order by a.sort_order, a.label`,
          [context.test_id, req.user.clinicId, context.sex, context.date_of_birth],
        );
        if (!analytes.length) throw Object.assign(new Error("This test has no analyte/result fields configured."), { code: "TEST_RESULT_SETUP_MISSING" });
        const byId = new Map(analytes.map((analyte) => [analyte.id, analyte]));
        for (const value of values) {
          const analyte = byId.get(value.analyteId);
          if (!analyte) throw Object.assign(new Error("A submitted analyte does not belong to this test."), { code: "INVALID_ANALYTE" });
          const actual = [value.numericValue != null, value.textValue != null, value.selectValue != null, value.booleanValue != null, value.structuredValue != null].filter(Boolean).length;
          const expected = { numeric: "numericValue", text: "textValue", select: "selectValue", boolean: "booleanValue", structured: "structuredValue" }[analyte.value_type];
          if (actual > 1 || (actual === 1 && value[expected] == null)) throw Object.assign(new Error(`Value type does not match analyte ${value.analyteId}.`), { code: "INVALID_ANALYTE_VALUE" });
          if (analyte.value_type === "numeric" && value.numericValue != null && !Number.isFinite(Number(value.numericValue))) throw Object.assign(new Error("Numeric results must be finite numbers."), { code: "INVALID_ANALYTE_VALUE" });
          if (analyte.value_type === "select" && value.selectValue != null && !analyte.options.includes(value.selectValue)) throw Object.assign(new Error("Select a configured result option."), { code: "INVALID_SELECT_VALUE" });
          if (analyte.value_type === "structured" && value.structuredValue != null) {
            if (!Array.isArray(value.structuredValue) || value.structuredValue.length > 100) throw Object.assign(new Error("Structured results must be a table with no more than 100 rows."), { code: "INVALID_ANALYTE_VALUE" });
            for (const row of value.structuredValue) {
              if (!row || typeof row !== "object" || Array.isArray(row) || Object.keys(row).some((key) => !analyte.options.includes(key))
                || Object.values(row).some((cell) => typeof cell !== "string" || cell.length > 500)) {
                throw Object.assign(new Error("Structured result rows must match the configured columns."), { code: "INVALID_ANALYTE_VALUE" });
              }
            }
          }
        }
        const [latest] = await tx.unsafe(
          `select id, revision_number, status from public.result_submissions
            where request_item_id = $1 and clinic_id = $2 order by revision_number desc limit 1 for update`,
          [context.item_id, req.user.clinicId],
        );
        let submission;
        if (latest?.status === "draft") {
          [submission] = await tx.unsafe(
            `update public.result_submissions set specimen_id = $1, pathologist_interpretation = null, updated_at = now()
              where id = $2 and clinic_id = $3 returning id, revision_number`,
            [specimenIds[0], latest.id, req.user.clinicId],
          );
          await tx.unsafe(`delete from public.result_values where result_submission_id = $1 and clinic_id = $2`, [latest.id, req.user.clinicId]);
          await tx.unsafe(`delete from public.result_submission_specimens where result_submission_id = $1 and clinic_id = $2`, [latest.id, req.user.clinicId]);
        } else {
          const revision = (latest?.revision_number ?? 0) + 1;
          [submission] = await tx.unsafe(
            `insert into public.result_submissions
              (clinic_id, request_id, request_item_id, specimen_id, revision_number, status, entered_by, supersedes_result_id)
             values ($1, $2, $3, $4, $5, 'draft', $6, $7) returning id, revision_number`,
            [req.user.clinicId, context.request_id, context.item_id, specimenIds[0], revision, req.user.sub, latest?.status === "returned" ? latest.id : null],
          );
        }
        for (const specimenId of specimenIds) {
          await tx.unsafe(
            `insert into public.result_submission_specimens (clinic_id, request_id, result_submission_id, specimen_id)
             values ($1, $2, $3, $4)`,
            [req.user.clinicId, context.request_id, submission.id, specimenId],
          );
        }
        for (const value of values) {
          const analyte = byId.get(value.analyteId);
          const supplied = [value.numericValue, value.textValue, value.selectValue, value.booleanValue, value.structuredValue].some((entry) => entry != null && entry !== "");
          if (!supplied) continue;
          const numericValue = value.numericValue == null ? null : Number(value.numericValue);
          const abnormal = numericValue != null && ((analyte.lower_limit != null && numericValue < Number(analyte.lower_limit)) || (analyte.upper_limit != null && numericValue > Number(analyte.upper_limit)));
          await tx.unsafe(
            `insert into public.result_values
              (clinic_id, result_submission_id, analyte_id, numeric_value, text_value, select_value, boolean_value, structured_value,
               unit_snapshot, lower_limit_snapshot, upper_limit_snapshot, is_abnormal)
             values ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9,$10,$11,$12)`,
            [req.user.clinicId, submission.id, value.analyteId,
              analyte.value_type === "numeric" ? numericValue : null,
              analyte.value_type === "text" ? value.textValue ?? null : null,
              analyte.value_type === "select" ? value.selectValue ?? null : null,
              analyte.value_type === "boolean" ? value.booleanValue ?? null : null,
              analyte.value_type === "structured" ? JSON.stringify(value.structuredValue) : null,
              analyte.result_unit, analyte.lower_limit, analyte.upper_limit, abnormal],
          );
        }
        await tx.unsafe(`update public.request_items set status = 'drafted', updated_at = now() where id = $1 and clinic_id = $2`, [context.item_id, req.user.clinicId]);
        await tx.unsafe(
          `insert into public.audit_logs (clinic_id, actor_user_id, action, entity_type, entity_id, details)
           values ($1, $2, 'results.draft_saved', 'result_submission', $3,
             jsonb_build_object('requestItemId', $4::uuid, 'revision', $5::integer, 'valueCount', $6::integer))`,
          [req.user.clinicId, req.user.sub, submission.id, context.item_id, submission.revision_number, values.filter((value) => [value.numericValue, value.textValue, value.selectValue, value.booleanValue, value.structuredValue].some((entry) => entry != null && entry !== "")).length],
        );
        return { id: submission.id, revision: submission.revision_number, status: "draft" };
      });
      return res.json({ data: result });
    } catch (error) {
      const codes = ["RESULT_CONTEXT_NOT_FOUND", "RESULT_NOT_EDITABLE", "SPECIMEN_NOT_ACCEPTED", "TEST_RESULT_SETUP_MISSING", "INVALID_ANALYTE", "INVALID_ANALYTE_VALUE", "INVALID_SELECT_VALUE"];
      if (codes.includes(error.code)) return res.status(error.code === "RESULT_CONTEXT_NOT_FOUND" ? 404 : 409).json({ error: error.code, message: error.message });
      return next(error);
    }
  });

  router.post("/requests/:requestId/submit-results", async (req, res, next) => {
    try {
      const result = await client.begin(async (tx) => {
        const [request] = await tx.unsafe(
          `select id, status, assigned_pathologist_id from public.test_requests
            where id = $1 and clinic_id = $2 and assigned_technologist_id = $3 for update`,
          [req.params.requestId, req.user.clinicId, req.user.sub],
        );
        if (!request) throw Object.assign(new Error("Request was not found in your work queue."), { code: "REQUEST_NOT_FOUND" });
        if (!["processing", "correction"].includes(request.status)) throw Object.assign(new Error("This request cannot be submitted in its current status."), { code: "INVALID_REQUEST_STATUS" });
        const [target] = await tx.unsafe(
          `select count(*)::integer as total from public.request_items ri
            where ri.request_id = $1 and ri.clinic_id = $2
              and (($3 = 'processing' and ri.status <> 'cancelled')
                or ($3 = 'correction' and ri.status in ('returned', 'for_recollection', 'drafted')))`,
          [request.id, req.user.clinicId, request.status],
        );
        const drafts = await tx.unsafe(
          `select ri.id as item_id, rs.id as submission_id, rs.revision_number
             from public.request_items ri
             join lateral (select id, status, revision_number from public.result_submissions rs
                           where rs.request_item_id = ri.id and rs.clinic_id = ri.clinic_id
                           order by revision_number desc limit 1) rs on rs.status = 'draft'
            where ri.request_id = $1 and ri.clinic_id = $2 and ri.status = 'drafted'`,
          [request.id, req.user.clinicId],
        );
        if (!drafts.length) throw Object.assign(new Error("Save at least one complete result draft before submitting."), { code: "NO_RESULT_DRAFTS" });
        if (drafts.length !== target.total) throw Object.assign(new Error("Complete every test in this request before submitting the results."), { code: "REQUEST_RESULTS_INCOMPLETE" });
        const completeness = await tx.unsafe(
          `select ri.id, count(a.id)::integer as required_count,
                  count(rv.id)::integer as entered_count,
                  count(rv.id) filter (where a.value_type = 'structured' and (
                    rv.structured_value is null or jsonb_array_length(rv.structured_value) = 0
                    or exists (select 1 from jsonb_array_elements(rv.structured_value) as rows(value)
                      where exists (select 1 from jsonb_array_elements_text(a.options) as columns(label)
                        where btrim(coalesce(rows.value ->> columns.label, '')) = ''))
                  ))::integer as incomplete_structured_count
             from public.request_items ri
             join public.test_analytes a on a.test_id = ri.test_id and a.clinic_id = ri.clinic_id and a.is_required = true
             left join lateral (select id from public.result_submissions rs
                                 where rs.request_item_id = ri.id and rs.clinic_id = ri.clinic_id
                                 order by revision_number desc limit 1) latest on true
             left join public.result_values rv on rv.result_submission_id = latest.id and rv.analyte_id = a.id and rv.clinic_id = ri.clinic_id
            where ri.request_id = $1 and ri.clinic_id = $2 and ri.status = 'drafted'
            group by ri.id having count(a.id) = 0 or count(a.id) <> count(rv.id)
              or count(rv.id) filter (where a.value_type = 'structured' and (
                rv.structured_value is null or jsonb_array_length(rv.structured_value) = 0
                or exists (select 1 from jsonb_array_elements(rv.structured_value) as rows(value)
                  where exists (select 1 from jsonb_array_elements_text(a.options) as columns(label)
                    where btrim(coalesce(rows.value ->> columns.label, '')) = ''))
              )) > 0`,
          [request.id, req.user.clinicId],
        );
        if (completeness.length) throw Object.assign(new Error("Complete every required result field for the drafted tests before submitting."), { code: "RESULTS_INCOMPLETE", details: completeness.map((row) => row.id) });
        let pathologistId = request.assigned_pathologist_id;
        if (pathologistId) {
          const [existing] = await tx.unsafe(`select id from public.users where id = $1 and clinic_id = $2 and role = 'pathologist' and is_active = true for update`, [pathologistId, req.user.clinicId]);
          if (!existing) pathologistId = null;
        }
        if (!pathologistId) {
          const [pathologist] = await tx.unsafe(
            `select u.id from public.users u
              where u.clinic_id = $1 and u.role = 'pathologist' and u.is_active = true
              order by (select count(*) from public.test_requests active
                         where active.clinic_id = u.clinic_id and active.assigned_pathologist_id = u.id
                           and active.status in ('for_validation', 'correction')) asc,
                       u.last_sign_in_at nulls first
              limit 1 for update of u skip locked`,
            [req.user.clinicId],
          );
          if (!pathologist) throw Object.assign(new Error("No active pathologist is available."), { code: "NO_PATHOLOGIST_AVAILABLE" });
          pathologistId = pathologist.id;
        }
        for (const draft of drafts) {
          await tx.unsafe(`update public.result_submissions set status = 'submitted', submitted_at = now(), updated_at = now() where id = $1 and clinic_id = $2`, [draft.submission_id, req.user.clinicId]);
          await tx.unsafe(`update public.request_items set status = 'submitted', updated_at = now() where id = $1 and clinic_id = $2`, [draft.item_id, req.user.clinicId]);
        }
        const oldStatus = request.status;
        await tx.unsafe(
          `update public.test_requests set status = 'for_validation', assigned_pathologist_id = $1, updated_at = now()
            where id = $2 and clinic_id = $3`,
          [pathologistId, request.id, req.user.clinicId],
        );
        await tx.unsafe(
          `insert into public.request_status_history (clinic_id, request_id, old_status, new_status, changed_by)
           values ($1, $2, $3, 'for_validation', $4)`,
          [req.user.clinicId, request.id, oldStatus, req.user.sub],
        );
        await tx.unsafe(
          `insert into public.audit_logs (clinic_id, actor_user_id, action, entity_type, entity_id, details)
           values ($1, $2, 'results.submitted', 'test_request', $3, jsonb_build_object('testCount', $4::integer, 'pathologistId', $5::uuid))`,
          [req.user.clinicId, req.user.sub, request.id, drafts.length, pathologistId],
        );
        return { requestId: request.id, submittedTestCount: drafts.length, assignedPathologistId: pathologistId };
      });
      return res.json({ data: result });
    } catch (error) {
      const codes = ["REQUEST_NOT_FOUND", "INVALID_REQUEST_STATUS", "NO_RESULT_DRAFTS", "RESULTS_INCOMPLETE", "REQUEST_RESULTS_INCOMPLETE", "NO_PATHOLOGIST_AVAILABLE"];
      if (codes.includes(error.code)) return res.status(error.code === "REQUEST_NOT_FOUND" ? 404 : 409).json({ error: error.code, message: error.message, details: error.details });
      return next(error);
    }
  });

  return router;
}
