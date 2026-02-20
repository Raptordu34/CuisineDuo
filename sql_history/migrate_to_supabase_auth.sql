-- ============================================
-- CuisineDuo — Migration vers Supabase Auth
-- Email + mot de passe
--
-- IMPORTANT : Ce script effectue un RESET COMPLET
-- des donnees. A executer dans le SQL Editor de Supabase.
--
-- PRE-REQUIS : Activer le provider Email dans
-- Authentication > Providers > Email sur le dashboard Supabase
--
-- STRUCTURE :
--   PARTIE 1 : Suppression de toutes les policies RLS existantes
--   PARTIE 2 : Truncate de toutes les donnees (reset complet)
--   PARTIE 3 : Modifications de schema
--   PARTIE 4 : Fonction helper auth_user_household_id()
--   PARTIE 5 : Nouvelles policies RLS avec auth.uid()
--   PARTIE 6 : Policies du storage
-- ============================================

-- ============================================
-- PARTIE 1 : SUPPRESSION DE TOUTES LES POLICIES RLS
-- ============================================

-- households
DROP POLICY IF EXISTS "Anyone can read households" ON households;
DROP POLICY IF EXISTS "Anyone can create a household" ON households;
DROP POLICY IF EXISTS "Anyone can update households" ON households;

-- profiles
DROP POLICY IF EXISTS "Anyone can read profiles" ON profiles;
DROP POLICY IF EXISTS "Anyone can create a profile" ON profiles;
DROP POLICY IF EXISTS "Anyone can update profiles" ON profiles;
DROP POLICY IF EXISTS "Anyone can delete profiles" ON profiles;

-- recipes
DROP POLICY IF EXISTS "Household members can view recipes" ON recipes;
DROP POLICY IF EXISTS "Household members can insert recipes" ON recipes;
DROP POLICY IF EXISTS "Household members can update recipes" ON recipes;
DROP POLICY IF EXISTS "Household members can delete recipes" ON recipes;

-- inventory_items
DROP POLICY IF EXISTS "Household members can view inventory" ON inventory_items;
DROP POLICY IF EXISTS "Household members can insert inventory" ON inventory_items;
DROP POLICY IF EXISTS "Household members can update inventory" ON inventory_items;
DROP POLICY IF EXISTS "Household members can delete inventory" ON inventory_items;

-- consumed_items
DROP POLICY IF EXISTS "Household members can view consumed items" ON consumed_items;
DROP POLICY IF EXISTS "Household members can insert consumed items" ON consumed_items;
DROP POLICY IF EXISTS "Household members can update consumed items" ON consumed_items;
DROP POLICY IF EXISTS "Household members can delete consumed items" ON consumed_items;

-- messages
DROP POLICY IF EXISTS "Household members can view messages" ON messages;
DROP POLICY IF EXISTS "Household members can insert messages" ON messages;
DROP POLICY IF EXISTS "Household members can update messages" ON messages;
DROP POLICY IF EXISTS "Household members can delete messages" ON messages;

-- recipe_comments
DROP POLICY IF EXISTS "Household members can view comments" ON recipe_comments;
DROP POLICY IF EXISTS "Household members can insert comments" ON recipe_comments;
DROP POLICY IF EXISTS "Household members can update comments" ON recipe_comments;
DROP POLICY IF EXISTS "Household members can delete comments" ON recipe_comments;

-- push_subscriptions
DROP POLICY IF EXISTS "Household members can view push subscriptions" ON push_subscriptions;
DROP POLICY IF EXISTS "Anyone can insert push subscriptions" ON push_subscriptions;
DROP POLICY IF EXISTS "Anyone can update push subscriptions" ON push_subscriptions;
DROP POLICY IF EXISTS "Anyone can delete push subscriptions" ON push_subscriptions;

-- swipe_sessions
DROP POLICY IF EXISTS "Household members can view swipe sessions" ON swipe_sessions;
DROP POLICY IF EXISTS "Household members can insert swipe sessions" ON swipe_sessions;
DROP POLICY IF EXISTS "Household members can update swipe sessions" ON swipe_sessions;
DROP POLICY IF EXISTS "Household members can delete swipe sessions" ON swipe_sessions;

-- swipe_session_recipes
DROP POLICY IF EXISTS "Household members can view session recipes" ON swipe_session_recipes;
DROP POLICY IF EXISTS "Household members can insert session recipes" ON swipe_session_recipes;
DROP POLICY IF EXISTS "Household members can update session recipes" ON swipe_session_recipes;
DROP POLICY IF EXISTS "Household members can delete session recipes" ON swipe_session_recipes;

-- swipe_votes
DROP POLICY IF EXISTS "Household members can view votes" ON swipe_votes;
DROP POLICY IF EXISTS "Household members can insert votes" ON swipe_votes;
DROP POLICY IF EXISTS "Household members can update votes" ON swipe_votes;
DROP POLICY IF EXISTS "Household members can delete votes" ON swipe_votes;

-- shopping_lists
DROP POLICY IF EXISTS "Household members can view shopping lists" ON shopping_lists;
DROP POLICY IF EXISTS "Household members can insert shopping lists" ON shopping_lists;
DROP POLICY IF EXISTS "Household members can update shopping lists" ON shopping_lists;
DROP POLICY IF EXISTS "Household members can delete shopping lists" ON shopping_lists;

-- shopping_list_items
DROP POLICY IF EXISTS "Household members can view shopping list items" ON shopping_list_items;
DROP POLICY IF EXISTS "Household members can insert shopping list items" ON shopping_list_items;
DROP POLICY IF EXISTS "Household members can update shopping list items" ON shopping_list_items;
DROP POLICY IF EXISTS "Household members can delete shopping list items" ON shopping_list_items;

-- cooking_history
DROP POLICY IF EXISTS "Household members can view cooking history" ON cooking_history;
DROP POLICY IF EXISTS "Household members can insert cooking history" ON cooking_history;
DROP POLICY IF EXISTS "Household members can update cooking history" ON cooking_history;
DROP POLICY IF EXISTS "Household members can delete cooking history" ON cooking_history;

-- recipe_taste_params
DROP POLICY IF EXISTS "Users can view taste params" ON recipe_taste_params;
DROP POLICY IF EXISTS "Users can insert taste params" ON recipe_taste_params;
DROP POLICY IF EXISTS "Users can update taste params" ON recipe_taste_params;
DROP POLICY IF EXISTS "Users can delete taste params" ON recipe_taste_params;

-- recipe_ratings
DROP POLICY IF EXISTS "Users can view ratings" ON recipe_ratings;
DROP POLICY IF EXISTS "Users can insert ratings" ON recipe_ratings;
DROP POLICY IF EXISTS "Users can update ratings" ON recipe_ratings;
DROP POLICY IF EXISTS "Users can delete ratings" ON recipe_ratings;

-- taste_preferences
DROP POLICY IF EXISTS "Users can view taste preferences" ON taste_preferences;
DROP POLICY IF EXISTS "Users can insert taste preferences" ON taste_preferences;
DROP POLICY IF EXISTS "Users can update taste preferences" ON taste_preferences;
DROP POLICY IF EXISTS "Users can delete taste preferences" ON taste_preferences;

-- chat_read_status
DROP POLICY IF EXISTS "Household members can view read status" ON chat_read_status;
DROP POLICY IF EXISTS "Users can insert their own read status" ON chat_read_status;
DROP POLICY IF EXISTS "Users can update their own read status" ON chat_read_status;

-- message_reactions
DROP POLICY IF EXISTS "Anyone can view reactions" ON message_reactions;
DROP POLICY IF EXISTS "Anyone can add reactions" ON message_reactions;
DROP POLICY IF EXISTS "Anyone can remove reactions" ON message_reactions;

-- ai_logs
DROP POLICY IF EXISTS "ai_logs_select" ON ai_logs;
DROP POLICY IF EXISTS "ai_logs_insert" ON ai_logs;

-- storage
DROP POLICY IF EXISTS "Anyone can upload recipe images" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can update recipe images" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can delete recipe images" ON storage.objects;

-- ============================================
-- PARTIE 2 : TRUNCATE DE TOUTES LES DONNEES
-- (Reset complet — tous les utilisateurs recreent un compte)
-- ============================================

TRUNCATE TABLE ai_logs CASCADE;
TRUNCATE TABLE message_reactions CASCADE;
TRUNCATE TABLE chat_read_status CASCADE;
TRUNCATE TABLE swipe_votes CASCADE;
TRUNCATE TABLE swipe_session_recipes CASCADE;
TRUNCATE TABLE swipe_sessions CASCADE;
TRUNCATE TABLE shopping_list_items CASCADE;
TRUNCATE TABLE shopping_lists CASCADE;
TRUNCATE TABLE cooking_history CASCADE;
TRUNCATE TABLE recipe_taste_params CASCADE;
TRUNCATE TABLE recipe_ratings CASCADE;
TRUNCATE TABLE recipe_comments CASCADE;
TRUNCATE TABLE taste_preferences CASCADE;
TRUNCATE TABLE push_subscriptions CASCADE;
TRUNCATE TABLE consumed_items CASCADE;
TRUNCATE TABLE inventory_items CASCADE;
TRUNCATE TABLE messages CASCADE;
TRUNCATE TABLE recipes CASCADE;
TRUNCATE TABLE profiles CASCADE;
TRUNCATE TABLE households CASCADE;

-- ============================================
-- PARTIE 3 : MODIFICATIONS DE SCHEMA
-- ============================================

-- profiles.id ne doit plus etre auto-genere
-- Il sera explicitement = auth.uid() lors de l'inscription
ALTER TABLE profiles ALTER COLUMN id DROP DEFAULT;

-- ============================================
-- PARTIE 4 : FONCTION HELPER
-- Retourne le household_id de l'utilisateur authentifie
-- ============================================

CREATE OR REPLACE FUNCTION auth_user_household_id()
RETURNS UUID AS $$
  SELECT household_id FROM profiles WHERE id = auth.uid()
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ============================================
-- PARTIE 5 : NOUVELLES POLICIES RLS
-- Toutes basees sur auth.uid() et auth_user_household_id()
-- ============================================

-- ---- HOUSEHOLDS ----
-- Lecture ouverte aux utilisateurs authentifies (necessaire pour le join par code d'invitation)
CREATE POLICY "Authenticated users can read households" ON households
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can create households" ON households
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Members can update their household" ON households
  FOR UPDATE USING (id = auth_user_household_id());

-- ---- PROFILES ----
-- Un utilisateur peut voir les profils de son foyer + le sien
CREATE POLICY "Users can view household profiles" ON profiles
  FOR SELECT USING (
    id = auth.uid()
    OR household_id = auth_user_household_id()
  );

-- Un utilisateur ne peut creer que son propre profil (id = auth.uid())
CREATE POLICY "Users can create own profile" ON profiles
  FOR INSERT WITH CHECK (id = auth.uid());

CREATE POLICY "Users can update own profile" ON profiles
  FOR UPDATE USING (id = auth.uid());

CREATE POLICY "Users can delete own profile" ON profiles
  FOR DELETE USING (id = auth.uid());

-- ---- RECIPES ----
CREATE POLICY "Household members can view recipes" ON recipes
  FOR SELECT USING (household_id = auth_user_household_id());

CREATE POLICY "Household members can insert recipes" ON recipes
  FOR INSERT WITH CHECK (
    household_id = auth_user_household_id()
    AND created_by = auth.uid()
  );

CREATE POLICY "Household members can update recipes" ON recipes
  FOR UPDATE USING (household_id = auth_user_household_id());

CREATE POLICY "Household members can delete recipes" ON recipes
  FOR DELETE USING (household_id = auth_user_household_id());

-- ---- INVENTORY_ITEMS ----
CREATE POLICY "Household members can view inventory" ON inventory_items
  FOR SELECT USING (household_id = auth_user_household_id());

CREATE POLICY "Household members can insert inventory" ON inventory_items
  FOR INSERT WITH CHECK (
    household_id = auth_user_household_id()
    AND added_by = auth.uid()
  );

CREATE POLICY "Household members can update inventory" ON inventory_items
  FOR UPDATE USING (household_id = auth_user_household_id());

CREATE POLICY "Household members can delete inventory" ON inventory_items
  FOR DELETE USING (household_id = auth_user_household_id());

-- ---- CONSUMED_ITEMS ----
CREATE POLICY "Household members can view consumed items" ON consumed_items
  FOR SELECT USING (household_id = auth_user_household_id());

CREATE POLICY "Household members can insert consumed items" ON consumed_items
  FOR INSERT WITH CHECK (
    household_id = auth_user_household_id()
    AND consumed_by = auth.uid()
  );

CREATE POLICY "Household members can update consumed items" ON consumed_items
  FOR UPDATE USING (household_id = auth_user_household_id());

CREATE POLICY "Household members can delete consumed items" ON consumed_items
  FOR DELETE USING (household_id = auth_user_household_id());

-- ---- MESSAGES ----
CREATE POLICY "Household members can view messages" ON messages
  FOR SELECT USING (household_id = auth_user_household_id());

CREATE POLICY "Household members can insert messages" ON messages
  FOR INSERT WITH CHECK (
    household_id = auth_user_household_id()
    AND profile_id = auth.uid()
  );

CREATE POLICY "Users can update own messages" ON messages
  FOR UPDATE USING (
    household_id = auth_user_household_id()
    AND profile_id = auth.uid()
  );

CREATE POLICY "Users can delete own messages" ON messages
  FOR DELETE USING (
    household_id = auth_user_household_id()
    AND profile_id = auth.uid()
  );

-- ---- RECIPE_COMMENTS ----
CREATE POLICY "Household members can view comments" ON recipe_comments
  FOR SELECT USING (
    recipe_id IN (SELECT id FROM recipes WHERE household_id = auth_user_household_id())
  );

CREATE POLICY "Household members can insert comments" ON recipe_comments
  FOR INSERT WITH CHECK (
    profile_id = auth.uid()
    AND recipe_id IN (SELECT id FROM recipes WHERE household_id = auth_user_household_id())
  );

CREATE POLICY "Users can update own comments" ON recipe_comments
  FOR UPDATE USING (profile_id = auth.uid());

CREATE POLICY "Users can delete own comments" ON recipe_comments
  FOR DELETE USING (profile_id = auth.uid());

-- ---- PUSH_SUBSCRIPTIONS ----
CREATE POLICY "Users can view own push subscriptions" ON push_subscriptions
  FOR SELECT USING (profile_id = auth.uid());

CREATE POLICY "Users can insert own push subscriptions" ON push_subscriptions
  FOR INSERT WITH CHECK (
    profile_id = auth.uid()
    AND household_id = auth_user_household_id()
  );

CREATE POLICY "Users can update own push subscriptions" ON push_subscriptions
  FOR UPDATE USING (profile_id = auth.uid());

CREATE POLICY "Users can delete own push subscriptions" ON push_subscriptions
  FOR DELETE USING (profile_id = auth.uid());

-- ---- SWIPE_SESSIONS ----
CREATE POLICY "Household members can view swipe sessions" ON swipe_sessions
  FOR SELECT USING (household_id = auth_user_household_id());

CREATE POLICY "Household members can insert swipe sessions" ON swipe_sessions
  FOR INSERT WITH CHECK (
    household_id = auth_user_household_id()
    AND created_by = auth.uid()
  );

CREATE POLICY "Household members can update swipe sessions" ON swipe_sessions
  FOR UPDATE USING (household_id = auth_user_household_id());

CREATE POLICY "Household members can delete swipe sessions" ON swipe_sessions
  FOR DELETE USING (household_id = auth_user_household_id());

-- ---- SWIPE_SESSION_RECIPES ----
CREATE POLICY "Household members can view session recipes" ON swipe_session_recipes
  FOR SELECT USING (
    session_id IN (SELECT id FROM swipe_sessions WHERE household_id = auth_user_household_id())
  );

CREATE POLICY "Household members can insert session recipes" ON swipe_session_recipes
  FOR INSERT WITH CHECK (
    session_id IN (SELECT id FROM swipe_sessions WHERE household_id = auth_user_household_id())
  );

CREATE POLICY "Household members can update session recipes" ON swipe_session_recipes
  FOR UPDATE USING (
    session_id IN (SELECT id FROM swipe_sessions WHERE household_id = auth_user_household_id())
  );

CREATE POLICY "Household members can delete session recipes" ON swipe_session_recipes
  FOR DELETE USING (
    session_id IN (SELECT id FROM swipe_sessions WHERE household_id = auth_user_household_id())
  );

-- ---- SWIPE_VOTES ----
CREATE POLICY "Household members can view votes" ON swipe_votes
  FOR SELECT USING (
    session_recipe_id IN (
      SELECT sr.id FROM swipe_session_recipes sr
      JOIN swipe_sessions s ON sr.session_id = s.id
      WHERE s.household_id = auth_user_household_id()
    )
  );

CREATE POLICY "Users can insert own votes" ON swipe_votes
  FOR INSERT WITH CHECK (
    profile_id = auth.uid()
    AND session_recipe_id IN (
      SELECT sr.id FROM swipe_session_recipes sr
      JOIN swipe_sessions s ON sr.session_id = s.id
      WHERE s.household_id = auth_user_household_id()
    )
  );

CREATE POLICY "Users can update own votes" ON swipe_votes
  FOR UPDATE USING (profile_id = auth.uid());

CREATE POLICY "Users can delete own votes" ON swipe_votes
  FOR DELETE USING (profile_id = auth.uid());

-- ---- SHOPPING_LISTS ----
CREATE POLICY "Household members can view shopping lists" ON shopping_lists
  FOR SELECT USING (household_id = auth_user_household_id());

CREATE POLICY "Household members can insert shopping lists" ON shopping_lists
  FOR INSERT WITH CHECK (
    household_id = auth_user_household_id()
    AND created_by = auth.uid()
  );

CREATE POLICY "Household members can update shopping lists" ON shopping_lists
  FOR UPDATE USING (household_id = auth_user_household_id());

CREATE POLICY "Household members can delete shopping lists" ON shopping_lists
  FOR DELETE USING (household_id = auth_user_household_id());

-- ---- SHOPPING_LIST_ITEMS ----
CREATE POLICY "Household members can view shopping list items" ON shopping_list_items
  FOR SELECT USING (
    list_id IN (SELECT id FROM shopping_lists WHERE household_id = auth_user_household_id())
  );

CREATE POLICY "Household members can insert shopping list items" ON shopping_list_items
  FOR INSERT WITH CHECK (
    list_id IN (SELECT id FROM shopping_lists WHERE household_id = auth_user_household_id())
  );

CREATE POLICY "Household members can update shopping list items" ON shopping_list_items
  FOR UPDATE USING (
    list_id IN (SELECT id FROM shopping_lists WHERE household_id = auth_user_household_id())
  );

CREATE POLICY "Household members can delete shopping list items" ON shopping_list_items
  FOR DELETE USING (
    list_id IN (SELECT id FROM shopping_lists WHERE household_id = auth_user_household_id())
  );

-- ---- COOKING_HISTORY ----
CREATE POLICY "Household members can view cooking history" ON cooking_history
  FOR SELECT USING (household_id = auth_user_household_id());

CREATE POLICY "Household members can insert cooking history" ON cooking_history
  FOR INSERT WITH CHECK (
    household_id = auth_user_household_id()
    AND cooked_by = auth.uid()
  );

CREATE POLICY "Household members can update cooking history" ON cooking_history
  FOR UPDATE USING (household_id = auth_user_household_id());

CREATE POLICY "Household members can delete cooking history" ON cooking_history
  FOR DELETE USING (household_id = auth_user_household_id());

-- ---- RECIPE_TASTE_PARAMS ----
CREATE POLICY "Household members can view taste params" ON recipe_taste_params
  FOR SELECT USING (
    recipe_id IN (SELECT id FROM recipes WHERE household_id = auth_user_household_id())
  );

CREATE POLICY "Household members can insert taste params" ON recipe_taste_params
  FOR INSERT WITH CHECK (
    recipe_id IN (SELECT id FROM recipes WHERE household_id = auth_user_household_id())
  );

CREATE POLICY "Household members can update taste params" ON recipe_taste_params
  FOR UPDATE USING (
    recipe_id IN (SELECT id FROM recipes WHERE household_id = auth_user_household_id())
  );

CREATE POLICY "Household members can delete taste params" ON recipe_taste_params
  FOR DELETE USING (
    recipe_id IN (SELECT id FROM recipes WHERE household_id = auth_user_household_id())
  );

-- ---- RECIPE_RATINGS ----
CREATE POLICY "Household members can view ratings" ON recipe_ratings
  FOR SELECT USING (
    recipe_id IN (SELECT id FROM recipes WHERE household_id = auth_user_household_id())
  );

CREATE POLICY "Users can insert own ratings" ON recipe_ratings
  FOR INSERT WITH CHECK (
    profile_id = auth.uid()
    AND recipe_id IN (SELECT id FROM recipes WHERE household_id = auth_user_household_id())
  );

CREATE POLICY "Users can update own ratings" ON recipe_ratings
  FOR UPDATE USING (profile_id = auth.uid());

CREATE POLICY "Users can delete own ratings" ON recipe_ratings
  FOR DELETE USING (profile_id = auth.uid());

-- ---- TASTE_PREFERENCES ----
CREATE POLICY "Users can view household taste prefs" ON taste_preferences
  FOR SELECT USING (
    profile_id = auth.uid()
    OR profile_id IN (SELECT id FROM profiles WHERE household_id = auth_user_household_id())
  );

CREATE POLICY "Users can insert own taste prefs" ON taste_preferences
  FOR INSERT WITH CHECK (profile_id = auth.uid());

CREATE POLICY "Users can update own taste prefs" ON taste_preferences
  FOR UPDATE USING (profile_id = auth.uid());

CREATE POLICY "Users can delete own taste prefs" ON taste_preferences
  FOR DELETE USING (profile_id = auth.uid());

-- ---- CHAT_READ_STATUS ----
CREATE POLICY "Household members can view read status" ON chat_read_status
  FOR SELECT USING (household_id = auth_user_household_id());

CREATE POLICY "Users can insert own read status" ON chat_read_status
  FOR INSERT WITH CHECK (
    profile_id = auth.uid()
    AND household_id = auth_user_household_id()
  );

CREATE POLICY "Users can update own read status" ON chat_read_status
  FOR UPDATE USING (profile_id = auth.uid());

-- ---- MESSAGE_REACTIONS ----
CREATE POLICY "Household members can view reactions" ON message_reactions
  FOR SELECT USING (
    message_id IN (SELECT id FROM messages WHERE household_id = auth_user_household_id())
  );

CREATE POLICY "Users can add reactions" ON message_reactions
  FOR INSERT WITH CHECK (
    profile_id = auth.uid()
    AND message_id IN (SELECT id FROM messages WHERE household_id = auth_user_household_id())
  );

CREATE POLICY "Users can remove own reactions" ON message_reactions
  FOR DELETE USING (profile_id = auth.uid());

-- ---- AI_LOGS ----
CREATE POLICY "Household members can view ai logs" ON ai_logs
  FOR SELECT USING (household_id = auth_user_household_id());

CREATE POLICY "Authenticated users can insert ai logs" ON ai_logs
  FOR INSERT WITH CHECK (
    profile_id = auth.uid()
  );

-- ============================================
-- PARTIE 6 : POLICIES DU STORAGE
-- Lecture publique conservee, ecritures restreintes aux authentifies
-- ============================================

-- La policy de lecture publique reste inchangee (pas besoin de la recréer)
-- "Public read access" ON storage.objects

CREATE POLICY "Authenticated users can upload recipe images" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'recipe-images' AND auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update recipe images" ON storage.objects
  FOR UPDATE USING (bucket_id = 'recipe-images' AND auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can delete recipe images" ON storage.objects
  FOR DELETE USING (bucket_id = 'recipe-images' AND auth.uid() IS NOT NULL);

-- ============================================
-- PARTIE 7 : TRIGGER AUTO-CREATION DU PROFIL
-- Cree automatiquement une ligne dans profiles
-- quand un utilisateur s'inscrit via Supabase Auth.
-- Le display_name est passe via raw_user_meta_data.
-- ============================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'display_name', 'Utilisateur')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Supprimer le trigger s'il existe deja
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================
-- FIN — Migration vers Supabase Auth terminee
-- ============================================
