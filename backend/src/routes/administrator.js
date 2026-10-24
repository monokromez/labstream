import { Router } from "express";
import { allowRoles, createRequireAuth, requirePasswordSetupComplete, requireSameOrigin } from "../auth/middleware.js";

export function createAdministratorRouter({ client, publishCatalogChanged }) {
  const router = Router();
  router.use(createRequireAuth(client), requirePasswordSetupComplete, requireSameOrigin, allowRoles("administrator"));

  router.get("/dashboard/summary", async (req, res, next) => {
    try {
      const [requestCounts] = await client.unsafe(
        `select count(*)::integer as total_requests,
                count(*) filter (where status = 'awaiting_payment')::integer as awaiting_payment,
                count(*) filter (where status in ('paid','specimen_collection','processing'))::integer as in_progress,
                count(*) filter (where status = 'for_validation')::integer as for_validation,
                count(*) filter (where status = 'correction')::integer as correction,
                count(*) filter (where status = 'released')::integer as released
           from public.test_requests where clinic_id = $1 and requested_at >= date_trunc('month', now())`,
        [req.user.clinicId],
      );
      const [testCounts] = await client.unsafe(
        `select count(*)::integer as released_tests
           from public.request_items ri join public.test_requests r on r.id = ri.request_id and r.clinic_id = ri.clinic_id
          where r.clinic_id = $1 and r.status = 'released' and r.released_at >= date_trunc('month', now())`,
        [req.user.clinicId],
      );
      return res.json({ data: { period: "month_to_date", requests: requestCounts, releasedTests: testCounts.released_tests } });
    } catch (error) {
      return next(error);
    }
  });

  router.get("/dashboard/test-volume", async (req, res, next) => {
    try {
      const period = String(req.query.period ?? "weekly");
      if (!["weekly", "monthly", "annual"].includes(period)) return res.status(400).json({ error: "INVALID_PERIOD" });
      const bucketExpr = period === "annual" ? "date_trunc('month', r.released_at)" : "date_trunc('day', r.released_at)";
      const startExpr = period === "weekly" ? "date_trunc('day', now()) - interval '6 days'"
        : period === "monthly" ? "date_trunc('month', now())" : "date_trunc('year', now())";
      const step = period === "annual" ? "1 month" : "1 day";
      const bucketStart = period === "annual" ? "date_trunc('month', now())" : "date_trunc('day', now())";
      const endStep = period === "annual" ? "1 month" : "1 day";
      const [range] = await client.unsafe(
        `select ${startExpr} as starts_at, ${bucketStart} as ends_at,
                ${bucketStart} + interval '${endStep}' as exclusive_ends_at`,
      );
      const buckets = await client.unsafe(
        `select generate_series($1::timestamp, $2::timestamp, $3::interval) as bucket`,
        [range.starts_at, range.ends_at, step],
      );
      const categories = await client.unsafe(
        `select id, name from public.test_categories where clinic_id = $1 and is_active = true order by name`,
        [req.user.clinicId],
      );
      const totals = await client.unsafe(
        `select ${bucketExpr} as bucket, c.id as category_id, count(ri.id)::integer as total
           from public.test_requests r
           join public.request_items ri on ri.request_id = r.id and ri.clinic_id = r.clinic_id
           join public.test_catalog t on t.id = ri.test_id and t.clinic_id = ri.clinic_id
           join public.test_categories c on c.id = t.category_id and c.clinic_id = t.clinic_id
          where r.clinic_id = $1 and r.status = 'released' and r.released_at >= $2 and r.released_at < $3
          group by bucket, c.id`,
        [req.user.clinicId, range.starts_at, range.exclusive_ends_at],
      );
      const countByKey = new Map(totals.map((row) => [`${new Date(row.bucket).toISOString().slice(0, 10)}:${row.category_id}`, row.total]));
      const chartBuckets = buckets.map(({ bucket }) => ({ value: new Date(bucket).toISOString().slice(0, 10), label: period === "annual" ? new Date(bucket).toLocaleString("en", { month: "short" }) : new Date(bucket).toLocaleString("en", { weekday: "short" }) }));
      const series = categories.map((category) => ({
        id: category.id,
        label: category.name,
        values: chartBuckets.map((bucket) => countByKey.get(`${bucket.value}:${category.id}`) ?? 0),
      }));
      return res.json({ data: { period, total: series.reduce((sum, item) => sum + item.values.reduce((a, b) => a + b, 0), 0), buckets: chartBuckets, series } });
    } catch (error) {
      return next(error);
    }
  });

  router.get("/audit-logs", async (req, res, next) => {
    try {
      const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
      const pageSize = Math.min(100, Math.max(1, Number.parseInt(req.query.pageSize, 10) || 10));
      const offset = (page - 1) * pageSize;
      const role = String(req.query.role ?? "");
      const action = String(req.query.action ?? "");
      const [count] = await client.unsafe(
        `select count(*)::integer as total from public.audit_logs a
          left join public.users u on u.id = a.actor_user_id and u.clinic_id = a.clinic_id
         where a.clinic_id = $1 and ($2 = '' or u.role::text = $2) and ($3 = '' or a.action = $3)`,
        [req.user.clinicId, role, action],
      );
      const data = await client.unsafe(
        `select a.id, a.action, a.entity_type, a.entity_id, a.details, a.created_at,
                u.role, coalesce(u.username, 'System') as actor
           from public.audit_logs a
           left join public.users u on u.id = a.actor_user_id and u.clinic_id = a.clinic_id
          where a.clinic_id = $1 and ($2 = '' or u.role::text = $2) and ($3 = '' or a.action = $3)
          order by a.created_at desc limit $4 offset $5`,
        [req.user.clinicId, role, action, pageSize, offset],
      );
      return res.json({ data, pagination: { page, pageSize, total: count.total, totalPages: Math.ceil(count.total / pageSize) } });
    } catch (error) {
      return next(error);
    }
  });

  router.get("/catalog", async (req, res, next) => {
    try {
      const categories = await client.unsafe(
        `select c.id, c.name, c.description, c.is_active,
                count(t.id)::integer as test_count
           from public.test_categories c left join public.test_catalog t on t.category_id = c.id and t.clinic_id = c.clinic_id
          where c.clinic_id = $1 group by c.id order by c.name`,
        [req.user.clinicId],
      );
      const tests = await client.unsafe(
        `select t.id, t.code, t.name, t.description, t.category_id, c.name as category_name,
                t.price, t.turnaround_minutes, t.is_available,
                (select count(*)::integer from public.test_analytes a where a.test_id = t.id and a.clinic_id = t.clinic_id) as analyte_count,
                (select count(*)::integer from public.test_specimen_requirements sr where sr.test_id = t.id and sr.clinic_id = t.clinic_id and sr.is_required = true) as specimen_requirement_count
           from public.test_catalog t join public.test_categories c on c.id = t.category_id and c.clinic_id = t.clinic_id
          where t.clinic_id = $1 and ($2 = '' or t.name ilike '%' || $2 || '%') and ($3::uuid is null or t.category_id = $3)
          order by t.name`,
        [req.user.clinicId, String(req.query.q ?? "").trim(), req.query.categoryId || null],
      );
      return res.json({ data: { categories, tests } });
    } catch (error) {
      return next(error);
    }
  });

  router.post("/categories", async (req, res, next) => {
    try {
      const name = String(req.body?.name ?? "").trim();
      if (!name) return res.status(400).json({ error: "CATEGORY_NAME_REQUIRED" });
      const [data] = await client.unsafe(
        `insert into public.test_categories (clinic_id, name, description)
         values ($1, $2, $3) returning id, name, description, is_active`,
        [req.user.clinicId, name, String(req.body?.description ?? "").trim() || null],
      );
      await client.unsafe(
        `insert into public.audit_logs (clinic_id, actor_user_id, action, entity_type, entity_id)
         values ($1, $2, 'catalog.category_created', 'test_category', $3)`,
        [req.user.clinicId, req.user.sub, data.id],
      );
      publishCatalogChanged?.(req.user.clinicId);
      return res.status(201).json({ data });
    } catch (error) {
      if (error.code === "23505") return res.status(409).json({ error: "CATEGORY_EXISTS" });
      return next(error);
    }
  });

  router.post("/tests", async (req, res, next) => {
    try {
      const body = req.body ?? {};
      const name = String(body.name ?? "").trim();
      const categoryId = String(body.categoryId ?? "");
      const price = Number(body.price);
      const turnaround = body.turnaroundMinutes == null || body.turnaroundMinutes === "" ? null : Number(body.turnaroundMinutes);
      const specimens = Array.isArray(body.specimens) ? body.specimens : [];
      const analytes = Array.isArray(body.analytes) ? body.analytes : [];
      if (!name || !categoryId || !Number.isFinite(price) || price < 0 || (turnaround != null && (!Number.isInteger(turnaround) || turnaround <= 0))) {
        return res.status(400).json({ error: "INVALID_TEST_DETAILS" });
      }
      if (specimens.length === 0 || analytes.length === 0) return res.status(400).json({ error: "TEST_WORKFLOW_CONFIGURATION_REQUIRED", message: "Add at least one required specimen type and one result analyte before making this test available." });
      const code = String(body.code ?? name.normalize("NFKD").replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-|-$/g, "").toUpperCase().slice(0, 40)).trim();
      const result = await client.begin(async (tx) => {
        const [category] = await tx.unsafe(`select id from public.test_categories where id = $1 and clinic_id = $2 and is_active = true`, [categoryId, req.user.clinicId]);
        if (!category) throw Object.assign(new Error("Choose an active category in this clinic."), { code: "INVALID_CATEGORY" });
        const [test] = await tx.unsafe(
          `insert into public.test_catalog (clinic_id, category_id, code, name, description, price, turnaround_minutes, is_available)
           values ($1,$2,$3,$4,$5,$6,$7,$8) returning id, code, name, category_id, price, turnaround_minutes, is_available`,
          [req.user.clinicId, categoryId, code, name, String(body.description ?? "").trim() || null, price, turnaround, body.isAvailable !== false],
        );
        for (const specimen of specimens) {
          const specimenType = String(specimen.specimenType ?? "").trim();
          if (!specimenType) throw Object.assign(new Error("Every specimen requirement needs a type."), { code: "INVALID_SPECIMEN_REQUIREMENT" });
          await tx.unsafe(
            `insert into public.test_specimen_requirements (clinic_id, test_id, specimen_type, collection_instructions, minimum_quantity, quantity_unit)
             values ($1,$2,$3,$4,$5,$6)`,
            [req.user.clinicId, test.id, specimenType, specimen.collectionInstructions || null, specimen.minimumQuantity ?? null, specimen.quantityUnit || null],
          );
        }
        for (const [index, analyte] of analytes.entries()) {
          const key = String(analyte.key ?? `ANALYTE_${index + 1}`).trim();
          const label = String(analyte.label ?? "").trim();
          const valueType = String(analyte.valueType ?? "");
          const options = Array.isArray(analyte.options) ? analyte.options : [];
          if (!label || !["numeric", "text", "select", "boolean"].includes(valueType) || (valueType === "select" && !options.length)) {
            throw Object.assign(new Error("Each analyte needs a label, supported value type, and select options when applicable."), { code: "INVALID_ANALYTE_CONFIGURATION" });
          }
          await tx.unsafe(
            `insert into public.test_analytes (clinic_id, test_id, key, label, value_type, options, unit, sort_order, is_required)
             values ($1,$2,$3,$4,$5::public.result_value_type,$6::jsonb,$7,$8,$9)`,
            [req.user.clinicId, test.id, key, label, valueType, JSON.stringify(options), analyte.unit || null, index, analyte.isRequired !== false],
          );
        }
        await tx.unsafe(
          `insert into public.audit_logs (clinic_id, actor_user_id, action, entity_type, entity_id, details)
           values ($1,$2,'catalog.test_created','test_catalog',$3,jsonb_build_object('code',$4::text,'name',$5::text))`,
          [req.user.clinicId, req.user.sub, test.id, test.code, test.name],
        );
        return test;
      });
      publishCatalogChanged?.(req.user.clinicId);
      return res.status(201).json({ data: result });
    } catch (error) {
      if (error.code === "INVALID_CATEGORY" || error.code?.startsWith("INVALID_")) return res.status(400).json({ error: error.code, message: error.message });
      if (error.code === "23505") return res.status(409).json({ error: "TEST_CODE_EXISTS" });
      return next(error);
    }
  });

  router.patch("/tests/:id", async (req, res, next) => {
    try {
      const body = req.body ?? {};
      const result = await client.begin(async (tx) => {
        const [current] = await tx.unsafe(`select id, category_id, is_available from public.test_catalog where id = $1 and clinic_id = $2 for update`, [req.params.id, req.user.clinicId]);
        if (!current) throw Object.assign(new Error("Test was not found."), { code: "TEST_NOT_FOUND" });
        const categoryId = body.categoryId ?? current.category_id;
        const [category] = await tx.unsafe(`select id from public.test_categories where id = $1 and clinic_id = $2 and is_active = true`, [categoryId, req.user.clinicId]);
        if (!category) throw Object.assign(new Error("Choose an active category."), { code: "INVALID_CATEGORY" });
        if (body.isAvailable === true) {
          const [setup] = await tx.unsafe(
            `select exists(select 1 from public.test_analytes where test_id = $1 and clinic_id = $2) as has_analytes,
                    exists(select 1 from public.test_specimen_requirements where test_id = $1 and clinic_id = $2 and is_required = true) as has_specimens`,
            [current.id, req.user.clinicId],
          );
          if (!setup.has_analytes || !setup.has_specimens) throw Object.assign(new Error("Configure analytes and required specimens before making this test available."), { code: "TEST_WORKFLOW_CONFIGURATION_REQUIRED" });
        }
        const [updated] = await tx.unsafe(
          `update public.test_catalog set category_id = $1, name = coalesce($2,name), description = coalesce($3,description),
                  price = coalesce($4,price), turnaround_minutes = coalesce($5,turnaround_minutes), is_available = coalesce($6,is_available), updated_at = now()
            where id = $7 and clinic_id = $8 returning id, code, name, category_id, price, turnaround_minutes, is_available`,
          [categoryId, body.name?.trim() || null, body.description ?? null, body.price == null ? null : Number(body.price), body.turnaroundMinutes == null ? null : Number(body.turnaroundMinutes), body.isAvailable ?? null, current.id, req.user.clinicId],
        );
        await tx.unsafe(`insert into public.audit_logs (clinic_id, actor_user_id, action, entity_type, entity_id) values ($1,$2,'catalog.test_updated','test_catalog',$3)`, [req.user.clinicId, req.user.sub, current.id]);
        return updated;
      });
      publishCatalogChanged?.(req.user.clinicId);
      return res.json({ data: result });
    } catch (error) {
      if (error.code === "TEST_NOT_FOUND" || error.code === "INVALID_CATEGORY" || error.code === "TEST_WORKFLOW_CONFIGURATION_REQUIRED") return res.status(error.code === "TEST_NOT_FOUND" ? 404 : 409).json({ error: error.code, message: error.message });
      return next(error);
    }
  });

  router.delete("/categories/:id", async (req, res, next) => {
    try {
      const actions = Array.isArray(req.body?.testActions) ? req.body.testActions : [];
      const result = await client.begin(async (tx) => {
        const [category] = await tx.unsafe(`select id from public.test_categories where id = $1 and clinic_id = $2 for update`, [req.params.id, req.user.clinicId]);
        if (!category) throw Object.assign(new Error("Category was not found."), { code: "CATEGORY_NOT_FOUND" });
        const tests = await tx.unsafe(`select id, name from public.test_catalog where category_id = $1 and clinic_id = $2 for update`, [category.id, req.user.clinicId]);
        if (tests.length !== actions.length || tests.some((test) => !actions.some((action) => action.testId === test.id && ["relocate", "remove"].includes(action.action)))) {
          throw Object.assign(new Error("Choose relocate or remove for each test in this category."), { code: "CATEGORY_ACTIONS_INCOMPLETE" });
        }
        for (const action of actions) {
          if (action.action === "relocate") {
            const [target] = await tx.unsafe(`select id from public.test_categories where id = $1 and clinic_id = $2 and is_active = true and id <> $3`, [action.categoryId, req.user.clinicId, category.id]);
            if (!target) throw Object.assign(new Error("Choose another active category in this clinic."), { code: "INVALID_TARGET_CATEGORY" });
            await tx.unsafe(`update public.test_catalog set category_id = $1, updated_at = now() where id = $2 and clinic_id = $3`, [target.id, action.testId, req.user.clinicId]);
          } else {
            // Historical request snapshots retain the old test; catalog entry is deactivated.
            await tx.unsafe(`update public.test_catalog set is_available = false, updated_at = now() where id = $1 and clinic_id = $2`, [action.testId, req.user.clinicId]);
          }
        }
        await tx.unsafe(`update public.test_categories set is_active = false, updated_at = now() where id = $1 and clinic_id = $2`, [category.id, req.user.clinicId]);
        await tx.unsafe(`insert into public.audit_logs (clinic_id, actor_user_id, action, entity_type, entity_id, details) values ($1,$2,'catalog.category_removed','test_category',$3,jsonb_build_object('testCount',$4::integer))`, [req.user.clinicId, req.user.sub, category.id, tests.length]);
        return { categoryId: category.id, affectedTests: tests.length };
      });
      publishCatalogChanged?.(req.user.clinicId);
      return res.json({ data: result });
    } catch (error) {
      if (["CATEGORY_NOT_FOUND", "CATEGORY_ACTIONS_INCOMPLETE", "INVALID_TARGET_CATEGORY"].includes(error.code)) return res.status(error.code === "CATEGORY_NOT_FOUND" ? 404 : 409).json({ error: error.code, message: error.message });
      return next(error);
    }
  });

  router.delete("/tests/:id", async (req, res, next) => {
    try {
      const [data] = await client.unsafe(
        `update public.test_catalog set is_available = false, updated_at = now()
          where id = $1 and clinic_id = $2 and is_available = true returning id, name`,
        [req.params.id, req.user.clinicId],
      );
      if (!data) return res.status(404).json({ error: "TEST_NOT_FOUND_OR_UNAVAILABLE" });
      await client.unsafe(
        `insert into public.audit_logs (clinic_id, actor_user_id, action, entity_type, entity_id, details)
         values ($1,$2,'catalog.test_deactivated','test_catalog',$3,jsonb_build_object('name',$4::text))`,
        [req.user.clinicId, req.user.sub, data.id, data.name],
      );
      publishCatalogChanged?.(req.user.clinicId);
      return res.json({ data: { id: data.id, isAvailable: false } });
    } catch (error) {
      return next(error);
    }
  });

  router.get("/reference-ranges", async (req, res, next) => {
    try {
      const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
      const pageSize = Math.min(100, Math.max(1, Number.parseInt(req.query.pageSize, 10) || 10));
      const offset = (page - 1) * pageSize;
      const query = String(req.query.q ?? "").trim();
      const sex = String(req.query.sex ?? "");
      const [count] = await client.unsafe(
        `select count(*)::integer as total from public.reference_ranges rr
          join public.test_analytes a on a.id = rr.analyte_id and a.clinic_id = rr.clinic_id
          join public.test_catalog t on t.id = a.test_id and t.clinic_id = a.clinic_id
         where rr.clinic_id = $1 and rr.is_active = true and ($2 = '' or t.name ilike '%' || $2 || '%') and ($3 = '' or rr.sex = $3)`,
        [req.user.clinicId, query, sex],
      );
      const data = await client.unsafe(
        `select rr.id, t.id as test_id, t.name as test_name, a.id as analyte_id, a.label as analyte,
                rr.sex, rr.min_age_days, rr.max_age_days, rr.lower_limit, rr.upper_limit, rr.unit, rr.guidance
           from public.reference_ranges rr
           join public.test_analytes a on a.id = rr.analyte_id and a.clinic_id = rr.clinic_id
           join public.test_catalog t on t.id = a.test_id and t.clinic_id = a.clinic_id
          where rr.clinic_id = $1 and rr.is_active = true and ($2 = '' or t.name ilike '%' || $2 || '%') and ($3 = '' or rr.sex = $3)
          order by t.name, a.sort_order, rr.sex limit $4 offset $5`,
        [req.user.clinicId, query, sex, pageSize, offset],
      );
      return res.json({ data, pagination: { page, pageSize, total: count.total, totalPages: Math.ceil(count.total / pageSize) } });
    } catch (error) {
      return next(error);
    }
  });

  router.post("/reference-ranges", async (req, res, next) => {
    try {
      const body = req.body ?? {};
      if (!body.analyteId || (!body.sex && body.sex !== null)) return res.status(400).json({ error: "INVALID_REFERENCE_RANGE" });
      const [analyte] = await client.unsafe(`select id from public.test_analytes where id = $1 and clinic_id = $2`, [body.analyteId, req.user.clinicId]);
      if (!analyte) return res.status(404).json({ error: "ANALYTE_NOT_FOUND" });
      const [data] = await client.unsafe(
        `insert into public.reference_ranges
          (clinic_id, analyte_id, sex, min_age_days, max_age_days, lower_limit, upper_limit, unit, guidance)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9)
         returning id, analyte_id, sex, min_age_days, max_age_days, lower_limit, upper_limit, unit, guidance`,
        [req.user.clinicId, body.analyteId, body.sex || null, body.minAgeDays ?? null, body.maxAgeDays ?? null,
          body.lowerLimit ?? null, body.upperLimit ?? null, body.unit || null, body.guidance || null],
      );
      await client.unsafe(`insert into public.audit_logs (clinic_id, actor_user_id, action, entity_type, entity_id) values ($1,$2,'reference_range.created','reference_range',$3)`, [req.user.clinicId, req.user.sub, data.id]);
      return res.status(201).json({ data });
    } catch (error) {
      if (error.code === "23514") return res.status(400).json({ error: "INVALID_REFERENCE_RANGE", message: "Age and numeric limits must be in ascending order." });
      return next(error);
    }
  });

  router.patch("/reference-ranges/:id", async (req, res, next) => {
    try {
      const body = req.body ?? {};
      const [data] = await client.unsafe(
        `update public.reference_ranges set sex = coalesce($1,sex), min_age_days = coalesce($2,min_age_days),
                max_age_days = coalesce($3,max_age_days), lower_limit = coalesce($4,lower_limit),
                upper_limit = coalesce($5,upper_limit), unit = coalesce($6,unit), guidance = coalesce($7,guidance), updated_at = now()
          where id = $8 and clinic_id = $9 and is_active = true
          returning id, analyte_id, sex, min_age_days, max_age_days, lower_limit, upper_limit, unit, guidance`,
        [body.sex ?? null, body.minAgeDays ?? null, body.maxAgeDays ?? null, body.lowerLimit ?? null,
          body.upperLimit ?? null, body.unit ?? null, body.guidance ?? null, req.params.id, req.user.clinicId],
      );
      if (!data) return res.status(404).json({ error: "REFERENCE_RANGE_NOT_FOUND" });
      await client.unsafe(`insert into public.audit_logs (clinic_id, actor_user_id, action, entity_type, entity_id) values ($1,$2,'reference_range.updated','reference_range',$3)`, [req.user.clinicId, req.user.sub, data.id]);
      return res.json({ data });
    } catch (error) {
      if (error.code === "23514") return res.status(400).json({ error: "INVALID_REFERENCE_RANGE" });
      return next(error);
    }
  });

  router.delete("/reference-ranges/:id", async (req, res, next) => {
    try {
      const [data] = await client.unsafe(`update public.reference_ranges set is_active = false, updated_at = now() where id = $1 and clinic_id = $2 and is_active = true returning id`, [req.params.id, req.user.clinicId]);
      if (!data) return res.status(404).json({ error: "REFERENCE_RANGE_NOT_FOUND" });
      await client.unsafe(`insert into public.audit_logs (clinic_id, actor_user_id, action, entity_type, entity_id) values ($1,$2,'reference_range.deactivated','reference_range',$3)`, [req.user.clinicId, req.user.sub, data.id]);
      return res.status(204).end();
    } catch (error) {
      return next(error);
    }
  });

  return router;
}
