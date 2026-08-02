CREATE TABLE IF NOT EXISTS admin_questions (
  id text PRIMARY KEY,
  data jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS admin_categories (
  id text PRIMARY KEY,
  data jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE admin_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_categories ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'admin_questions' AND policyname = 'Public read/write admin_questions') THEN
    CREATE POLICY "Public read/write admin_questions" ON admin_questions FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'admin_categories' AND policyname = 'Public read/write admin_categories') THEN
    CREATE POLICY "Public read/write admin_categories" ON admin_categories FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
  END IF;
END $$;

-- One-time migration: copy whatever is currently in the old app_state blob
-- into the new per-row tables so nothing already saved is lost.
INSERT INTO admin_categories (id, data)
SELECT (cat->>'id'), cat
FROM app_state, jsonb_array_elements(data->'categories') AS cat
WHERE id = 'admin-data'
ON CONFLICT (id) DO NOTHING;

INSERT INTO admin_questions (id, data)
SELECT (q->>'id'), q
FROM app_state, jsonb_array_elements(data->'questions') AS q
WHERE id = 'admin-data'
ON CONFLICT (id) DO NOTHING;
