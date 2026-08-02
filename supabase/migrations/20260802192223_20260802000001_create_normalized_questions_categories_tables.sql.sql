-- Normalized questions table: one row per question, real columns.
CREATE TABLE IF NOT EXISTS questions (
  id text PRIMARY KEY,
  category text NOT NULL,
  points integer NOT NULL,
  difficulty text NOT NULL DEFAULT 'medium',
  question text NOT NULL,
  question_type text NOT NULL DEFAULT 'normal',
  option_a text,
  option_b text,
  option_c text,
  option_d text,
  answer text NOT NULL,
  image text,
  audio text,
  video text,
  tmdb_id integer,
  tmdb_media text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Normalized categories table: one row per category, real columns.
CREATE TABLE IF NOT EXISTS categories (
  id text PRIMARY KEY,
  name text NOT NULL,
  description text NOT NULL DEFAULT '',
  glyph text NOT NULL DEFAULT '',
  gradient text NOT NULL DEFAULT '',
  image text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'questions' AND policyname = 'Public read/write questions') THEN
    CREATE POLICY "Public read/write questions" ON questions FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'categories' AND policyname = 'Public read/write categories') THEN
    CREATE POLICY "Public read/write categories" ON categories FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
  END IF;
END $$;

-- Migrate from admin_questions (JSONB data column) into normalized columns.
INSERT INTO questions (id, category, points, difficulty, question, question_type, option_a, option_b, option_c, option_d, answer, image, audio, video, tmdb_id, tmdb_media)
SELECT
  q->>'id',
  q->>'categoryId',
  COALESCE((q->>'points')::int, 500),
  COALESCE(q->>'difficulty', 'medium'),
  COALESCE(q->>'question', ''),
  COALESCE(q->>'questionType', 'normal'),
  q->>'optionA',
  q->>'optionB',
  q->>'optionC',
  q->>'optionD',
  COALESCE(q->>'answer', ''),
  q->>'image',
  q->>'audio',
  q->>'video',
  (q->>'tmdb_id')::int,
  q->>'tmdb_media'
FROM app_state, jsonb_array_elements(data->'questions') AS q
WHERE id = 'admin-data'
ON CONFLICT (id) DO NOTHING;

-- Also migrate from admin_questions table if it has data.
INSERT INTO questions (id, category, points, difficulty, question, question_type, option_a, option_b, option_c, option_d, answer, image, audio, video, tmdb_id, tmdb_media)
SELECT
  data->>'id',
  data->>'categoryId',
  COALESCE((data->>'points')::int, 500),
  COALESCE(data->>'difficulty', 'medium'),
  COALESCE(data->>'question', ''),
  COALESCE(data->>'questionType', 'normal'),
  data->>'optionA',
  data->>'optionB',
  data->>'optionC',
  data->>'optionD',
  COALESCE(data->>'answer', ''),
  data->>'image',
  data->>'audio',
  data->>'video',
  (data->>'tmdb_id')::int,
  data->>'tmdb_media'
FROM admin_questions
ON CONFLICT (id) DO NOTHING;

-- Migrate categories from app_state blob.
INSERT INTO categories (id, name, description, glyph, gradient, image)
SELECT
  c->>'id',
  COALESCE(c->>'name', ''),
  COALESCE(c->>'description', ''),
  COALESCE(c->>'glyph', ''),
  COALESCE(c->>'gradient', ''),
  c->>'image'
FROM app_state, jsonb_array_elements(data->'categories') AS c
WHERE id = 'admin-data'
ON CONFLICT (id) DO NOTHING;

-- Also migrate from admin_categories table.
INSERT INTO categories (id, name, description, glyph, gradient, image)
SELECT
  data->>'id',
  COALESCE(data->>'name', ''),
  COALESCE(data->>'description', ''),
  COALESCE(data->>'glyph', ''),
  COALESCE(data->>'gradient', ''),
  data->>'image'
FROM admin_categories
ON CONFLICT (id) DO NOTHING;

-- Indexes for performance at scale (50k+ questions).
CREATE INDEX IF NOT EXISTS idx_questions_category ON questions (category);
CREATE INDEX IF NOT EXISTS idx_questions_category_points ON questions (category, points);
CREATE INDEX IF NOT EXISTS idx_questions_updated_at ON questions (updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_categories_name ON categories (name);
