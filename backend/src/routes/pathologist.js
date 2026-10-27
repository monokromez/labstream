import { Router } from "express";
import { allowRoles, createRequireAuth, requirePasswordSetupComplete, requireSameOrigin } from "../auth/middleware.js";
import { emailService } from "../email.js";

export function createPathologistRouter({ client }) {
  const router = Router();
  router.use(createRequireAuth(client), requirePasswordSetupComplete, requireSameOrigin, allowRoles("pathologist"));

  async function requestList(req, statuses) {
    const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
    const pageSize = Math.min(100, Math.max(1, Number.parseInt(req.query.pageSize, 10) || 10));
    const offset = (page - 1) * pageSize;
    const query = String(req.query.q ?? "").trim();
    const testId = String(req.query.testId ?? "");
    const priority = String(req.query.priority ?? "");
    const [count] = await client.unsafe(
      `select count(distinct r.id)::integer as total
         from public.test_requests r join public.patients p on p.id = r.patient_id and p.clinic_id = r.clinic_id
         join public.request_items ri on ri.request_id = r.id and ri.clinic_id = r.clinic_id
        where r.clinic_id = $1 and r.assigned_pathologist_id = $2 and r.status = any($3::public.request_status[])
          and ($4 = '' or r.request_number ilike '%' || $4 || '%' or p.pid ilike '%' || $4 || '%'
            or p.first_name ilike '%' || $4 || '%' or p.last_name ilike '%' || $4 || '%')
          and ($5 = '' or ri.test_id::text = $5)
          and ($6 = '' or r.priority = $6)`,
      [req.user.clinicId, req.user.sub, statuses, query, testId, priority],
    );
    const requests = await client.unsafe(
      `select distinct r.id, r.request_number, r.status, r.priority, r.requested_at, r.paid_at, r.released_at,
              p.pid, concat_ws(' ', p.first_name, p.middle_name, p.last_name) as patient_name,
              coalesce(u.username, '—') as technologist
         from public.test_requests r join public.patients p on p.id = r.patient_id and p.clinic_id = r.clinic_id
         join public.request_items ri on ri.request_id = r.id and ri.clinic_id = r.clinic_id
         left join public.users u on u.id = r.assigned_technologist_id and u.clinic_id = r.clinic_id
        where r.clinic_id = $1 and r.assigned_pathologist_id = $2 and r.status = any($3::public.request_status[])
          and ($4 = '' or r.request_number ilike '%' || $4 || '%' or p.pid ilike '%' || $4 || '%'
            or p.first_name ilike '%' || $4 || '%' or p.last_name ilike '%' || $4 || '%')
          and ($5 = '' or ri.test_id::text = $5)
          and ($6 = '' or r.priority = $6)
        order by r.priority desc, r.requested_at limit $7 offset $8`,
      [req.user.clinicId, req.user.sub, statuses, query, testId, priority, pageSize, offset],
    );
    for (const request of requests) {
      request.tests = await client.unsafe(
        `select ri.id as request_item_id, ri.test_name_snapshot as test_name, ri.category_name_snapshot,
                ri.status as item_status, rs.id as submission_id, rs.revision_number, rs.status as result_status,
                rs.pathologist_interpretation, rs.updated_at as result_updated_at,
                (select rr.remarks from public.result_reviews rr
                  where rr.result_submission_id = rs.id and rr.clinic_id = rs.clinic_id
                  order by rr.reviewed_at desc limit 1) as review_remarks,
                coalesce((select jsonb_agg(jsonb_build_object(
                  'id', rv.id, 'analyteId', a.id, 'label', a.label, 'valueType', a.value_type,
                  'numericValue', rv.numeric_value, 'textValue', rv.text_value, 'selectValue', rv.select_value,
                  'booleanValue', rv.boolean_value, 'structuredValue', rv.structured_value, 'unit', rv.unit_snapshot,
                  'lowerLimit', rv.lower_limit_snapshot, 'upperLimit', rv.upper_limit_snapshot,
                  'isAbnormal', rv.is_abnormal) order by a.sort_order)
                  from public.result_values rv join public.test_analytes a on a.id = rv.analyte_id and a.clinic_id = rv.clinic_id
                 where rv.result_submission_id = rs.id), '[]'::jsonb) as values,
                coalesce((select jsonb_agg(jsonb_build_object('type', s.specimen_type, 'status', s.status, 'attempt', s.attempt_number))
                  from public.result_submission_specimens rss join public.specimens s
                    on s.id = rss.specimen_id and s.request_id = rss.request_id and s.clinic_id = rss.clinic_id
                 where rss.result_submission_id = rs.id), '[]'::jsonb) as specimens
           from public.request_items ri
           join lateral (select rs.* from public.result_submissions rs
                          where rs.request_item_id = ri.id and rs.clinic_id = ri.clinic_id
                          order by rs.revision_number desc limit 1) rs on true
          where ri.request_id = $1 and ri.clinic_id = $2
          order by ri.created_at`,
        [request.id, req.user.clinicId],
      );
      await client.unsafe(
        `insert into public.audit_logs (clinic_id, actor_user_id, action, entity_type, entity_id, details)
         values ($1, $2, 'results.accessed', 'test_request', $3,
           jsonb_build_object('requestNumber', $4::text, 'accessMethod', 'pathologist-review', 'requestStatus', $5::text))`,
        [req.user.clinicId, req.user.sub, request.id, request.request_number, request.status],
      );
    }
    return { data: requests, pagination: { page, pageSize, total: count.total, totalPages: Math.ceil(count.total / pageSize) } };
  }

  router.get("/pending", async (req, res, next) => {
    try {
      return res.json(await requestList(req, ["for_validation"]));
    } catch (error) {
      return next(error);
    }
  });

  router.get("/returned", async (req, res, next) => {
    try {
      return res.json(await requestList(req, ["correction"]));
    } catch (error) {
      return next(error);
    }
  });

  router.get("/released", async (req, res, next) => {
    try {
      return res.json(await requestList(req, ["released"]));
    } catch (error) {
      return next(error);
    }
  });

  router.post("/requests/:id/review", async (req, res, next) => {
    try {
      const decisions = req.body?.decisions;
      if (!Array.isArray(decisions) || decisions.length === 0 || decisions.length > 50) return res.status(400).json({ error: "INVALID_REVIEW" });
      const normalized = new Map();
      for (const decision of decisions) {
        const itemId = String(decision?.requestItemId ?? "");
        if (!itemId || normalized.has(itemId) || !["approved", "returned"].includes(decision.decision)) return res.status(400).json({ error: "INVALID_REVIEW_DECISION" });
        const interpretation = String(decision.interpretation ?? "").trim();
        const remarks = String(decision.remarks ?? "").trim();
        if (!interpretation || (decision.decision === "returned" && !remarks)) return res.status(400).json({ error: "INTERPRETATION_OR_REMARK_REQUIRED", message: "Provide an interpretation for every test and a remark for each returned result." });
        normalized.set(itemId, { ...decision, requestItemId: itemId, interpretation, remarks, requiresRetest: decision.decision === "returned" && Boolean(decision.requiresRetest) });
      }
      const outcome = await client.begin(async (tx) => {
        const [request] = await tx.unsafe(
          `select id, request_number, status from public.test_requests
            where id = $1 and clinic_id = $2 and assigned_pathologist_id = $3 for update`,
          [req.params.id, req.user.clinicId, req.user.sub],
        );
        if (!request) throw Object.assign(new Error("Request was not found in your assigned results."), { code: "REQUEST_NOT_FOUND" });
        if (request.status !== "for_validation") throw Object.assign(new Error("Only requests awaiting validation can be reviewed."), { code: "INVALID_REQUEST_STATUS" });
        const submissions = await tx.unsafe(
          `select ri.id as item_id, rs.id as submission_id, rs.specimen_id, ri.test_id, ri.configuration_version
             from public.request_items ri
             join lateral (select rs.* from public.result_submissions rs
                           where rs.request_item_id = ri.id and rs.clinic_id = ri.clinic_id
                           order by rs.revision_number desc limit 1) rs on rs.status = 'submitted'
            where ri.request_id = $1 and ri.clinic_id = $2 for update of ri`,
          [request.id, req.user.clinicId],
        );
        if (submissions.length !== normalized.size || submissions.some((s) => !normalized.has(s.item_id))) {
          throw Object.assign(new Error("Submit a decision for every test currently awaiting validation."), { code: "REVIEW_SET_INCOMPLETE" });
        }
        let returnedCount = 0;
        for (const submission of submissions) {
          const decision = normalized.get(submission.item_id);
          const resultStatus = decision.decision === "approved" ? "approved" : "returned";
          await tx.unsafe(
            `update public.result_submissions set status = $1::public.result_status, pathologist_interpretation = $2, updated_at = now()
              where id = $3 and clinic_id = $4`,
            [resultStatus, decision.interpretation, submission.submission_id, req.user.clinicId],
          );
          await tx.unsafe(
            `insert into public.result_reviews
              (clinic_id, result_submission_id, reviewed_by, decision, remarks, requires_retest)
             values ($1, $2, $3, $4::public.review_decision, $5, $6)`,
            [req.user.clinicId, submission.submission_id, req.user.sub, decision.decision, decision.remarks || null, decision.requiresRetest],
          );
          if (decision.decision === "approved") {
            await tx.unsafe(`update public.request_items set status = 'approved', updated_at = now() where id = $1 and clinic_id = $2`, [submission.item_id, req.user.clinicId]);
          } else {
            returnedCount += 1;
            if (decision.requiresRetest) {
              const requirements = await tx.unsafe(
                `select sr.specimen_type from public.test_specimen_requirements sr
                  where sr.test_id = $1 and sr.clinic_id = $2 and sr.configuration_version = $3
                    and sr.is_required = true order by sr.specimen_type`,
                [submission.test_id, req.user.clinicId, submission.configuration_version],
              );
              for (const requirement of requirements) {
                const [oldSpecimen] = await tx.unsafe(
                  `select s.id from public.result_submission_specimens rss
                    join public.specimens s on s.id = rss.specimen_id and s.request_id = rss.request_id and s.clinic_id = rss.clinic_id
                   where rss.result_submission_id = $1 and s.specimen_type = $2 order by s.attempt_number desc limit 1`,
                  [submission.submission_id, requirement.specimen_type],
                );
                const [replacement] = await tx.unsafe(
                  `insert into public.specimens (clinic_id, request_id, specimen_type, attempt_number, replaces_specimen_id, status, notes)
                   select $1, $2, $3, coalesce(max(attempt_number), 0) + 1, $4, 'for_recollection', $5
                     from public.specimens where clinic_id = $1 and request_id = $2 and specimen_type = $3
                   returning id`,
                  [req.user.clinicId, request.id, requirement.specimen_type, oldSpecimen?.id ?? null, `Retest requested by pathologist: ${decision.remarks}`],
                );
                await tx.unsafe(
                  `insert into public.specimen_request_items (clinic_id, request_id, specimen_id, request_item_id)
                   values ($1, $2, $3, $4) on conflict do nothing`,
                  [req.user.clinicId, request.id, replacement.id, submission.item_id],
                );
              }
              await tx.unsafe(`update public.request_items set status = 'for_recollection', updated_at = now() where id = $1 and clinic_id = $2`, [submission.item_id, req.user.clinicId]);
            } else {
              await tx.unsafe(`update public.request_items set status = 'returned', updated_at = now() where id = $1 and clinic_id = $2`, [submission.item_id, req.user.clinicId]);
            }
          }
        }
        if (returnedCount > 0) {
          await tx.unsafe(`update public.test_requests set status = 'correction', updated_at = now() where id = $1 and clinic_id = $2`, [request.id, req.user.clinicId]);
        } else {
          const [notApproved] = await tx.unsafe(
            `select count(*)::integer as total from public.request_items where request_id = $1 and clinic_id = $2 and status not in ('approved', 'released', 'cancelled')`,
            [request.id, req.user.clinicId],
          );
          if (notApproved.total === 0) {
            await tx.unsafe(`update public.test_requests set status = 'released', released_at = now(), updated_at = now() where id = $1 and clinic_id = $2`, [request.id, req.user.clinicId]);
            await tx.unsafe(`update public.request_items set status = 'released', updated_at = now() where request_id = $1 and clinic_id = $2 and status = 'approved'`, [request.id, req.user.clinicId]);
          } else {
            await tx.unsafe(`update public.test_requests set status = 'for_validation', updated_at = now() where id = $1 and clinic_id = $2`, [request.id, req.user.clinicId]);
          }
        }
        const [after] = await tx.unsafe(`select status from public.test_requests where id = $1 and clinic_id = $2`, [request.id, req.user.clinicId]);
        let releasedPatient = null;
        if (after.status === "released") {
          [releasedPatient] = await tx.unsafe(
            `select p.email, concat_ws(' ', p.first_name, p.middle_name, p.last_name) as name, c.name as clinic_name
               from public.test_requests r
               join public.patients p on p.id = r.patient_id and p.clinic_id = r.clinic_id
               join public.clinics c on c.id = r.clinic_id
              where r.id = $1 and r.clinic_id = $2`,
            [request.id, req.user.clinicId],
          );
        }
        await tx.unsafe(
          `insert into public.request_status_history (clinic_id, request_id, old_status, new_status, changed_by)
           values ($1, $2, $3, $4::public.request_status, $5)`,
          [req.user.clinicId, request.id, request.status, after.status, req.user.sub],
        );
        await tx.unsafe(
          `insert into public.audit_logs (clinic_id, actor_user_id, action, entity_type, entity_id, details)
           values ($1, $2, 'results.reviewed', 'test_request', $3, jsonb_build_object('approvedOrReturnedCount', $4::integer, 'finalStatus', $5::text))`,
          [req.user.clinicId, req.user.sub, request.id, submissions.length, after.status],
        );
        return {
          requestId: request.id,
          requestNumber: request.request_number,
          status: after.status,
          testCount: submissions.length,
          returnedCount,
          releasedPatient,
        };
      });
      let emailDelivery;
      if (outcome.status === "released") {
        emailDelivery = await emailService.sendResultsReleasedEmail({
          to: outcome.releasedPatient.email,
          name: outcome.releasedPatient.name,
          requestNumber: outcome.requestNumber,
          clinicName: outcome.releasedPatient.clinic_name,
          portalUrl: process.env.FRONTEND_ORIGIN || "http://localhost:5173",
        });
      }
      const { releasedPatient, ...data } = outcome;
      return res.json({ data, ...(emailDelivery ? { emailDelivery } : {}) });
    } catch (error) {
      if (["REQUEST_NOT_FOUND", "INVALID_REQUEST_STATUS", "REVIEW_SET_INCOMPLETE"].includes(error.code)) return res.status(error.code === "REQUEST_NOT_FOUND" ? 404 : 409).json({ error: error.code, message: error.message });
      return next(error);
    }
  });

  return router;
}
