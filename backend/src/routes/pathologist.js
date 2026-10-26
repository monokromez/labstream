import { Router } from "express";
import { client } from "../db/index.js";
import { requireAuth, requireRole } from "../middleware/auth.js";

const router = Router();
const views = new Set(["pending", "returned", "released"]);
const MAX_PAGE_SIZE = 50;

router.use(requireAuth, requireRole("pathologist"));

function parsePositiveInteger(value, fallback, maximum) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed < 1) return fallback;
  return Math.min(parsed, maximum);
}

const latestReviewCte = `
  latest_review AS (
    SELECT DISTINCT ON (review.request_id)
      review.request_id,
      review.id AS review_id,
      review.reviewed_by,
      review.decision,
      review.comments,
      review.reviewed_at,
      reviewer.email AS reviewer_email
    FROM public.result_reviews AS review
    LEFT JOIN public.users AS reviewer ON reviewer.id = review.reviewed_by
    ORDER BY review.request_id, review.reviewed_at DESC, review.id DESC
  )
`;

function requestViewFilter(view) {
  if (view === "pending") {
    return `request.status = 'for_validation'
      AND EXISTS (SELECT 1 FROM public.request_items item WHERE item.request_id = request.id)
      AND NOT EXISTS (
        SELECT 1 FROM public.request_items item
        LEFT JOIN public.results result ON result.request_item_id = item.id
        WHERE item.request_id = request.id AND result.id IS NULL
      )`;
  }
  if (view === "returned") {
    return `request.status = 'processing'
      AND latest_review.decision = 'returned'
      AND NOT EXISTS (
        SELECT 1 FROM public.request_items item
        JOIN public.results result ON result.request_item_id = item.id
        WHERE item.request_id = request.id AND result.updated_at > latest_review.reviewed_at
      )`;
  }
  return "request.status = 'released'";
}

router.get("/summary", async (_req, res) => {
  const [summary] = await client.unsafe(`
    WITH ${latestReviewCte}
    SELECT
      (SELECT count(*)::int FROM public.test_requests request
        WHERE request.status = 'for_validation'
          AND EXISTS (SELECT 1 FROM public.request_items item WHERE item.request_id = request.id)
          AND NOT EXISTS (
            SELECT 1 FROM public.request_items item
            LEFT JOIN public.results result ON result.request_item_id = item.id
            WHERE item.request_id = request.id AND result.id IS NULL
          )) AS pending_count,
      (SELECT count(*)::int FROM public.test_requests request
        JOIN latest_review ON latest_review.request_id = request.id
        WHERE request.status = 'processing'
          AND latest_review.decision = 'returned'
          AND NOT EXISTS (
            SELECT 1 FROM public.request_items item
            JOIN public.results result ON result.request_item_id = item.id
            WHERE item.request_id = request.id AND result.updated_at > latest_review.reviewed_at
          )) AS returned_count,
      (SELECT count(*)::int FROM public.test_requests request
        WHERE request.status = 'released' AND request.released_at::date = CURRENT_DATE) AS released_today_count,
      (SELECT count(*)::int FROM public.result_reviews review
        WHERE review.reviewed_at::date = CURRENT_DATE) AS reviewed_today_count
  `);
  res.json({
    summary: {
      pendingCount: summary.pending_count,
      returnedCount: summary.returned_count,
      releasedTodayCount: summary.released_today_count,
      reviewedTodayCount: summary.reviewed_today_count,
    },
  });
});

router.get("/worklist", async (req, res) => {
  const view = typeof req.query.view === "string" ? req.query.view : "pending";
  if (!views.has(view)) {
    return res.status(400).json({ error: "View must be pending, returned, or released." });
  }

  const page = parsePositiveInteger(req.query.page, 1, 1_000_000);
  const pageSize = parsePositiveInteger(req.query.pageSize, 10, MAX_PAGE_SIZE);
  const search = typeof req.query.search === "string" ? req.query.search.trim().slice(0, 100) : "";
  const offset = (page - 1) * pageSize;
  const filter = requestViewFilter(view);

  const [countResult, rows] = await Promise.all([
    client.unsafe(`
      WITH ${latestReviewCte}
      SELECT count(*)::int AS total
      FROM public.test_requests AS request
      JOIN public.patients AS patient ON patient.id = request.patient_id
      LEFT JOIN latest_review ON latest_review.request_id = request.id
      WHERE ${filter}
        AND (
          $1 = ''
          OR patient.pid ILIKE '%' || $1 || '%'
          OR patient.first_name ILIKE '%' || $1 || '%'
          OR patient.last_name ILIKE '%' || $1 || '%'
          OR request.id::text ILIKE '%' || $1 || '%'
          OR ('REQ-' || extract(year FROM request.created_at)::int::text || '-' || upper(substring(request.id::text, 1, 8))) ILIKE '%' || $1 || '%'
          OR EXISTS (
            SELECT 1 FROM public.queue_entries queue_search
            WHERE queue_search.request_id = request.id
              AND ('REQ-' || extract(year FROM queue_search.queue_date)::int::text || '-' || lpad(queue_search.queue_number::text, 4, '0')) ILIKE '%' || $1 || '%'
          )
        )
    `, [search]),
    client.unsafe(`
      WITH ${latestReviewCte}
      SELECT
        request.id AS request_id,
        request.status,
        request.created_at,
        request.released_at,
        patient.pid,
        patient.first_name,
        patient.last_name,
        patient.date_of_birth,
        patient.sex,
        queue.queue_date,
        queue.queue_number,
        CASE
          WHEN queue.queue_number IS NOT NULL THEN
            'REQ-' || extract(year FROM queue.queue_date)::int::text || '-' || lpad(queue.queue_number::text, 4, '0')
          ELSE 'REQ-' || extract(year FROM request.created_at)::int::text || '-' || upper(substring(request.id::text, 1, 8))
        END AS request_number,
        latest_review.decision AS latest_decision,
        latest_review.comments AS latest_comments,
        latest_review.reviewed_at AS latest_reviewed_at,
        latest_review.reviewer_email,
        COALESCE(
          jsonb_agg(
            jsonb_build_object(
              'requestItemId', item.id,
              'testId', item.test_id,
              'testName', item.test_name_snapshot,
              'resultType', item.result_type_snapshot,
              'value', CASE
                WHEN result.numeric_value IS NOT NULL THEN result.numeric_value::text
                ELSE result.text_value
              END,
              'unit', COALESCE(result.unit, item.unit_snapshot),
              'referenceMin', result.reference_min_snapshot::text,
              'referenceMax', result.reference_max_snapshot::text,
              'referenceText', active_range.text_guidance,
              'abnormal', result.is_abnormal,
              'resultRemarks', result.remarks,
              'encodedAt', result.encoded_at,
              'encodedBy', encoder.email
            ) ORDER BY item.created_at
          ) FILTER (WHERE item.id IS NOT NULL),
          '[]'::jsonb
        ) AS results
      FROM public.test_requests AS request
      JOIN public.patients AS patient ON patient.id = request.patient_id
      LEFT JOIN public.queue_entries AS queue ON queue.request_id = request.id
      LEFT JOIN latest_review ON latest_review.request_id = request.id
      LEFT JOIN public.request_items AS item ON item.request_id = request.id
      LEFT JOIN public.results AS result ON result.request_item_id = item.id
      LEFT JOIN public.users AS encoder ON encoder.id = result.encoded_by
      LEFT JOIN LATERAL (
        SELECT ranges.text_guidance
        FROM public.reference_ranges AS ranges
        WHERE ranges.test_id = item.test_id AND ranges.is_active = true
          AND (ranges.sex IS NULL OR ranges.sex = patient.sex OR lower(ranges.sex) = 'all')
          AND (ranges.min_age_days IS NULL OR patient.date_of_birth IS NULL OR patient.date_of_birth <= CURRENT_DATE - ranges.min_age_days)
          AND (ranges.max_age_days IS NULL OR patient.date_of_birth IS NULL OR patient.date_of_birth >= CURRENT_DATE - ranges.max_age_days)
        ORDER BY ranges.min_age_days DESC NULLS LAST, ranges.max_age_days ASC NULLS LAST
        LIMIT 1
      ) AS active_range ON true
      WHERE ${filter}
        AND (
          $1 = ''
          OR patient.pid ILIKE '%' || $1 || '%'
          OR patient.first_name ILIKE '%' || $1 || '%'
          OR patient.last_name ILIKE '%' || $1 || '%'
          OR request.id::text ILIKE '%' || $1 || '%'
          OR ('REQ-' || extract(year FROM request.created_at)::int::text || '-' || upper(substring(request.id::text, 1, 8))) ILIKE '%' || $1 || '%'
          OR EXISTS (
            SELECT 1 FROM public.queue_entries queue_search
            WHERE queue_search.request_id = request.id
              AND ('REQ-' || extract(year FROM queue_search.queue_date)::int::text || '-' || lpad(queue_search.queue_number::text, 4, '0')) ILIKE '%' || $1 || '%'
          )
        )
      GROUP BY request.id, patient.id, queue.id, latest_review.request_id,
        latest_review.decision, latest_review.comments, latest_review.reviewed_at,
        latest_review.reviewer_email
      ORDER BY request.created_at DESC, request.id DESC
      LIMIT $2 OFFSET $3
    `, [search, pageSize, offset]),
  ]);

  const total = countResult[0]?.total ?? 0;
  const items = rows.map((row) => {
    return {
      id: row.request_id,
      requestNumber: row.request_number,
      status: row.status,
      patient: {
        name: `${row.first_name} ${row.last_name}`,
        pid: row.pid,
        dateOfBirth: row.date_of_birth,
        sex: row.sex,
      },
      submittedAt: row.created_at,
      results: row.results,
      latestReview: row.latest_decision ? {
        decision: row.latest_decision,
        comments: row.latest_comments,
        reviewedAt: row.latest_reviewed_at,
        reviewedBy: row.reviewer_email,
      } : null,
      releasedAt: row.released_at,
    };
  });

  if (items.length > 0) {
    await client.unsafe(`
      INSERT INTO public.audit_logs (actor_user_id, action, entity_type, entity_id, details)
      SELECT $1, 'pathologist_result_viewed', 'test_request', accessed.request_id::uuid,
        jsonb_build_object('view', $2::text)
      FROM jsonb_array_elements_text($3::jsonb) AS accessed(request_id)
    `, [req.authUser.id, view, client.json(items.map((item) => item.id))]);
  }

  return res.json({ items, page, pageSize, total, totalPages: Math.ceil(total / pageSize) });
});

router.post("/requests/:requestId/review", async (req, res) => {
  const { requestId } = req.params;
  const decision = req.body?.decision;
  const comments = typeof req.body?.comments === "string" ? req.body.comments.trim() : "";

  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(requestId)) {
    return res.status(400).json({ error: "Request ID is invalid." });
  }
  if (decision !== "approved" && decision !== "returned") {
    return res.status(400).json({ error: "Decision must be approved or returned." });
  }
  if (decision === "returned" && !comments) {
    return res.status(400).json({ error: "Add a comment before returning a result." });
  }
  if (comments.length > 2000) {
    return res.status(400).json({ error: "Comments must be 2,000 characters or fewer." });
  }

  const outcome = await client.begin(async (transaction) => {
    const [request] = await transaction`
      SELECT id, status FROM public.test_requests
      WHERE id = ${requestId}
      FOR UPDATE
    `;
    if (!request) return { status: 404, body: { error: "Request was not found." } };
    if (request.status !== "for_validation") {
      return { status: 409, body: { error: "This request is no longer awaiting validation." } };
    }

    const [resultCounts] = await transaction`
      SELECT count(item.id)::int AS item_count, count(result.id)::int AS result_count
      FROM public.request_items AS item
      LEFT JOIN public.results AS result ON result.request_item_id = item.id
      WHERE item.request_id = ${requestId}
    `;
    if (resultCounts.item_count === 0 || resultCounts.item_count !== resultCounts.result_count) {
      return { status: 409, body: { error: "Every requested test must have a result before validation." } };
    }

    const nextStatus = decision === "approved" ? "released" : "processing";
    await transaction`
      INSERT INTO public.result_reviews (request_id, reviewed_by, decision, comments)
      VALUES (${requestId}, ${req.authUser.id}, ${decision}, ${comments || null})
    `;

    if (decision === "approved") {
      await transaction`
        UPDATE public.test_requests
        SET status = ${nextStatus}, released_at = now(), released_by = ${req.authUser.id}, updated_at = now()
        WHERE id = ${requestId}
      `;
    } else {
      await transaction`
        UPDATE public.test_requests
        SET status = ${nextStatus}, updated_at = now()
        WHERE id = ${requestId}
      `;
    }

    await transaction`
      INSERT INTO public.request_status_history (request_id, old_status, new_status, changed_by, note)
      VALUES (
        ${requestId}, 'for_validation', ${nextStatus}, ${req.authUser.id},
        ${decision === "approved" ? "Approved and released by pathologist" : "Returned to technologist for correction"}
      )
    `;
    await transaction`
      INSERT INTO public.audit_logs (actor_user_id, action, entity_type, entity_id, details)
      VALUES (
        ${req.authUser.id}, ${decision === "approved" ? "result_released" : "result_returned"},
        'test_request', ${requestId}, ${transaction.json({ previousStatus: "for_validation", newStatus: nextStatus })}
      )
    `;

    return {
      status: 200,
      body: { requestId, decision, status: nextStatus, reviewedAt: new Date().toISOString() },
    };
  });

  return res.status(outcome.status).json(outcome.body);
});

export default router;
