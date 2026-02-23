-- =================================================================
-- Fix RLS InitPlan : wrapper (select ...) autour de auth.uid()
-- et auth_user_household_id() pour eviter la re-evaluation par ligne.
--
-- PostgreSQL ne supporte pas ALTER POLICY pour changer USING/WITH CHECK,
-- donc on DROP + CREATE chaque policy affectee.
-- =================================================================

-- ---- HOUSEHOLDS ----
DROP POLICY IF EXISTS "Authenticated users can read households" ON households;
CREATE POLICY "Authenticated users can read households" ON households
  FOR SELECT USING ((select auth.uid()) IS NOT NULL);

DROP POLICY IF EXISTS "Authenticated users can create households" ON households;
CREATE POLICY "Authenticated users can create households" ON households
  FOR INSERT WITH CHECK ((select auth.uid()) IS NOT NULL);

-- Members can update their household — pas dans le lint, mais on fixe par coherence
DROP POLICY IF EXISTS "Members can update their household" ON households;
CREATE POLICY "Members can update their household" ON households
  FOR UPDATE USING (id = (select auth_user_household_id()));

-- ---- PROFILES ----
DROP POLICY IF EXISTS "Users can view household profiles" ON profiles;
CREATE POLICY "Users can view household profiles" ON profiles
  FOR SELECT USING (
    id = (select auth.uid())
    OR household_id = (select auth_user_household_id())
  );

DROP POLICY IF EXISTS "Users can create own profile" ON profiles;
CREATE POLICY "Users can create own profile" ON profiles
  FOR INSERT WITH CHECK (id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
CREATE POLICY "Users can update own profile" ON profiles
  FOR UPDATE USING (id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can delete own profile" ON profiles;
CREATE POLICY "Users can delete own profile" ON profiles
  FOR DELETE USING (id = (select auth.uid()));

-- ---- RECIPES ----
DROP POLICY IF EXISTS "Household members can view recipes" ON recipes;
CREATE POLICY "Household members can view recipes" ON recipes
  FOR SELECT USING (household_id = (select auth_user_household_id()));

DROP POLICY IF EXISTS "Household members can insert recipes" ON recipes;
CREATE POLICY "Household members can insert recipes" ON recipes
  FOR INSERT WITH CHECK (
    household_id = (select auth_user_household_id())
    AND created_by = (select auth.uid())
  );

DROP POLICY IF EXISTS "Household members can update recipes" ON recipes;
CREATE POLICY "Household members can update recipes" ON recipes
  FOR UPDATE USING (household_id = (select auth_user_household_id()));

DROP POLICY IF EXISTS "Household members can delete recipes" ON recipes;
CREATE POLICY "Household members can delete recipes" ON recipes
  FOR DELETE USING (household_id = (select auth_user_household_id()));

-- ---- INVENTORY_ITEMS ----
DROP POLICY IF EXISTS "Household members can view inventory" ON inventory_items;
CREATE POLICY "Household members can view inventory" ON inventory_items
  FOR SELECT USING (household_id = (select auth_user_household_id()));

DROP POLICY IF EXISTS "Household members can insert inventory" ON inventory_items;
CREATE POLICY "Household members can insert inventory" ON inventory_items
  FOR INSERT WITH CHECK (
    household_id = (select auth_user_household_id())
    AND added_by = (select auth.uid())
  );

DROP POLICY IF EXISTS "Household members can update inventory" ON inventory_items;
CREATE POLICY "Household members can update inventory" ON inventory_items
  FOR UPDATE USING (household_id = (select auth_user_household_id()));

DROP POLICY IF EXISTS "Household members can delete inventory" ON inventory_items;
CREATE POLICY "Household members can delete inventory" ON inventory_items
  FOR DELETE USING (household_id = (select auth_user_household_id()));

-- ---- CONSUMED_ITEMS ----
DROP POLICY IF EXISTS "Household members can view consumed items" ON consumed_items;
CREATE POLICY "Household members can view consumed items" ON consumed_items
  FOR SELECT USING (household_id = (select auth_user_household_id()));

DROP POLICY IF EXISTS "Household members can insert consumed items" ON consumed_items;
CREATE POLICY "Household members can insert consumed items" ON consumed_items
  FOR INSERT WITH CHECK (
    household_id = (select auth_user_household_id())
    AND consumed_by = (select auth.uid())
  );

DROP POLICY IF EXISTS "Household members can update consumed items" ON consumed_items;
CREATE POLICY "Household members can update consumed items" ON consumed_items
  FOR UPDATE USING (household_id = (select auth_user_household_id()));

DROP POLICY IF EXISTS "Household members can delete consumed items" ON consumed_items;
CREATE POLICY "Household members can delete consumed items" ON consumed_items
  FOR DELETE USING (household_id = (select auth_user_household_id()));

-- ---- MESSAGES ----
DROP POLICY IF EXISTS "Household members can view messages" ON messages;
CREATE POLICY "Household members can view messages" ON messages
  FOR SELECT USING (household_id = (select auth_user_household_id()));

DROP POLICY IF EXISTS "Household members can insert messages" ON messages;
CREATE POLICY "Household members can insert messages" ON messages
  FOR INSERT WITH CHECK (
    household_id = (select auth_user_household_id())
    AND profile_id = (select auth.uid())
  );

DROP POLICY IF EXISTS "Users can update own messages" ON messages;
CREATE POLICY "Users can update own messages" ON messages
  FOR UPDATE USING (
    household_id = (select auth_user_household_id())
    AND profile_id = (select auth.uid())
  );

DROP POLICY IF EXISTS "Users can delete own messages" ON messages;
CREATE POLICY "Users can delete own messages" ON messages
  FOR DELETE USING (
    household_id = (select auth_user_household_id())
    AND profile_id = (select auth.uid())
  );

-- ---- RECIPE_COMMENTS ----
DROP POLICY IF EXISTS "Household members can view comments" ON recipe_comments;
CREATE POLICY "Household members can view comments" ON recipe_comments
  FOR SELECT USING (
    recipe_id IN (SELECT id FROM recipes WHERE household_id = (select auth_user_household_id()))
  );

DROP POLICY IF EXISTS "Household members can insert comments" ON recipe_comments;
CREATE POLICY "Household members can insert comments" ON recipe_comments
  FOR INSERT WITH CHECK (
    profile_id = (select auth.uid())
    AND recipe_id IN (SELECT id FROM recipes WHERE household_id = (select auth_user_household_id()))
  );

DROP POLICY IF EXISTS "Users can update own comments" ON recipe_comments;
CREATE POLICY "Users can update own comments" ON recipe_comments
  FOR UPDATE USING (profile_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can delete own comments" ON recipe_comments;
CREATE POLICY "Users can delete own comments" ON recipe_comments
  FOR DELETE USING (profile_id = (select auth.uid()));

-- ---- PUSH_SUBSCRIPTIONS ----
DROP POLICY IF EXISTS "Users can view own push subscriptions" ON push_subscriptions;
CREATE POLICY "Users can view own push subscriptions" ON push_subscriptions
  FOR SELECT USING (profile_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can insert own push subscriptions" ON push_subscriptions;
CREATE POLICY "Users can insert own push subscriptions" ON push_subscriptions
  FOR INSERT WITH CHECK (
    profile_id = (select auth.uid())
    AND household_id = (select auth_user_household_id())
  );

DROP POLICY IF EXISTS "Users can update own push subscriptions" ON push_subscriptions;
CREATE POLICY "Users can update own push subscriptions" ON push_subscriptions
  FOR UPDATE USING (profile_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can delete own push subscriptions" ON push_subscriptions;
CREATE POLICY "Users can delete own push subscriptions" ON push_subscriptions
  FOR DELETE USING (profile_id = (select auth.uid()));

-- ---- SWIPE_SESSIONS ----
DROP POLICY IF EXISTS "Household members can view swipe sessions" ON swipe_sessions;
CREATE POLICY "Household members can view swipe sessions" ON swipe_sessions
  FOR SELECT USING (household_id = (select auth_user_household_id()));

DROP POLICY IF EXISTS "Household members can insert swipe sessions" ON swipe_sessions;
CREATE POLICY "Household members can insert swipe sessions" ON swipe_sessions
  FOR INSERT WITH CHECK (
    household_id = (select auth_user_household_id())
    AND created_by = (select auth.uid())
  );

DROP POLICY IF EXISTS "Household members can update swipe sessions" ON swipe_sessions;
CREATE POLICY "Household members can update swipe sessions" ON swipe_sessions
  FOR UPDATE USING (household_id = (select auth_user_household_id()));

DROP POLICY IF EXISTS "Household members can delete swipe sessions" ON swipe_sessions;
CREATE POLICY "Household members can delete swipe sessions" ON swipe_sessions
  FOR DELETE USING (household_id = (select auth_user_household_id()));

-- ---- SWIPE_SESSION_RECIPES ----
DROP POLICY IF EXISTS "Household members can view session recipes" ON swipe_session_recipes;
CREATE POLICY "Household members can view session recipes" ON swipe_session_recipes
  FOR SELECT USING (
    session_id IN (SELECT id FROM swipe_sessions WHERE household_id = (select auth_user_household_id()))
  );

DROP POLICY IF EXISTS "Household members can insert session recipes" ON swipe_session_recipes;
CREATE POLICY "Household members can insert session recipes" ON swipe_session_recipes
  FOR INSERT WITH CHECK (
    session_id IN (SELECT id FROM swipe_sessions WHERE household_id = (select auth_user_household_id()))
  );

DROP POLICY IF EXISTS "Household members can update session recipes" ON swipe_session_recipes;
CREATE POLICY "Household members can update session recipes" ON swipe_session_recipes
  FOR UPDATE USING (
    session_id IN (SELECT id FROM swipe_sessions WHERE household_id = (select auth_user_household_id()))
  );

DROP POLICY IF EXISTS "Household members can delete session recipes" ON swipe_session_recipes;
CREATE POLICY "Household members can delete session recipes" ON swipe_session_recipes
  FOR DELETE USING (
    session_id IN (SELECT id FROM swipe_sessions WHERE household_id = (select auth_user_household_id()))
  );

-- ---- SWIPE_VOTES ----
DROP POLICY IF EXISTS "Household members can view votes" ON swipe_votes;
CREATE POLICY "Household members can view votes" ON swipe_votes
  FOR SELECT USING (
    session_recipe_id IN (
      SELECT sr.id FROM swipe_session_recipes sr
      JOIN swipe_sessions s ON sr.session_id = s.id
      WHERE s.household_id = (select auth_user_household_id())
    )
  );

DROP POLICY IF EXISTS "Users can insert own votes" ON swipe_votes;
CREATE POLICY "Users can insert own votes" ON swipe_votes
  FOR INSERT WITH CHECK (
    profile_id = (select auth.uid())
    AND session_recipe_id IN (
      SELECT sr.id FROM swipe_session_recipes sr
      JOIN swipe_sessions s ON sr.session_id = s.id
      WHERE s.household_id = (select auth_user_household_id())
    )
  );

DROP POLICY IF EXISTS "Users can update own votes" ON swipe_votes;
CREATE POLICY "Users can update own votes" ON swipe_votes
  FOR UPDATE USING (profile_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can delete own votes" ON swipe_votes;
CREATE POLICY "Users can delete own votes" ON swipe_votes
  FOR DELETE USING (profile_id = (select auth.uid()));

-- ---- SHOPPING_LISTS ----
DROP POLICY IF EXISTS "Household members can view shopping lists" ON shopping_lists;
CREATE POLICY "Household members can view shopping lists" ON shopping_lists
  FOR SELECT USING (household_id = (select auth_user_household_id()));

DROP POLICY IF EXISTS "Household members can insert shopping lists" ON shopping_lists;
CREATE POLICY "Household members can insert shopping lists" ON shopping_lists
  FOR INSERT WITH CHECK (
    household_id = (select auth_user_household_id())
    AND created_by = (select auth.uid())
  );

DROP POLICY IF EXISTS "Household members can update shopping lists" ON shopping_lists;
CREATE POLICY "Household members can update shopping lists" ON shopping_lists
  FOR UPDATE USING (household_id = (select auth_user_household_id()));

DROP POLICY IF EXISTS "Household members can delete shopping lists" ON shopping_lists;
CREATE POLICY "Household members can delete shopping lists" ON shopping_lists
  FOR DELETE USING (household_id = (select auth_user_household_id()));

-- ---- SHOPPING_LIST_ITEMS ----
DROP POLICY IF EXISTS "Household members can view shopping list items" ON shopping_list_items;
CREATE POLICY "Household members can view shopping list items" ON shopping_list_items
  FOR SELECT USING (
    list_id IN (SELECT id FROM shopping_lists WHERE household_id = (select auth_user_household_id()))
  );

DROP POLICY IF EXISTS "Household members can insert shopping list items" ON shopping_list_items;
CREATE POLICY "Household members can insert shopping list items" ON shopping_list_items
  FOR INSERT WITH CHECK (
    list_id IN (SELECT id FROM shopping_lists WHERE household_id = (select auth_user_household_id()))
  );

DROP POLICY IF EXISTS "Household members can update shopping list items" ON shopping_list_items;
CREATE POLICY "Household members can update shopping list items" ON shopping_list_items
  FOR UPDATE USING (
    list_id IN (SELECT id FROM shopping_lists WHERE household_id = (select auth_user_household_id()))
  );

DROP POLICY IF EXISTS "Household members can delete shopping list items" ON shopping_list_items;
CREATE POLICY "Household members can delete shopping list items" ON shopping_list_items
  FOR DELETE USING (
    list_id IN (SELECT id FROM shopping_lists WHERE household_id = (select auth_user_household_id()))
  );

-- ---- COOKING_HISTORY ----
DROP POLICY IF EXISTS "Household members can view cooking history" ON cooking_history;
CREATE POLICY "Household members can view cooking history" ON cooking_history
  FOR SELECT USING (household_id = (select auth_user_household_id()));

DROP POLICY IF EXISTS "Household members can insert cooking history" ON cooking_history;
CREATE POLICY "Household members can insert cooking history" ON cooking_history
  FOR INSERT WITH CHECK (
    household_id = (select auth_user_household_id())
    AND cooked_by = (select auth.uid())
  );

DROP POLICY IF EXISTS "Household members can update cooking history" ON cooking_history;
CREATE POLICY "Household members can update cooking history" ON cooking_history
  FOR UPDATE USING (household_id = (select auth_user_household_id()));

DROP POLICY IF EXISTS "Household members can delete cooking history" ON cooking_history;
CREATE POLICY "Household members can delete cooking history" ON cooking_history
  FOR DELETE USING (household_id = (select auth_user_household_id()));

-- ---- RECIPE_TASTE_PARAMS ----
DROP POLICY IF EXISTS "Household members can view taste params" ON recipe_taste_params;
CREATE POLICY "Household members can view taste params" ON recipe_taste_params
  FOR SELECT USING (
    recipe_id IN (SELECT id FROM recipes WHERE household_id = (select auth_user_household_id()))
  );

DROP POLICY IF EXISTS "Household members can insert taste params" ON recipe_taste_params;
CREATE POLICY "Household members can insert taste params" ON recipe_taste_params
  FOR INSERT WITH CHECK (
    recipe_id IN (SELECT id FROM recipes WHERE household_id = (select auth_user_household_id()))
  );

DROP POLICY IF EXISTS "Household members can update taste params" ON recipe_taste_params;
CREATE POLICY "Household members can update taste params" ON recipe_taste_params
  FOR UPDATE USING (
    recipe_id IN (SELECT id FROM recipes WHERE household_id = (select auth_user_household_id()))
  );

DROP POLICY IF EXISTS "Household members can delete taste params" ON recipe_taste_params;
CREATE POLICY "Household members can delete taste params" ON recipe_taste_params
  FOR DELETE USING (
    recipe_id IN (SELECT id FROM recipes WHERE household_id = (select auth_user_household_id()))
  );

-- ---- RECIPE_RATINGS ----
DROP POLICY IF EXISTS "Household members can view ratings" ON recipe_ratings;
CREATE POLICY "Household members can view ratings" ON recipe_ratings
  FOR SELECT USING (
    recipe_id IN (SELECT id FROM recipes WHERE household_id = (select auth_user_household_id()))
  );

DROP POLICY IF EXISTS "Users can insert own ratings" ON recipe_ratings;
CREATE POLICY "Users can insert own ratings" ON recipe_ratings
  FOR INSERT WITH CHECK (
    profile_id = (select auth.uid())
    AND recipe_id IN (SELECT id FROM recipes WHERE household_id = (select auth_user_household_id()))
  );

DROP POLICY IF EXISTS "Users can update own ratings" ON recipe_ratings;
CREATE POLICY "Users can update own ratings" ON recipe_ratings
  FOR UPDATE USING (profile_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can delete own ratings" ON recipe_ratings;
CREATE POLICY "Users can delete own ratings" ON recipe_ratings
  FOR DELETE USING (profile_id = (select auth.uid()));

-- ---- TASTE_PREFERENCES ----
DROP POLICY IF EXISTS "Users can view household taste prefs" ON taste_preferences;
CREATE POLICY "Users can view household taste prefs" ON taste_preferences
  FOR SELECT USING (
    profile_id = (select auth.uid())
    OR profile_id IN (SELECT id FROM profiles WHERE household_id = (select auth_user_household_id()))
  );

DROP POLICY IF EXISTS "Users can insert own taste prefs" ON taste_preferences;
CREATE POLICY "Users can insert own taste prefs" ON taste_preferences
  FOR INSERT WITH CHECK (profile_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can update own taste prefs" ON taste_preferences;
CREATE POLICY "Users can update own taste prefs" ON taste_preferences
  FOR UPDATE USING (profile_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can delete own taste prefs" ON taste_preferences;
CREATE POLICY "Users can delete own taste prefs" ON taste_preferences
  FOR DELETE USING (profile_id = (select auth.uid()));

-- ---- CHAT_READ_STATUS ----
DROP POLICY IF EXISTS "Household members can view read status" ON chat_read_status;
CREATE POLICY "Household members can view read status" ON chat_read_status
  FOR SELECT USING (household_id = (select auth_user_household_id()));

DROP POLICY IF EXISTS "Users can insert own read status" ON chat_read_status;
CREATE POLICY "Users can insert own read status" ON chat_read_status
  FOR INSERT WITH CHECK (
    profile_id = (select auth.uid())
    AND household_id = (select auth_user_household_id())
  );

DROP POLICY IF EXISTS "Users can update own read status" ON chat_read_status;
CREATE POLICY "Users can update own read status" ON chat_read_status
  FOR UPDATE USING (profile_id = (select auth.uid()));

-- ---- MESSAGE_REACTIONS ----
DROP POLICY IF EXISTS "Household members can view reactions" ON message_reactions;
CREATE POLICY "Household members can view reactions" ON message_reactions
  FOR SELECT USING (
    message_id IN (SELECT id FROM messages WHERE household_id = (select auth_user_household_id()))
  );

DROP POLICY IF EXISTS "Users can add reactions" ON message_reactions;
CREATE POLICY "Users can add reactions" ON message_reactions
  FOR INSERT WITH CHECK (
    profile_id = (select auth.uid())
    AND message_id IN (SELECT id FROM messages WHERE household_id = (select auth_user_household_id()))
  );

DROP POLICY IF EXISTS "Users can remove own reactions" ON message_reactions;
CREATE POLICY "Users can remove own reactions" ON message_reactions
  FOR DELETE USING (profile_id = (select auth.uid()));

-- ---- AI_LOGS ----
DROP POLICY IF EXISTS "Household members can view ai logs" ON ai_logs;
CREATE POLICY "Household members can view ai logs" ON ai_logs
  FOR SELECT USING (household_id = (select auth_user_household_id()));

DROP POLICY IF EXISTS "Authenticated users can insert ai logs" ON ai_logs;
CREATE POLICY "Authenticated users can insert ai logs" ON ai_logs
  FOR INSERT WITH CHECK (
    profile_id = (select auth.uid())
  );

-- ---- STORAGE (recipe-images) ----
DROP POLICY IF EXISTS "Authenticated users can upload recipe images" ON storage.objects;
CREATE POLICY "Authenticated users can upload recipe images" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'recipe-images' AND (select auth.uid()) IS NOT NULL);

DROP POLICY IF EXISTS "Authenticated users can update recipe images" ON storage.objects;
CREATE POLICY "Authenticated users can update recipe images" ON storage.objects
  FOR UPDATE USING (bucket_id = 'recipe-images' AND (select auth.uid()) IS NOT NULL);

DROP POLICY IF EXISTS "Authenticated users can delete recipe images" ON storage.objects;
CREATE POLICY "Authenticated users can delete recipe images" ON storage.objects
  FOR DELETE USING (bucket_id = 'recipe-images' AND (select auth.uid()) IS NOT NULL);
