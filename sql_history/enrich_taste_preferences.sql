-- Enrichissement de la table taste_preferences
-- Ajout des colonnes pour ingredients bannis, restrictions alimentaires et notes

ALTER TABLE taste_preferences
  ADD COLUMN IF NOT EXISTS banned_ingredients JSONB DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS dietary_restrictions JSONB DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS additional_notes TEXT;

-- S'assurer que updated_at existe deja (present dans init_schema)
-- Mise a jour des policies RLS pour scoper par profil

-- Supprimer les anciennes policies trop permissives
DROP POLICY IF EXISTS "Users can view taste preferences" ON taste_preferences;
DROP POLICY IF EXISTS "Users can insert taste preferences" ON taste_preferences;
DROP POLICY IF EXISTS "Users can update taste preferences" ON taste_preferences;
DROP POLICY IF EXISTS "Users can delete taste preferences" ON taste_preferences;

-- Nouvelles policies scopees
CREATE POLICY "Users can view household taste preferences" ON taste_preferences
  FOR SELECT USING (
    profile_id IN (
      SELECT id FROM profiles WHERE household_id = auth_user_household_id()
    )
  );

CREATE POLICY "Users can insert own taste preferences" ON taste_preferences
  FOR INSERT WITH CHECK (profile_id = auth.uid());

CREATE POLICY "Users can update own taste preferences" ON taste_preferences
  FOR UPDATE USING (profile_id = auth.uid());

CREATE POLICY "Users can delete own taste preferences" ON taste_preferences
  FOR DELETE USING (profile_id = auth.uid());
