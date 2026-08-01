/*
# Create app_state table for durable admin data persistence

## What this does
The app stores all admin data (question bank, categories, settings) as a single
JSON blob keyed by `id` in the `app_state` table. This table was referenced by
the code but never created, so data only persisted to localStorage — it was lost
on cache clear and never shared across browsers.

## New Tables
- `app_state`
  - `id` (text, primary key) — the storage key (e.g. 'admin-data')
  - `data` (jsonb, not null) — the JSON-serializable value
  - `updated_at` (timestamptz, default now()) — last write timestamp

## Security
- RLS enabled on `app_state`.
- This is a single-tenant app with no sign-in screen, so anon + authenticated
  roles both get full CRUD access. The data is intentionally public/shared.
- 4 separate policies (select/insert/update/delete), scoped to anon + authenticated.

## Important Notes
1. The `data` column stores the entire AdminData object as JSON, including
   questions with option_a, option_b, option_c, option_d, and question_type fields.
2. No user_id column — this is a single-tenant app without authentication.
3. Idempotent — safe to re-run.
*/

CREATE TABLE IF NOT EXISTS app_state (
  id text PRIMARY KEY,
  data jsonb NOT NULL,
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE app_state ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_app_state" ON app_state;
CREATE POLICY "anon_select_app_state"
ON app_state FOR SELECT
TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_app_state" ON app_state;
CREATE POLICY "anon_insert_app_state"
ON app_state FOR INSERT
TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_app_state" ON app_state;
CREATE POLICY "anon_update_app_state"
ON app_state FOR UPDATE
TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_app_state" ON app_state;
CREATE POLICY "anon_delete_app_state"
ON app_state FOR DELETE
TO anon, authenticated USING (true);
