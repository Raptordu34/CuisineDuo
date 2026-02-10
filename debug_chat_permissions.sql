-- DÉBUT DU SCRIPT DE DEBUG --

-- 1. Accorder tous les droits aux utilisateurs authentifiés sur les tables
GRANT ALL ON TABLE messages TO authenticated;
GRANT ALL ON TABLE message_reactions TO authenticated;
GRANT ALL ON TABLE chat_read_cursors TO authenticated;

-- 2. Supprimer les anciennes politiques strictes pour éviter les conflits
DROP POLICY IF EXISTS "Users can upsert own read cursors" ON chat_read_cursors;
DROP POLICY IF EXISTS "Users can add reactions" ON message_reactions;
DROP POLICY IF EXISTS "Users can insert messages" ON messages;
DROP POLICY IF EXISTS "Household members can view messages" ON messages;
DROP POLICY IF EXISTS "Users can delete own messages" ON messages;
DROP POLICY IF EXISTS "Household members can view reactions" ON message_reactions;
DROP POLICY IF EXISTS "Users can remove own reactions" ON message_reactions;
DROP POLICY IF EXISTS "Users can view own read cursors" ON chat_read_cursors;
DROP POLICY IF EXISTS "Users can update own read cursors" ON chat_read_cursors;

-- 3. Créer des politiques permissives (DEBUG)
-- Pour les curseurs de lecture : tout le monde authentifié peut tout faire
CREATE POLICY "Debug: Allow all on cursors" ON chat_read_cursors
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Pour les réactions : tout le monde authentifié peut tout faire
CREATE POLICY "Debug: Allow all on reactions" ON message_reactions
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Pour les messages : tout le monde authentifié peut tout faire
CREATE POLICY "Debug: Allow all on messages" ON messages
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- 4. Vérification de la configuration Realtime
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE tablename = 'messages') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE messages;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE tablename = 'message_reactions') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE message_reactions;
  END IF;
END $$;
