-- ============================================
-- Taste Profile Tables for CuisineDuo
-- Copy-paste this into the Supabase SQL Editor
-- ============================================

-- 1. Recipe taste parameters
CREATE TABLE recipe_taste_params (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipe_id UUID NOT NULL REFERENCES recipes(id) ON DELETE CASCADE UNIQUE,
  sweetness SMALLINT CHECK (sweetness BETWEEN 1 AND 5),
  saltiness SMALLINT CHECK (saltiness BETWEEN 1 AND 5),
  spiciness SMALLINT CHECK (spiciness BETWEEN 1 AND 5),
  acidity SMALLINT CHECK (acidity BETWEEN 1 AND 5),
  bitterness SMALLINT CHECK (bitterness BETWEEN 1 AND 5),
  umami SMALLINT CHECK (umami BETWEEN 1 AND 5),
  richness SMALLINT CHECK (richness BETWEEN 1 AND 5),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Recipe ratings
CREATE TABLE recipe_ratings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipe_id UUID NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
  profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  rating SMALLINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(recipe_id, profile_id)
);

-- Enable RLS
ALTER TABLE recipe_taste_params ENABLE ROW LEVEL SECURITY;
ALTER TABLE recipe_ratings ENABLE ROW LEVEL SECURITY;

-- RLS policies for recipe_taste_params (same household access)
CREATE POLICY "Users can view taste params for their household recipes"
  ON recipe_taste_params FOR SELECT
  USING (
    recipe_id IN (
      SELECT r.id FROM recipes r
      JOIN profiles p ON p.household_id = r.household_id
      WHERE p.id IN (SELECT id FROM profiles)
    )
  );

CREATE POLICY "Users can insert taste params for their household recipes"
  ON recipe_taste_params FOR INSERT
  WITH CHECK (
    recipe_id IN (
      SELECT r.id FROM recipes r
      JOIN profiles p ON p.household_id = r.household_id
      WHERE p.id IN (SELECT id FROM profiles)
    )
  );

CREATE POLICY "Users can update taste params for their household recipes"
  ON recipe_taste_params FOR UPDATE
  USING (
    recipe_id IN (
      SELECT r.id FROM recipes r
      JOIN profiles p ON p.household_id = r.household_id
      WHERE p.id IN (SELECT id FROM profiles)
    )
  );

CREATE POLICY "Users can delete taste params for their household recipes"
  ON recipe_taste_params FOR DELETE
  USING (
    recipe_id IN (
      SELECT r.id FROM recipes r
      JOIN profiles p ON p.household_id = r.household_id
      WHERE p.id IN (SELECT id FROM profiles)
    )
  );

-- RLS policies for recipe_ratings (same household access)
CREATE POLICY "Users can view ratings for their household recipes"
  ON recipe_ratings FOR SELECT
  USING (
    recipe_id IN (
      SELECT r.id FROM recipes r
      JOIN profiles p ON p.household_id = r.household_id
      WHERE p.id IN (SELECT id FROM profiles)
    )
  );

CREATE POLICY "Users can insert their own ratings"
  ON recipe_ratings FOR INSERT
  WITH CHECK (
    profile_id IN (SELECT id FROM profiles)
    AND recipe_id IN (
      SELECT r.id FROM recipes r
      JOIN profiles p ON p.household_id = r.household_id
      WHERE p.id IN (SELECT id FROM profiles)
    )
  );

CREATE POLICY "Users can update their own ratings"
  ON recipe_ratings FOR UPDATE
  USING (profile_id IN (SELECT id FROM profiles));

CREATE POLICY "Users can delete their own ratings"
  ON recipe_ratings FOR DELETE
  USING (profile_id IN (SELECT id FROM profiles));

-- 3. Taste preferences (manual overrides + personal notes)
CREATE TABLE taste_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE UNIQUE,
  sweetness SMALLINT CHECK (sweetness BETWEEN 1 AND 5),
  saltiness SMALLINT CHECK (saltiness BETWEEN 1 AND 5),
  spiciness SMALLINT CHECK (spiciness BETWEEN 1 AND 5),
  acidity SMALLINT CHECK (acidity BETWEEN 1 AND 5),
  bitterness SMALLINT CHECK (bitterness BETWEEN 1 AND 5),
  umami SMALLINT CHECK (umami BETWEEN 1 AND 5),
  richness SMALLINT CHECK (richness BETWEEN 1 AND 5),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE taste_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own taste preferences"
  ON taste_preferences FOR SELECT
  USING (profile_id IN (SELECT id FROM profiles));

CREATE POLICY "Users can insert their own taste preferences"
  ON taste_preferences FOR INSERT
  WITH CHECK (profile_id IN (SELECT id FROM profiles));

CREATE POLICY "Users can update their own taste preferences"
  ON taste_preferences FOR UPDATE
  USING (profile_id IN (SELECT id FROM profiles));

CREATE POLICY "Users can delete their own taste preferences"
  ON taste_preferences FOR DELETE
  USING (profile_id IN (SELECT id FROM profiles));
