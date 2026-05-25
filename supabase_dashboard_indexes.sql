-- Dashboard performance: trigram index on properties.title
-- Without this, ILIKE '%キーワード%' searches in the dashboard hit the
-- Supabase per-statement timeout (8s) on ~20k rows.
-- Run once in Supabase SQL Editor (anon key cannot issue DDL).

CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS properties_title_trgm_idx
  ON properties USING gin (title gin_trgm_ops);

-- Helpful filter/order indexes the paged dashboard uses.
CREATE INDEX IF NOT EXISTS properties_active_first_seen_idx
  ON properties (is_active, first_seen_date DESC);

CREATE INDEX IF NOT EXISTS properties_inactive_last_seen_idx
  ON properties (is_active, last_seen_date DESC)
  WHERE is_active = false;

CREATE INDEX IF NOT EXISTS properties_category_idx
  ON properties (category);
