import { Router } from "express";
import ExcelJS from "exceljs";
import PDFDocument from "pdfkit";
import { allowRoles, createRequireAuth, requirePasswordSetupComplete, requireSameOrigin } from "../auth/middleware.js";
import { isUuid, validateCategoryDetails, validateReferenceRangeDetails, validateTestDetails } from "../adminValidation.js";

const REPORT_PERIODS = new Set(["weekly", "monthly", "annual"]);
const STAFF_ROLES = new Set(["administrator", "cashier", "medical_technologist", "pathologist", "patient"]);

function reportStartExpression(period) {
  return period === "weekly" ? "date_trunc('day', now()) - interval '6 days'"
    : period === "annual" ? "date_trunc('year', now())"
      : "date_trunc('month', now())";
}

function reportPeriodWord(period) {
  return period === "weekly" ? "week" : period === "annual" ? "year" : "month";
}

export function createAdministratorRouter({ client, publishCatalogChanged }) {
  const router = Router();
  router.use(createRequireAuth(client), requirePasswordSetupComplete, requireSameOrigin, allowRoles("administrator"));

  router.get("/reports/export", async (req, res, next) => {
    try {
      const format = String(req.query.format ?? "").toLowerCase();
      if (!["xlsx", "pdf"].includes(format)) return res.status(400).json({ error: "INVALID_REPORT_FORMAT", message: "Choose xlsx or pdf." });
      const period = String(req.query.period ?? "monthly").toLowerCase();
      if (!REPORT_PERIODS.has(period)) return res.status(400).json({ error: "INVALID_PERIOD", message: "Choose weekly, monthly, or annual." });
      const startExpression = reportStartExpression(period);
      const [range] = await client.unsafe(`select ${startExpression} as starts_at`);
      const [summary] = await client.unsafe(
        `select count(*) filter (where requested_at >= $2)::integer as requests,
                count(*) filter (where status = 'awaiting_payment' and requested_at >= $2)::integer as awaiting_payment,
                count(*) filter (where status in ('paid','specimen_collection','processing') and requested_at >= $2)::integer as in_progress,
                count(*) filter (where status = 'for_validation' and requested_at >= $2)::integer as for_validation,
                count(*) filter (where status = 'released' and released_at >= $2)::integer as released_requests
           from public.test_requests where clinic_id = $1`, [req.user.clinicId, range.starts_at]);
      const [financial] = await client.unsafe(
        `select coalesce(sum(amount), 0)::numeric as revenue from public.payments
          where clinic_id = $1 and voided_at is null and paid_at >= $2`, [req.user.clinicId, range.starts_at]);
      const categories = await client.unsafe(
        `with report_categories as (
           select name as category from public.test_categories where clinic_id = $1 and is_active = true
           union
           select distinct ri.category_name_snapshot from public.request_items ri
             join public.test_requests r on r.id = ri.request_id and r.clinic_id = ri.clinic_id
            where r.clinic_id = $1 and r.status = 'released' and r.released_at >= $2
         ), released_volume as (
           select ri.category_name_snapshot as category, count(*)::integer as tests
             from public.request_items ri join public.test_requests r on r.id = ri.request_id and r.clinic_id = ri.clinic_id
            where r.clinic_id = $1 and r.status = 'released' and r.released_at >= $2
            group by ri.category_name_snapshot
         )
         select c.category, coalesce(v.tests, 0)::integer as tests
           from report_categories c left join released_volume v using (category) order by c.category`,
        [req.user.clinicId, range.starts_at]);
      const periodLabel = period[0].toUpperCase() + period.slice(1);
      const rows = [
        ["Metric", "Value"],
        [`Requests this ${reportPeriodWord(period)}`, summary.requests], ["Awaiting payment", summary.awaiting_payment],
        ["In progress", summary.in_progress], ["Awaiting validation", summary.for_validation],
        ["Released requests", summary.released_requests], [`Revenue this ${reportPeriodWord(period)} (PHP)`, Number(financial.revenue)],
        [], ["Category", `Released tests this ${reportPeriodWord(period)}`], ...categories.map((row) => [row.category, row.tests]),
      ];
      await client.unsafe(
        `insert into public.audit_logs (clinic_id, actor_user_id, action, entity_type, details)
         values ($1, $2, 'report.exported', 'report', jsonb_build_object('format', $3::text, 'period', $4::text))`,
        [req.user.clinicId, req.user.sub, format, period]);
      const filename = `labstream-operations-report-${period}-${new Date().toISOString().slice(0, 10)}`;
      if (format === "xlsx") {
        const workbook = new ExcelJS.Workbook();
        const sheet = workbook.addWorksheet("Operations report");
        rows.forEach((row) => sheet.addRow(row));
        sheet.columns = [{ width: 34 }, { width: 26 }];
        sheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
        sheet.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF14564F" } };
        res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
        res.setHeader("Content-Disposition", `attachment; filename="${filename}.xlsx"`);
        await workbook.xlsx.write(res); return res.end();
      }
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `attachment; filename="${filename}.pdf"`);
      const pdf = new PDFDocument({ margin: 52, size: "A4" });
      pdf.pipe(res);
      pdf.fontSize(18).fillColor("#14564f").text("Labstream Operations Report");
      pdf.moveDown(0.3).fontSize(10).fillColor("#526d70").text(`${periodLabel} · Generated ${new Date().toLocaleString("en-PH")}`);
      pdf.moveDown(1);
      rows.forEach(([label, value]) => {
        if (!label && value == null) { pdf.moveDown(0.6); return; }
        pdf.fontSize(label === "Metric" || label === "Category" ? 11 : 10)
          .fillColor(label === "Metric" || label === "Category" ? "#14564f" : "#183f43")
          .text(`${label ?? ""}${value == null ? "" : `: ${value}`}`, { continued: false });
      });
      pdf.end();
    } catch (error) { return next(error); }
  });

  router.get("/dashboard/summary", async (req, res, next) => {
    try {
      const period = String(req.query.period ?? "monthly").toLowerCase();
      if (!REPORT_PERIODS.has(period)) return res.status(400).json({ error: "INVALID_PERIOD", message: "Choose weekly, monthly, or annual." });
      const [range] = await client.unsafe(`select ${reportStartExpression(period)} as starts_at`);
      const [requestCounts] = await client.unsafe(
        `select count(*)::integer as total_requests,
                count(*) filter (where status = 'awaiting_payment')::integer as awaiting_payment,
                count(*) filter (where status in ('paid','specimen_collection','processing'))::integer as in_progress,
                count(*) filter (where status = 'for_validation')::integer as for_validation,
                count(*) filter (where status = 'correction')::integer as correction,
                count(*) filter (where status = 'released')::integer as released
           from public.test_requests where clinic_id = $1 and requested_at >= $2`,
        [req.user.clinicId, range.starts_at],
      );
      const [testCounts] = await client.unsafe(
        `select count(*)::integer as released_tests
           from public.request_items ri join public.test_requests r on r.id = ri.request_id and r.clinic_id = ri.clinic_id
          where r.clinic_id = $1 and r.status = 'released' and r.released_at >= $2`,
        [req.user.clinicId, range.starts_at],
      );
      const [financials] = await client.unsafe(
        `select coalesce(sum(p.amount), 0)::numeric as total_revenue
           from public.payments p
          where p.clinic_id = $1 and p.voided_at is null and p.paid_at >= $2`,
        [req.user.clinicId, range.starts_at],
      );
      const [turnaround] = await client.unsafe(
        `select coalesce(round(avg(extract(epoch from (r.released_at - r.paid_at)) / 60)), 0)::integer as avg_tat_minutes
           from public.test_requests r
          where r.clinic_id = $1 and r.status = 'released' and r.released_at >= $2 and r.paid_at is not null`,
        [req.user.clinicId, range.starts_at],
      );
      return res.json({
        data: {
          period,
          requests: requestCounts,
          releasedTests: testCounts.released_tests,
          revenue: Number(financials.total_revenue || 0),
          averageTurnaroundMinutes: turnaround.avg_tat_minutes,
        },
      });
    } catch (error) {
      return next(error);
    }
  });

  router.get("/dashboard/test-volume", async (req, res, next) => {
    try {
      const period = String(req.query.period ?? "weekly");
      if (!["weekly", "monthly", "annual"].includes(period)) return res.status(400).json({ error: "INVALID_PERIOD" });
      const bucketExpr = period === "annual" ? "date_trunc('month', r.released_at)" : "date_trunc('day', r.released_at)";
      const startExpr = reportStartExpression(period);
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
        `select name from public.test_categories where clinic_id = $1 and is_active = true
         union
         select distinct ri.category_name_snapshot as name
           from public.request_items ri join public.test_requests r on r.id = ri.request_id and r.clinic_id = ri.clinic_id
          where r.clinic_id = $1 and r.status = 'released' and r.released_at >= $2 and r.released_at < $3
         order by name`,
        [req.user.clinicId, range.starts_at, range.exclusive_ends_at],
      );
      const totals = await client.unsafe(
        `select ${bucketExpr} as bucket, ri.category_name_snapshot as category_name, count(ri.id)::integer as total
           from public.test_requests r
           join public.request_items ri on ri.request_id = r.id and ri.clinic_id = r.clinic_id
          where r.clinic_id = $1 and r.status = 'released' and r.released_at >= $2 and r.released_at < $3
          group by bucket, ri.category_name_snapshot`,
        [req.user.clinicId, range.starts_at, range.exclusive_ends_at],
      );
      const countByKey = new Map(totals.map((row) => [`${new Date(row.bucket).toISOString().slice(0, 10)}:${row.category_name}`, row.total]));
      const chartBuckets = buckets.map(({ bucket }) => ({ value: new Date(bucket).toISOString().slice(0, 10), label: period === "annual" ? new Date(bucket).toLocaleString("en", { month: "short" }) : new Date(bucket).toLocaleString("en", { weekday: "short" }) }));
      const series = categories.map((category) => ({
        id: category.name,
        label: category.name,
        values: chartBuckets.map((bucket) => countByKey.get(`${bucket.value}:${category.name}`) ?? 0),
      }));
      return res.json({ data: { period, total: series.reduce((sum, item) => sum + item.values.reduce((a, b) => a + b, 0), 0), buckets: chartBuckets, series } });
    } catch (error) {
      return next(error);
    }
  });

  router.get("/audit-logs", async (req, res, next) => {
    try {
      const parsedPage = Number.parseInt(req.query.page, 10);
      const requestedPage = Number.isSafeInteger(parsedPage) && parsedPage > 0 ? parsedPage : 1;
      const pageSize = Math.min(100, Math.max(1, Number.parseInt(req.query.pageSize, 10) || 10));
      const role = String(req.query.role ?? "");
      const action = String(req.query.action ?? "");
      const query = String(req.query.q ?? "").trim();
      if (!STAFF_ROLES.has(role) && role !== "system" && role !== "") return res.status(400).json({ error: "INVALID_ROLE_FILTER" });
      if (action.length > 120 || query.length > 100) return res.status(400).json({ error: "INVALID_AUDIT_FILTER", message: "Audit filters are too long." });
      const actions = await client.unsafe(
        `select distinct action from public.audit_logs where clinic_id = $1 order by action`,
        [req.user.clinicId],
      );
      if (action && !actions.some(({ action: actionName }) => actionName === action)) {
        return res.status(400).json({ error: "INVALID_ACTION_FILTER", message: "Choose an available audit event." });
      }
      const [count] = await client.unsafe(
        `select count(*)::integer as total from public.audit_logs a
          left join public.users u on u.id = a.actor_user_id and u.clinic_id = a.clinic_id
         where a.clinic_id = $1 and ($2 = '' or ($2 = 'system' and a.actor_user_id is null) or u.role::text = $2)
           and ($3 = '' or a.action = $3)
           and ($4 = '' or coalesce(u.username, 'System') ilike '%' || $4 || '%'
             or a.action ilike '%' || $4 || '%' or a.entity_type ilike '%' || $4 || '%'
             or coalesce(a.entity_id::text, '') ilike '%' || $4 || '%'
             or coalesce(a.details::text, '') ilike '%' || $4 || '%')`,
        [req.user.clinicId, role, action, query],
      );
      const totalPages = Math.ceil(count.total / pageSize);
      const page = Math.min(requestedPage, Math.max(1, totalPages));
      const offset = (page - 1) * pageSize;
      const data = await client.unsafe(
        `select a.id, a.action, a.entity_type, a.entity_id, a.details, a.created_at,
                u.role, coalesce(u.username, 'System') as actor
           from public.audit_logs a
           left join public.users u on u.id = a.actor_user_id and u.clinic_id = a.clinic_id
          where a.clinic_id = $1 and ($2 = '' or ($2 = 'system' and a.actor_user_id is null) or u.role::text = $2)
            and ($3 = '' or a.action = $3)
            and ($6 = '' or coalesce(u.username, 'System') ilike '%' || $6 || '%'
              or a.action ilike '%' || $6 || '%' or a.entity_type ilike '%' || $6 || '%'
              or coalesce(a.entity_id::text, '') ilike '%' || $6 || '%'
              or coalesce(a.details::text, '') ilike '%' || $6 || '%')
          order by a.created_at desc limit $4 offset $5`,
        [req.user.clinicId, role, action, pageSize, offset, query],
      );
      return res.json({ data, actions: actions.map(({ action: actionName }) => actionName), pagination: { page, pageSize, total: count.total, totalPages } });
    } catch (error) {
      return next(error);
    }
  });

  router.patch("/requests/:id/reassign", async (req, res, next) => {
    try {
      if (!isUuid(req.params.id) || !isUuid(req.body?.fromStaffId) || !isUuid(req.body?.toStaffId)) {
        return res.status(400).json({ error: "INVALID_ASSIGNMENT" });
      }
      if (req.body.fromStaffId === req.body.toStaffId) return res.status(400).json({ error: "INVALID_ASSIGNMENT" });
      const role = String(req.body?.role ?? "");
      const assignmentColumn = role === "medical_technologist" ? "assigned_technologist_id"
        : role === "pathologist" ? "assigned_pathologist_id" : null;
      if (!assignmentColumn) return res.status(400).json({ error: "INVALID_ASSIGNMENT_ROLE" });
      const result = await client.begin(async (tx) => {
        const [request] = await tx.unsafe(
          `select id, request_number, status from public.test_requests
            where id = $1 and clinic_id = $2 and ${assignmentColumn} = $3
              and status = any($4::public.request_status[]) for update`,
          [req.params.id, req.user.clinicId, req.body.fromStaffId, ["paid", "specimen_collection", "processing", "for_validation", "correction"]],
        );
        if (!request) throw Object.assign(new Error("Active work was not found or has already been reassigned."), { code: "ASSIGNMENT_NOT_FOUND" });
        const [target] = await tx.unsafe(
          `select id from public.users
            where id = $1 and clinic_id = $2 and role = $3::public.user_role and is_active = true for update`,
          [req.body.toStaffId, req.user.clinicId, role],
        );
        if (!target) throw Object.assign(new Error("Choose an active staff member with the matching role."), { code: "INVALID_REASSIGNEE" });
        await tx.unsafe(
          `update public.test_requests set ${assignmentColumn} = $1, updated_at = now()
            where id = $2 and clinic_id = $3`,
          [target.id, request.id, req.user.clinicId],
        );
        await tx.unsafe(
          `insert into public.audit_logs (clinic_id, actor_user_id, action, entity_type, entity_id, details)
           values ($1, $2, 'request.work_reassigned', 'test_request', $3,
             jsonb_build_object('role', $4::text, 'fromStaffId', $5::uuid, 'toStaffId', $6::uuid))`,
          [req.user.clinicId, req.user.sub, request.id, role, req.body.fromStaffId, target.id],
        );
        return { requestId: request.id, requestNumber: request.request_number, assignedStaffId: target.id };
      });
      return res.json({ data: result });
    } catch (error) {
      if (["ASSIGNMENT_NOT_FOUND", "INVALID_REASSIGNEE"].includes(error.code)) {
        return res.status(error.code === "ASSIGNMENT_NOT_FOUND" ? 404 : 409).json({ error: error.code, message: error.message });
      }
      return next(error);
    }
  });

  router.get("/catalog", async (req, res, next) => {
    try {
      const parsedPage = Number.parseInt(req.query.page, 10);
      const requestedPage = Number.isSafeInteger(parsedPage) && parsedPage > 0 ? parsedPage : 1;
      const pageSize = Math.min(100, Math.max(1, Number.parseInt(req.query.pageSize, 10) || 10));
      const query = String(req.query.q ?? "").trim();
      const categoryId = String(req.query.categoryId ?? "");
      const availability = String(req.query.availability ?? "all");
      if (query.length > 100) return res.status(400).json({ error: "INVALID_SEARCH", message: "Catalog search cannot exceed 100 characters." });
      if (categoryId && !isUuid(categoryId)) return res.status(400).json({ error: "INVALID_CATEGORY_FILTER" });
      if (!["all", "active", "inactive"].includes(availability)) return res.status(400).json({ error: "INVALID_AVAILABILITY_FILTER" });
      const categories = await client.unsafe(
        `select c.id, c.name, c.description, c.is_active,
                count(m.test_id)::integer as test_count
           from public.test_categories c left join public.test_category_memberships m on m.category_id = c.id and m.clinic_id = c.clinic_id
          where c.clinic_id = $1 group by c.id order by c.name`,
        [req.user.clinicId],
      );
      const [count] = await client.unsafe(
        `select count(*)::integer as total from public.test_catalog t
          where t.clinic_id = $1 and ($2 = '' or t.name ilike '%' || $2 || '%')
            and ($3::uuid is null or exists (select 1 from public.test_category_memberships fm
              where fm.test_id = t.id and fm.clinic_id = t.clinic_id and fm.category_id = $3))
            and ($4 = 'all' or ($4 = 'active' and t.is_available) or ($4 = 'inactive' and not t.is_available))`,
        [req.user.clinicId, query, categoryId || null, availability],
      );
      const totalPages = Math.ceil(count.total / pageSize);
      const page = Math.min(requestedPage, Math.max(1, totalPages));
      const offset = (page - 1) * pageSize;
      const tests = await client.unsafe(
        `select t.id, t.code, t.name, t.description, t.category_id, c.name as category_name,
                coalesce((select jsonb_agg(jsonb_build_object('id', mc.id, 'name', mc.name) order by mc.name)
                  from public.test_category_memberships m join public.test_categories mc on mc.id = m.category_id and mc.clinic_id = m.clinic_id
                 where m.test_id = t.id and m.clinic_id = t.clinic_id and mc.is_active = true), '[]'::jsonb) as categories,
                t.price, t.turnaround_minutes, t.is_available, t.current_configuration_version,
                (select count(*)::integer from public.test_analytes a where a.test_id = t.id and a.clinic_id = t.clinic_id and a.configuration_version = t.current_configuration_version) as analyte_count,
                (select count(*)::integer from public.test_specimen_requirements sr where sr.test_id = t.id and sr.clinic_id = t.clinic_id and sr.configuration_version = t.current_configuration_version and sr.is_required = true) as specimen_requirement_count
           from public.test_catalog t join public.test_categories c on c.id = t.category_id and c.clinic_id = t.clinic_id
          where t.clinic_id = $1 and ($2 = '' or t.name ilike '%' || $2 || '%')
            and ($3::uuid is null or exists (select 1 from public.test_category_memberships fm
              where fm.test_id = t.id and fm.clinic_id = t.clinic_id and fm.category_id = $3))
            and ($4 = 'all' or ($4 = 'active' and t.is_available) or ($4 = 'inactive' and not t.is_available))
          order by t.name limit $5 offset $6`,
        [req.user.clinicId, query, categoryId || null, availability, pageSize, offset],
      );
      return res.json({ data: { categories, tests }, pagination: { page, pageSize, total: count.total, totalPages } });
    } catch (error) {
      return next(error);
    }
  });

  router.post("/categories", async (req, res, next) => {
    try {
      const validationError = validateCategoryDetails(req.body);
      if (validationError) return res.status(400).json({ error: "INVALID_CATEGORY_DETAILS", message: validationError });
      const name = String(req.body?.name ?? "").trim();
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
      const validationError = validateTestDetails(body);
      if (validationError) return res.status(400).json({ error: "INVALID_TEST_DETAILS", message: validationError });
      const name = String(body.name ?? "").trim();
      const categoryIds = [...new Set((Array.isArray(body.categoryIds) ? body.categoryIds : [body.categoryId]).map((id) => String(id ?? "").trim()).filter(Boolean))];
      const categoryId = categoryIds[0];
      const price = Number(body.price);
      const turnaround = body.turnaroundMinutes == null || body.turnaroundMinutes === "" ? null : Number(body.turnaroundMinutes);
      const specimens = Array.isArray(body.specimens) ? body.specimens : [];
      const analytes = Array.isArray(body.analytes) ? body.analytes : [];
      if (!name || !categoryId || !Number.isFinite(price) || price < 0 || (turnaround != null && (!Number.isInteger(turnaround) || turnaround <= 0))) {
        return res.status(400).json({ error: "INVALID_TEST_DETAILS" });
      }
      if (specimens.length === 0 || analytes.length === 0) return res.status(400).json({ error: "TEST_WORKFLOW_CONFIGURATION_REQUIRED", message: "Add at least one required specimen type and one result analyte before making this test available." });
      const specimenNames = specimens.map((item) => String(item.specimenType ?? "").trim().toLowerCase());
      if (specimenNames.some((item) => !item) || new Set(specimenNames).size !== specimenNames.length
        || specimens.some((item) => item.minimumQuantity != null && item.minimumQuantity !== "" && (!Number.isFinite(Number(item.minimumQuantity)) || Number(item.minimumQuantity) <= 0))) {
        return res.status(400).json({ error: "INVALID_SPECIMEN_REQUIREMENT", message: "Use unique specimen types and a positive minimum quantity when one is specified." });
      }
      const code = String(body.code ?? name.normalize("NFKD").replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-|-$/g, "").toUpperCase().slice(0, 40)).trim();
      const result = await client.begin(async (tx) => {
        const categories = await tx.unsafe(`select id from public.test_categories where id = any($1::uuid[]) and clinic_id = $2 and is_active = true`, [categoryIds, req.user.clinicId]);
        if (!categoryIds.length || categories.length !== categoryIds.length) throw Object.assign(new Error("Choose one or more active categories in this clinic."), { code: "INVALID_CATEGORY" });
        const [test] = await tx.unsafe(
          `insert into public.test_catalog (clinic_id, category_id, code, name, description, price, turnaround_minutes, is_available)
           values ($1,$2,$3,$4,$5,$6,$7,$8) returning id, code, name, category_id, price, turnaround_minutes, is_available`,
          [req.user.clinicId, categoryId, code, name, String(body.description ?? "").trim() || null, price, turnaround, body.isAvailable !== false],
        );
        await tx.unsafe(
          `insert into public.test_configuration_versions (clinic_id, test_id, version_number, created_by)
           values ($1, $2, 1, $3)`,
          [req.user.clinicId, test.id, req.user.sub],
        );
        for (const membershipCategoryId of categoryIds) {
          await tx.unsafe(`insert into public.test_category_memberships (clinic_id, test_id, category_id) values ($1,$2,$3) on conflict do nothing`, [req.user.clinicId, test.id, membershipCategoryId]);
        }
        for (const specimen of specimens) {
          const specimenType = String(specimen.specimenType ?? "").trim();
          if (!specimenType) throw Object.assign(new Error("Every specimen requirement needs a type."), { code: "INVALID_SPECIMEN_REQUIREMENT" });
          await tx.unsafe(
            `insert into public.test_specimen_requirements (clinic_id, test_id, configuration_version, specimen_type, collection_instructions, minimum_quantity, quantity_unit)
             values ($1,$2,1,$3,$4,$5,$6)`,
            [req.user.clinicId, test.id, specimenType, specimen.collectionInstructions || null, specimen.minimumQuantity ?? null, specimen.quantityUnit || null],
          );
        }
        for (const [index, analyte] of analytes.entries()) {
          const key = String(analyte.key ?? `ANALYTE_${index + 1}`).trim();
          const label = String(analyte.label ?? "").trim();
          const valueType = String(analyte.valueType ?? "");
          const options = Array.isArray(analyte.options) ? analyte.options : [];
          if (!label || !["numeric", "text", "select", "boolean", "structured"].includes(valueType) || ((valueType === "select" || valueType === "structured") && !options.length)) {
            throw Object.assign(new Error("Each analyte needs a label, supported value type, and select options when applicable."), { code: "INVALID_ANALYTE_CONFIGURATION" });
          }
          if (valueType === "structured" && (options.length < 2 || options.some((column) => !String(column).trim()) || new Set(options.map((column) => String(column).trim().toLowerCase())).size !== options.length)) {
            throw Object.assign(new Error("Structured results need at least two unique column labels."), { code: "INVALID_ANALYTE_CONFIGURATION" });
          }
          await tx.unsafe(
            `insert into public.test_analytes (clinic_id, test_id, configuration_version, key, label, value_type, options, unit, sort_order, is_required)
             values ($1,$2,1,$3,$4,$5::public.result_value_type,$6::jsonb,$7,$8,$9)`,
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

  router.get("/tests/:id/configuration", async (req, res, next) => {
    try {
      if (!isUuid(req.params.id)) return res.status(400).json({ error: "INVALID_TEST_ID" });
      const [test] = await client.unsafe(
        `select id, code, name, description, category_id, price, turnaround_minutes, is_available, current_configuration_version
           from public.test_catalog where id = $1 and clinic_id = $2`,
        [req.params.id, req.user.clinicId],
      );
      if (!test) return res.status(404).json({ error: "TEST_NOT_FOUND" });
      const requestedVersion = req.query.version == null ? test.current_configuration_version : Number.parseInt(req.query.version, 10);
      if (!Number.isSafeInteger(requestedVersion) || requestedVersion < 1 || requestedVersion > test.current_configuration_version) {
        return res.status(400).json({ error: "INVALID_CONFIGURATION_VERSION" });
      }
      const specimens = await client.unsafe(
        `select id, specimen_type, collection_instructions, minimum_quantity, quantity_unit, is_required
           from public.test_specimen_requirements where test_id = $1 and clinic_id = $2 and configuration_version = $3 order by created_at`,
        [test.id, req.user.clinicId, requestedVersion],
      );
      const analytes = await client.unsafe(
        `select id, key, label, value_type, options, unit, sort_order, is_required
           from public.test_analytes where test_id = $1 and clinic_id = $2 and configuration_version = $3 order by sort_order, created_at`,
        [test.id, req.user.clinicId, requestedVersion],
      );
      return res.json({ data: { test, specimens, analytes, configurationVersion: requestedVersion } });
    } catch (error) {
      return next(error);
    }
  });

  router.patch("/tests/:id", async (req, res, next) => {
    try {
      if (!isUuid(req.params.id)) return res.status(400).json({ error: "INVALID_TEST_ID" });
      const body = req.body ?? {};
      const validationError = validateTestDetails(body, { partial: true });
      if (validationError) return res.status(400).json({ error: "INVALID_TEST_DETAILS", message: validationError });
      const result = await client.begin(async (tx) => {
        const [current] = await tx.unsafe(`select id, category_id, is_available, current_configuration_version from public.test_catalog where id = $1 and clinic_id = $2 for update`, [req.params.id, req.user.clinicId]);
        if (!current) throw Object.assign(new Error("Test was not found."), { code: "TEST_NOT_FOUND" });
        const membershipsProvided = Array.isArray(body.categoryIds) || body.categoryId != null;
        const existingMemberships = membershipsProvided ? [] : await tx.unsafe(
          `select category_id as id from public.test_category_memberships where test_id = $1 and clinic_id = $2 order by category_id`,
          [current.id, req.user.clinicId],
        );
        const categoryIds = [...new Set((membershipsProvided
          ? (Array.isArray(body.categoryIds) ? body.categoryIds : [body.categoryId])
          : (existingMemberships.length ? existingMemberships.map((item) => item.id) : [current.category_id]))
          .map((id) => String(id ?? "").trim()).filter(Boolean))];
        const categoryId = membershipsProvided ? categoryIds[0] : current.category_id;
        const categories = await tx.unsafe(`select id from public.test_categories where id = any($1::uuid[]) and clinic_id = $2 and is_active = true`, [categoryIds, req.user.clinicId]);
        if (!categoryIds.length || categories.length !== categoryIds.length) throw Object.assign(new Error("Choose one or more active categories."), { code: "INVALID_CATEGORY" });
        if (Object.hasOwn(body, "analytes") !== Object.hasOwn(body, "specimens")) {
          throw Object.assign(new Error("Submit analytes and specimens together when changing a workflow configuration."), { code: "INVALID_TEST_CONFIGURATION" });
        }
        const configurationProvided = Array.isArray(body.analytes) && Array.isArray(body.specimens);
        const analytes = configurationProvided ? body.analytes : [];
        const specimens = configurationProvided ? body.specimens : [];
        if (configurationProvided && (!analytes.length || !specimens.length)) {
          throw Object.assign(new Error("A test needs at least one result parameter and one specimen."), { code: "TEST_WORKFLOW_CONFIGURATION_REQUIRED" });
        }
        if (configurationProvided) {
          if (analytes.some((item) => !String(item.label ?? "").trim() || !["numeric", "text", "select", "boolean", "structured"].includes(item.valueType))) {
            throw Object.assign(new Error("Each result parameter needs a label and supported input type."), { code: "INVALID_TEST_CONFIGURATION" });
          }
          if (analytes.some((item) => item.valueType === "select" && (!Array.isArray(item.options) || !item.options.length))) {
            throw Object.assign(new Error("Dropdown parameters need at least one option."), { code: "INVALID_TEST_CONFIGURATION" });
          }
          if (analytes.some((item) => item.valueType === "structured" && (!Array.isArray(item.options) || item.options.length < 2 || item.options.some((column) => !String(column).trim()) || new Set(item.options.map((column) => String(column).trim().toLowerCase())).size !== item.options.length))) {
            throw Object.assign(new Error("Structured results need at least two unique column labels."), { code: "INVALID_TEST_CONFIGURATION" });
          }
          if (specimens.some((item) => !String(item.specimenType ?? "").trim())) {
            throw Object.assign(new Error("Each specimen requirement needs a specimen type."), { code: "INVALID_TEST_CONFIGURATION" });
          }
          const specimenNames = specimens.map((item) => String(item.specimenType).trim().toLowerCase());
          if (new Set(specimenNames).size !== specimenNames.length
            || specimens.some((item) => item.minimumQuantity != null && item.minimumQuantity !== "" && (!Number.isFinite(Number(item.minimumQuantity)) || Number(item.minimumQuantity) <= 0))) {
            throw Object.assign(new Error("Use unique specimen types and a positive minimum quantity when one is specified."), { code: "INVALID_TEST_CONFIGURATION" });
          }
        }
        const nextVersion = configurationProvided ? current.current_configuration_version + 1 : current.current_configuration_version;
        if (configurationProvided) {
          await tx.unsafe(
            `insert into public.test_configuration_versions (clinic_id, test_id, version_number, created_by)
             values ($1, $2, $3, $4)`,
            [req.user.clinicId, current.id, nextVersion, req.user.sub],
          );
          for (const [index, analyte] of analytes.entries()) {
            await tx.unsafe(
              `insert into public.test_analytes (clinic_id, test_id, configuration_version, key, label, value_type, options, unit, sort_order, is_required)
               values ($1, $2, $3, $4, $5, $6::public.result_value_type, $7::jsonb, $8, $9, $10)`,
              [req.user.clinicId, current.id, nextVersion, String(analyte.key || `PARAM_${index + 1}`).trim(), String(analyte.label).trim(), analyte.valueType,
                JSON.stringify(Array.isArray(analyte.options) ? analyte.options : []), analyte.valueType === "numeric" ? (analyte.unit || null) : null,
                index, analyte.isRequired !== false],
            );
          }
          for (const specimen of specimens) {
            await tx.unsafe(
              `insert into public.test_specimen_requirements
                 (clinic_id, test_id, configuration_version, specimen_type, collection_instructions, minimum_quantity, quantity_unit, is_required)
               values ($1, $2, $3, $4, $5, $6, $7, $8)`,
              [req.user.clinicId, current.id, nextVersion, String(specimen.specimenType).trim(), specimen.collectionInstructions || null,
                specimen.minimumQuantity === "" || specimen.minimumQuantity == null ? null : Number(specimen.minimumQuantity),
                specimen.quantityUnit || null, specimen.isRequired !== false],
            );
          }
        }
        const [updated] = await tx.unsafe(
          `update public.test_catalog set category_id = $1, name = coalesce($2,name), description = coalesce($3,description),
                  price = coalesce($4,price), turnaround_minutes = coalesce($5,turnaround_minutes),
                  is_available = coalesce($6,is_available), current_configuration_version = $7, updated_at = now()
            where id = $8 and clinic_id = $9 returning id, code, name, category_id, price, turnaround_minutes, is_available, current_configuration_version`,
          [categoryId, body.name?.trim() || null, body.description ?? null, body.price == null ? null : Number(body.price), body.turnaroundMinutes == null ? null : Number(body.turnaroundMinutes), body.isAvailable ?? null, nextVersion, current.id, req.user.clinicId],
        );
        if (updated.is_available) {
          const [setup] = await tx.unsafe(
            `select exists(select 1 from public.test_analytes where test_id = $1 and clinic_id = $2 and configuration_version = $3) as has_analytes,
                    exists(select 1 from public.test_specimen_requirements where test_id = $1 and clinic_id = $2 and configuration_version = $3 and is_required = true) as has_specimens`,
            [current.id, req.user.clinicId, nextVersion],
          );
          if (!setup.has_analytes || !setup.has_specimens) throw Object.assign(new Error("Configure analytes and required specimens before making this test available."), { code: "TEST_WORKFLOW_CONFIGURATION_REQUIRED" });
        }
        if (membershipsProvided) {
          await tx.unsafe(`delete from public.test_category_memberships where test_id = $1 and clinic_id = $2`, [current.id, req.user.clinicId]);
          for (const membershipCategoryId of categoryIds) {
            await tx.unsafe(`insert into public.test_category_memberships (clinic_id, test_id, category_id) values ($1,$2,$3)`, [req.user.clinicId, current.id, membershipCategoryId]);
          }
        }
        await tx.unsafe(`insert into public.audit_logs (clinic_id, actor_user_id, action, entity_type, entity_id) values ($1,$2,'catalog.test_updated','test_catalog',$3)`, [req.user.clinicId, req.user.sub, current.id]);
        return updated;
      });
      publishCatalogChanged?.(req.user.clinicId);
      return res.json({ data: result });
    } catch (error) {
      if (["TEST_NOT_FOUND", "INVALID_CATEGORY", "TEST_WORKFLOW_CONFIGURATION_REQUIRED", "INVALID_TEST_CONFIGURATION"].includes(error.code)) return res.status(error.code === "TEST_NOT_FOUND" ? 404 : 409).json({ error: error.code, message: error.message });
      return next(error);
    }
  });

  router.patch("/categories/:id/status", async (req, res, next) => {
    try {
      if (!isUuid(req.params.id)) return res.status(400).json({ error: "INVALID_CATEGORY_ID" });
      if (typeof req.body?.isActive !== "boolean") return res.status(400).json({ error: "INVALID_CATEGORY_STATUS" });
      const [category] = await client.unsafe(
        `update public.test_categories set is_active = $1, updated_at = now()
          where id = $2 and clinic_id = $3 returning id, name, is_active`,
        [req.body.isActive, req.params.id, req.user.clinicId],
      );
      if (!category) return res.status(404).json({ error: "CATEGORY_NOT_FOUND" });
      await client.unsafe(
        `insert into public.audit_logs (clinic_id, actor_user_id, action, entity_type, entity_id, details)
         values ($1, $2, $3, 'test_category', $4, jsonb_build_object('isActive', $5::boolean))`,
        [req.user.clinicId, req.user.sub, req.body.isActive ? "catalog.category_activated" : "catalog.category_archived", category.id, req.body.isActive],
      );
      publishCatalogChanged?.(req.user.clinicId);
      return res.json({ data: category });
    } catch (error) {
      return next(error);
    }
  });

  router.patch("/tests/:id/status", async (req, res, next) => {
    try {
      if (!isUuid(req.params.id)) return res.status(400).json({ error: "INVALID_TEST_ID" });
      if (typeof req.body?.isAvailable !== "boolean") return res.status(400).json({ error: "INVALID_TEST_STATUS" });
      const test = await client.begin(async (tx) => {
        const [current] = await tx.unsafe(
          `select id, name, current_configuration_version from public.test_catalog
            where id = $1 and clinic_id = $2 for update`,
          [req.params.id, req.user.clinicId],
        );
        if (!current) throw Object.assign(new Error("Test was not found."), { code: "TEST_NOT_FOUND" });
        if (req.body.isAvailable) {
          const [setup] = await tx.unsafe(
            `select exists(select 1 from public.test_analytes
                            where test_id = $1 and clinic_id = $2 and configuration_version = $3) as has_analytes,
                    exists(select 1 from public.test_specimen_requirements
                            where test_id = $1 and clinic_id = $2 and configuration_version = $3 and is_required = true) as has_specimens`,
            [current.id, req.user.clinicId, current.current_configuration_version],
          );
          if (!setup.has_analytes || !setup.has_specimens) {
            throw Object.assign(new Error("Configure analytes and required specimens before making this test available."), { code: "TEST_WORKFLOW_CONFIGURATION_REQUIRED" });
          }
        }
        const [updated] = await tx.unsafe(
          `update public.test_catalog set is_available = $1, updated_at = now()
            where id = $2 and clinic_id = $3 returning id, name, is_available`,
          [req.body.isAvailable, current.id, req.user.clinicId],
        );
        await tx.unsafe(
          `insert into public.audit_logs (clinic_id, actor_user_id, action, entity_type, entity_id, details)
           values ($1, $2, $3, 'test_catalog', $4, jsonb_build_object('isAvailable', $5::boolean))`,
          [req.user.clinicId, req.user.sub, req.body.isAvailable ? "catalog.test_activated" : "catalog.test_archived", updated.id, req.body.isAvailable],
        );
        return updated;
      });
      publishCatalogChanged?.(req.user.clinicId);
      return res.json({ data: test });
    } catch (error) {
      if (["TEST_NOT_FOUND", "TEST_WORKFLOW_CONFIGURATION_REQUIRED"].includes(error.code)) {
        return res.status(error.code === "TEST_NOT_FOUND" ? 404 : 409).json({ error: error.code, message: error.message });
      }
      return next(error);
    }
  });

  router.delete("/categories/:id", async (req, res, next) => {
    try {
      if (req.body?.testActions != null && !Array.isArray(req.body.testActions)) {
        return res.status(400).json({ error: "INVALID_CATEGORY_ACTIONS" });
      }
      const actions = Array.isArray(req.body?.testActions) ? req.body.testActions : [];
      if (!isUuid(req.params.id)) return res.status(400).json({ error: "INVALID_CATEGORY_ID" });
      if (actions.some((action) => !action || !isUuid(action.testId)
        || !["relocate", "remove"].includes(action.action)
        || (action.action === "relocate" && !isUuid(action.categoryId)))) {
        return res.status(400).json({ error: "INVALID_CATEGORY_ACTIONS" });
      }
      const result = await client.begin(async (tx) => {
        const [category] = await tx.unsafe(`select id from public.test_categories where id = $1 and clinic_id = $2 for update`, [req.params.id, req.user.clinicId]);
        if (!category) throw Object.assign(new Error("Category was not found."), { code: "CATEGORY_NOT_FOUND" });
        const tests = await tx.unsafe(
          `select t.id, t.name, t.category_id from public.test_catalog t
            join public.test_category_memberships m on m.test_id = t.id and m.clinic_id = t.clinic_id
           where m.category_id = $1 and m.clinic_id = $2 for update of t`,
          [category.id, req.user.clinicId],
        );
        if (tests.length !== actions.length || tests.some((test) => !actions.some((action) => action.testId === test.id && ["relocate", "remove"].includes(action.action)))) {
          throw Object.assign(new Error("Choose relocate or remove for each test in this category."), { code: "CATEGORY_ACTIONS_INCOMPLETE" });
        }
        for (const action of actions) {
          if (action.action === "relocate") {
            const [target] = await tx.unsafe(`select id from public.test_categories where id = $1 and clinic_id = $2 and is_active = true and id <> $3`, [action.categoryId, req.user.clinicId, category.id]);
            if (!target) throw Object.assign(new Error("Choose another active category in this clinic."), { code: "INVALID_TARGET_CATEGORY" });
            await tx.unsafe(`insert into public.test_category_memberships (clinic_id, test_id, category_id) values ($1,$2,$3) on conflict do nothing`, [req.user.clinicId, action.testId, target.id]);
            await tx.unsafe(`delete from public.test_category_memberships where test_id = $1 and category_id = $2 and clinic_id = $3`, [action.testId, category.id, req.user.clinicId]);
            await tx.unsafe(`update public.test_catalog set category_id = $1, updated_at = now() where id = $2 and clinic_id = $3 and category_id = $4`, [target.id, action.testId, req.user.clinicId, category.id]);
          } else {
            // Historical request snapshots retain the old test; catalog entry is deactivated.
            await tx.unsafe(`update public.test_catalog set is_available = false, updated_at = now() where id = $1 and clinic_id = $2`, [action.testId, req.user.clinicId]);
            await tx.unsafe(`delete from public.test_category_memberships where test_id = $1 and category_id = $2 and clinic_id = $3`, [action.testId, category.id, req.user.clinicId]);
            await tx.unsafe(
              `update public.test_catalog t set category_id = remaining.category_id, updated_at = now()
                from (select m.test_id, min(m.category_id::text)::uuid as category_id
                        from public.test_category_memberships m join public.test_categories c on c.id = m.category_id and c.clinic_id = m.clinic_id
                       where m.test_id = $1 and m.clinic_id = $2 and c.is_active = true group by m.test_id) remaining
               where t.id = remaining.test_id and t.clinic_id = $2 and t.category_id = $3`,
              [action.testId, req.user.clinicId, category.id],
            );
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
      if (!isUuid(req.params.id)) return res.status(400).json({ error: "INVALID_TEST_ID" });
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
      const parsedPage = Number.parseInt(req.query.page, 10);
      const requestedPage = Number.isSafeInteger(parsedPage) && parsedPage > 0 ? parsedPage : 1;
      const pageSize = Math.min(100, Math.max(1, Number.parseInt(req.query.pageSize, 10) || 10));
      const query = String(req.query.q ?? "").trim();
      const sex = String(req.query.sex ?? "");
      if (query.length > 100) return res.status(400).json({ error: "INVALID_SEARCH", message: "Reference-range search cannot exceed 100 characters." });
      if (!["", "female", "male", "all"].includes(sex)) return res.status(400).json({ error: "INVALID_SEX_FILTER" });
      const sexFilter = sex === "all" ? null : sex;
      const allSexesOnly = sex === "all";
      const [count] = await client.unsafe(
        `select count(*)::integer as total from public.reference_ranges rr
          join public.test_analytes a on a.id = rr.analyte_id and a.clinic_id = rr.clinic_id
          join public.test_catalog t on t.id = a.test_id and t.clinic_id = a.clinic_id
         where rr.clinic_id = $1 and rr.is_active = true and ($2 = '' or t.name ilike '%' || $2 || '%')
           and ($4 = '' or ($4 = 'all' and rr.sex is null) or rr.sex = $3)`,
        [req.user.clinicId, query, sexFilter, allSexesOnly ? "all" : sex],
      );
      const totalPages = Math.ceil(count.total / pageSize);
      const page = Math.min(requestedPage, Math.max(1, totalPages));
      const offset = (page - 1) * pageSize;
      const data = await client.unsafe(
        `select rr.id, t.id as test_id, t.name as test_name, a.id as analyte_id, a.label as analyte,
                rr.sex, rr.min_age_days, rr.max_age_days, rr.lower_limit, rr.upper_limit, rr.unit, rr.guidance
           from public.reference_ranges rr
           join public.test_analytes a on a.id = rr.analyte_id and a.clinic_id = rr.clinic_id
           join public.test_catalog t on t.id = a.test_id and t.clinic_id = a.clinic_id
          where rr.clinic_id = $1 and rr.is_active = true and ($2 = '' or t.name ilike '%' || $2 || '%')
            and ($6 = '' or ($6 = 'all' and rr.sex is null) or rr.sex = $3)
          order by t.name, a.sort_order, rr.sex limit $4 offset $5`,
        [req.user.clinicId, query, sexFilter, pageSize, offset, allSexesOnly ? "all" : sex],
      );
      return res.json({ data, pagination: { page, pageSize, total: count.total, totalPages } });
    } catch (error) {
      return next(error);
    }
  });

  router.post("/reference-ranges", async (req, res, next) => {
    try {
      const body = req.body ?? {};
      const validationError = validateReferenceRangeDetails(body);
      if (validationError) return res.status(400).json({ error: "INVALID_REFERENCE_RANGE", message: validationError });
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
      if (!isUuid(req.params.id)) return res.status(400).json({ error: "INVALID_REFERENCE_RANGE_ID" });
      const body = req.body ?? {};
      const validationError = validateReferenceRangeDetails(body, { partial: true });
      if (validationError) return res.status(400).json({ error: "INVALID_REFERENCE_RANGE", message: validationError });
      if (Object.hasOwn(body, "analyteId")) {
        const [analyte] = await client.unsafe(
          `select id from public.test_analytes where id = $1 and clinic_id = $2`,
          [body.analyteId, req.user.clinicId],
        );
        if (!analyte) return res.status(404).json({ error: "ANALYTE_NOT_FOUND" });
      }
      const [data] = await client.unsafe(
        `update public.reference_ranges set sex = case when $1::boolean then $2 else sex end,
                min_age_days = case when $3::boolean then $4 else min_age_days end,
                max_age_days = case when $5::boolean then $6 else max_age_days end,
                lower_limit = case when $7::boolean then $8 else lower_limit end,
                upper_limit = case when $9::boolean then $10 else upper_limit end,
                unit = case when $11::boolean then $12 else unit end,
                guidance = case when $13::boolean then $14 else guidance end,
                analyte_id = case when $15::boolean then $16 else analyte_id end, updated_at = now()
          where id = $17 and clinic_id = $18 and is_active = true
          returning id, analyte_id, sex, min_age_days, max_age_days, lower_limit, upper_limit, unit, guidance`,
        [Object.hasOwn(body, "sex"), body.sex ?? null, Object.hasOwn(body, "minAgeDays"), body.minAgeDays ?? null,
          Object.hasOwn(body, "maxAgeDays"), body.maxAgeDays ?? null, Object.hasOwn(body, "lowerLimit"), body.lowerLimit ?? null,
          Object.hasOwn(body, "upperLimit"), body.upperLimit ?? null, Object.hasOwn(body, "unit"), body.unit ?? null,
          Object.hasOwn(body, "guidance"), body.guidance ?? null, Object.hasOwn(body, "analyteId"), body.analyteId ?? null,
          req.params.id, req.user.clinicId],
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
      if (!isUuid(req.params.id)) return res.status(400).json({ error: "INVALID_REFERENCE_RANGE_ID" });
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
