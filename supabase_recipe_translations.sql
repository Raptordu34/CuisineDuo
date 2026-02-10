-- Recipe translations cache table
CREATE TABLE IF NOT EXISTS recipe_translations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipe_id UUID NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
  lang TEXT NOT NULL CHECK (lang IN ('fr', 'zh')),
  translated_data JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(recipe_id, lang)
);

-- Enable RLS
ALTER TABLE recipe_translations ENABLE ROW LEVEL SECURITY;

-- RLS policies: access via household (same pattern as recipe_taste_params)
CREATE POLICY "Users can view translations for their household recipes"
  ON recipe_translations FOR SELECT
  USING (
    recipe_id IN (
      SELECT r.id FROM recipes r
      JOIN profiles p ON p.household_id = r.household_id
      WHERE p.id = auth.uid()
    )
  );

CREATE POLICY "Users can insert translations for their household recipes"
  ON recipe_translations FOR INSERT
  WITH CHECK (
    recipe_id IN (
      SELECT r.id FROM recipes r
      JOIN profiles p ON p.household_id = r.household_id
      WHERE p.id = auth.uid()
    )
  );

CREATE POLICY "Users can delete translations for their household recipes"
  ON recipe_translations FOR DELETE
  USING (
    recipe_id IN (
      SELECT r.id FROM recipes r
      JOIN profiles p ON p.household_id = r.household_id
      WHERE p.id = auth.uid()
    )
  );
