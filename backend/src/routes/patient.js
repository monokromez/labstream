import { Router } from "express";
import { allowRoles, createRequireAuth, requirePasswordSetupComplete } from "../auth/middleware.js";

export function createPatientRouter({ client }) {
  const router = Router();
  router.use(createRequireAuth(client), requirePasswordSetupComplete, allowRoles("patient"));

  router.get("/results", async (req, res, next) => {
    try {
      const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
      const pageSize = Math.min(100, Math.max(1, Number.parseInt(req.query.pageSize, 10) || 10));
      const offset = (page - 1) * pageSize;
      const [patient] = await client.unsafe(`select id from public.patients where portal_user_id = $1 and clinic_id = $2`, [req.user.sub, req.user.clinicId]);
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
                    'selectValue', rv.select_value, 'booleanValue', rv.boolean_value,
                    'unit', rv.unit_snapshot, 'isAbnormal', rv.is_abnormal) order by a.sort_order)
                    from public.result_values rv join public.test_analytes a on a.id = rv.analyte_id and a.clinic_id = rv.clinic_id
                   where rv.result_submission_id = rs.id), '[]'::jsonb) as values
             from public.request_items ri
             join lateral (select rs.* from public.result_submissions rs
                            where rs.request_item_id = ri.id and rs.clinic_id = ri.clinic_id and rs.status = 'approved'
                            order by rs.revision_number desc limit 1) rs on true
            where ri.request_id = $1 and ri.clinic_id = $2 order by ri.created_at`,
          [request.id, req.user.clinicId],
        );
      }
      return res.json({ data, summary: testSummary, pagination: { page, pageSize, total: count.total, totalPages: Math.ceil(count.total / pageSize) } });
    } catch (error) {
      return next(error);
    }
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
