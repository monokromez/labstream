-- Run this query by itself and wait for it to commit before running
-- 20261026_structured_results_and_expiring_tokens.sql.
alter type public.result_value_type add value if not exists 'structured';
