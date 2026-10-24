import { Router } from "express";
import { allowRoles, createRequireAuth, requirePasswordSetupComplete, requireSameOrigin } from "../auth/middleware.js";

export function createApiRouter({ client }) {
  const router = Router();
  router.use(createRequireAuth(client), requirePasswordSetupComplete, requireSameOrigin);

  router.get("/catalog", allowRoles("administrator", "cashier", "medical_technologist", "pathologist"), async (req, res, next) => {
    try {
      const includeUnavailable = req.user.role === "administrator" && req.query.includeUnavailable === "true";
      const tests = await client.unsafe(
        `select t.id, t.code, t.name, t.description, t.category_id,
                c.name as category_name, t.price, t.turnaround_minutes,
                t.is_available,
                coalesce((select jsonb_agg(jsonb_build_object(
                  'id', a.id, 'key', a.key, 'label', a.label, 'valueType', a.value_type,
                  'options', a.options, 'unit', a.unit, 'isRequired', a.is_required,
                  'lowerLimit', rr.lower_limit, 'upperLimit', rr.upper_limit, 'referenceUnit', rr.unit
                ) order by a.sort_order, a.label)
                  from public.test_analytes a left join lateral (
                    select r.lower_limit, r.upper_limit, r.unit from public.reference_ranges r
                     where r.analyte_id = a.id and r.clinic_id = a.clinic_id and r.is_active = true
                     order by r.sex nulls first, r.min_age_days nulls first limit 1
                  ) rr on true where a.test_id = t.id and a.clinic_id = t.clinic_id), '[]'::jsonb) as analytes,
                coalesce((select jsonb_agg(jsonb_build_object(
                  'specimenType', sr.specimen_type, 'collectionInstructions', sr.collection_instructions,
                  'isRequired', sr.is_required
                ) order by sr.specimen_type) from public.test_specimen_requirements sr
                  where sr.test_id = t.id and sr.clinic_id = t.clinic_id), '[]'::jsonb) as specimens
           from public.test_catalog t
           join public.test_categories c
             on c.id = t.category_id and c.clinic_id = t.clinic_id
          where t.clinic_id = $1 and c.is_active = true
            and ($2::boolean or t.is_available = true)
          order by c.name, t.name`,
        [req.user.clinicId, includeUnavailable],
      );
      const categories = await client.unsafe(
        `select id, name, description
           from public.test_categories
          where clinic_id = $1 and is_active = true
          order by name`,
        [req.user.clinicId],
      );
      return res.json({ data: { categories, tests } });
    } catch (error) {
      return next(error);
    }
  });

  router.get("/patients", allowRoles("administrator", "cashier", "patient"), async (req, res, next) => {
    try {
      const patientScope = req.user.role === "patient";
      const branchScope = req.user.branchId;
      const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
      const pageSize = Math.min(100, Math.max(1, Number.parseInt(req.query.pageSize, 10) || 10));
      const offset = (page - 1) * pageSize;
      const query = String(req.query.q ?? "").trim();
      const [count] = await client.unsafe(
        `select count(*)::integer as total
           from public.patients p
          where p.clinic_id = $1
            and ($2::uuid is null or p.branch_id = $2)
            and ($3::boolean = false or p.portal_user_id = $4)
            and ($5 = '' or p.pid ilike '%' || $5 || '%'
              or p.first_name ilike '%' || $5 || '%'
              or p.middle_name ilike '%' || $5 || '%'
              or p.last_name ilike '%' || $5 || '%'
              or p.phone ilike '%' || $5 || '%')`,
        [req.user.clinicId, branchScope, patientScope, req.user.sub, query],
      );
      const patients = await client.unsafe(
        `select p.id, p.pid, p.first_name, p.middle_name, p.last_name,
                p.date_of_birth, p.sex, p.email, p.phone, p.country, p.city,
                p.house_number, p.street, p.valid_id_type, p.valid_id_number,
                p.created_at,
                exists(select 1 from public.test_requests active_request
                  where active_request.patient_id = p.id and active_request.clinic_id = p.clinic_id
                    and active_request.status = 'awaiting_payment') as has_pending_request,
                coalesce((select max(r.requested_at) from public.test_requests r
                  where r.patient_id = p.id and r.clinic_id = p.clinic_id
                    and r.status <> 'cancelled'), p.created_at) as previous_visit
           from public.patients p
          where p.clinic_id = $1
            and ($2::uuid is null or p.branch_id = $2)
            and ($3::boolean = false or p.portal_user_id = $4)
            and ($5 = '' or p.pid ilike '%' || $5 || '%'
              or p.first_name ilike '%' || $5 || '%'
              or p.middle_name ilike '%' || $5 || '%'
              or p.last_name ilike '%' || $5 || '%'
              or p.phone ilike '%' || $5 || '%')
          order by p.last_name, p.first_name
          limit $6 offset $7`,
        [req.user.clinicId, branchScope, patientScope, req.user.sub, query, pageSize, offset],
      );
      return res.json({
        data: patients,
        pagination: { page, pageSize, total: count.total, totalPages: Math.ceil(count.total / pageSize) },
      });
    } catch (error) {
      return next(error);
    }
  });

  // These workflow resources are added incrementally; unknown routes remain a
  // clear 404 instead of silently serving prototype/localStorage records.
  return router;
}
