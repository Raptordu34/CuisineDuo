-- ============================================
-- Swipe Sessions, Shopping Lists & Cooking History
-- Tables for CuisineDuo
-- Copy-paste this into the Supabase SQL Editor
-- ============================================

-- 1. Swipe sessions
CREATE TABLE swipe_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  created_by UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT '',
  meal_count SMALLINT NOT NULL DEFAULT 7,
  meal_types TEXT[] NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'generating' CHECK (status IN ('generating', 'voting', 'completed', 'cancelled')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Swipe session recipes (suggestions)
CREATE TABLE swipe_session_recipes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES swipe_sessions(id) ON DELETE CASCADE,
  recipe_id UUID REFERENCES recipes(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  description TEXT,
  category TEXT,
  image_url TEXT,
  difficulty TEXT,
  prep_time SMALLINT,
  cook_time SMALLINT,
  servings SMALLINT,
  ai_recipe_data JSONB,
  is_existing_recipe BOOLEAN NOT NULL DEFAULT false,
  sort_order SMALLINT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Swipe votes
CREATE TABLE swipe_votes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_recipe_id UUID NOT NULL REFERENCES swipe_session_recipes(id) ON DELETE CASCADE,
  profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  vote BOOLEAN NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(session_recipe_id, profile_id)
);

-- 4. Shopping lists
CREATE TABLE shopping_lists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT '',
  session_id UUID REFERENCES swipe_sessions(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'archived')),
  created_by UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 5. Shopping list items
CREATE TABLE shopping_list_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  list_id UUID NOT NULL REFERENCES shopping_lists(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  quantity NUMERIC,
  unit TEXT,
  category TEXT,
  recipe_name TEXT,
  checked BOOLEAN NOT NULL DEFAULT false,
  checked_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  checked_at TIMESTAMPTZ,
  notes TEXT,
  sort_order SMALLINT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 6. Cooking history
CREATE TABLE cooking_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipe_id UUID NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
  household_id UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  cooked_by UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  cooked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  notes TEXT,
  servings_cooked SMALLINT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================
-- Enable RLS on all tables
-- ============================================
ALTER TABLE swipe_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE swipe_session_recipes ENABLE ROW LEVEL SECURITY;
ALTER TABLE swipe_votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE shopping_lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE shopping_list_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE cooking_history ENABLE ROW LEVEL SECURITY;

-- ============================================
-- RLS Policies
-- ============================================

-- swipe_sessions: household members
CREATE POLICY "Household members can view swipe sessions"
  ON swipe_sessions FOR SELECT
  USING (household_id IN (SELECT household_id FROM profiles));

CREATE POLICY "Household members can insert swipe sessions"
  ON swipe_sessions FOR INSERT
  WITH CHECK (household_id IN (SELECT household_id FROM profiles));

CREATE POLICY "Household members can update swipe sessions"
  ON swipe_sessions FOR UPDATE
  USING (household_id IN (SELECT household_id FROM profiles));

CREATE POLICY "Household members can delete swipe sessions"
  ON swipe_sessions FOR DELETE
  USING (household_id IN (SELECT household_id FROM profiles));

-- swipe_session_recipes: via session -> household
CREATE POLICY "Household members can view session recipes"
  ON swipe_session_recipes FOR SELECT
  USING (session_id IN (SELECT id FROM swipe_sessions));

CREATE POLICY "Household members can insert session recipes"
  ON swipe_session_recipes FOR INSERT
  WITH CHECK (session_id IN (SELECT id FROM swipe_sessions));

CREATE POLICY "Household members can update session recipes"
  ON swipe_session_recipes FOR UPDATE
  USING (session_id IN (SELECT id FROM swipe_sessions));

CREATE POLICY "Household members can delete session recipes"
  ON swipe_session_recipes FOR DELETE
  USING (session_id IN (SELECT id FROM swipe_sessions));

-- swipe_votes: via session -> household
CREATE POLICY "Household members can view votes"
  ON swipe_votes FOR SELECT
  USING (session_recipe_id IN (SELECT id FROM swipe_session_recipes));

CREATE POLICY "Household members can insert votes"
  ON swipe_votes FOR INSERT
  WITH CHECK (session_recipe_id IN (SELECT id FROM swipe_session_recipes));

CREATE POLICY "Household members can update votes"
  ON swipe_votes FOR UPDATE
  USING (session_recipe_id IN (SELECT id FROM swipe_session_recipes));

CREATE POLICY "Household members can delete votes"
  ON swipe_votes FOR DELETE
  USING (session_recipe_id IN (SELECT id FROM swipe_session_recipes));

-- shopping_lists: household members
CREATE POLICY "Household members can view shopping lists"
  ON shopping_lists FOR SELECT
  USING (household_id IN (SELECT household_id FROM profiles));

CREATE POLICY "Household members can insert shopping lists"
  ON shopping_lists FOR INSERT
  WITH CHECK (household_id IN (SELECT household_id FROM profiles));

CREATE POLICY "Household members can update shopping lists"
  ON shopping_lists FOR UPDATE
  USING (household_id IN (SELECT household_id FROM profiles));

CREATE POLICY "Household members can delete shopping lists"
  ON shopping_lists FOR DELETE
  USING (household_id IN (SELECT household_id FROM profiles));

-- shopping_list_items: via list -> household
CREATE POLICY "Household members can view shopping list items"
  ON shopping_list_items FOR SELECT
  USING (list_id IN (SELECT id FROM shopping_lists));

CREATE POLICY "Household members can insert shopping list items"
  ON shopping_list_items FOR INSERT
  WITH CHECK (list_id IN (SELECT id FROM shopping_lists));

CREATE POLICY "Household members can update shopping list items"
  ON shopping_list_items FOR UPDATE
  USING (list_id IN (SELECT id FROM shopping_lists));

CREATE POLICY "Household members can delete shopping list items"
  ON shopping_list_items FOR DELETE
  USING (list_id IN (SELECT id FROM shopping_lists));

-- cooking_history: household members
CREATE POLICY "Household members can view cooking history"
  ON cooking_history FOR SELECT
  USING (household_id IN (SELECT household_id FROM profiles));

CREATE POLICY "Household members can insert cooking history"
  ON cooking_history FOR INSERT
  WITH CHECK (household_id IN (SELECT household_id FROM profiles));

CREATE POLICY "Household members can update cooking history"
  ON cooking_history FOR UPDATE
  USING (household_id IN (SELECT household_id FROM profiles));

CREATE POLICY "Household members can delete cooking history"
  ON cooking_history FOR DELETE
  USING (household_id IN (SELECT household_id FROM profiles));

-- ============================================
-- Enable Realtime
-- ============================================
ALTER PUBLICATION supabase_realtime ADD TABLE swipe_sessions;
ALTER PUBLICATION supabase_realtime ADD TABLE swipe_votes;
ALTER PUBLICATION supabase_realtime ADD TABLE shopping_list_items;
