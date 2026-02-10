-- ============================================
-- FULL CHAT SETUP (CuisineDuo) - UPDATED V3
-- Includes explicit GRANTS to fix 401 Unauthorized errors
-- ============================================

-- 1. MESSAGES TABLE
CREATE TABLE IF NOT EXISTS messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  household_id UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  profile_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  content TEXT NOT NULL,
  is_ai BOOLEAN DEFAULT false,
  reply_to_id UUID REFERENCES messages(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Ensure reply_to_id exists
ALTER TABLE messages ADD COLUMN IF NOT EXISTS reply_to_id UUID REFERENCES messages(id) ON DELETE SET NULL;

-- Enable RLS
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- Policies
DROP POLICY IF EXISTS "Household members can view messages" ON messages;
CREATE POLICY "Household members can view messages" ON messages
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.household_id = messages.household_id
    )
  );

DROP POLICY IF EXISTS "Users can insert messages" ON messages;
CREATE POLICY "Users can insert messages" ON messages
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.household_id = messages.household_id
    )
  );

DROP POLICY IF EXISTS "Users can delete own messages" ON messages;
CREATE POLICY "Users can delete own messages" ON messages
  FOR DELETE USING (profile_id = auth.uid());


-- 2. MESSAGE REACTIONS TABLE
CREATE TABLE IF NOT EXISTS message_reactions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  message_id UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  emoji TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(message_id, profile_id, emoji)
);

ALTER TABLE message_reactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Household members can view reactions" ON message_reactions;
CREATE POLICY "Household members can view reactions" ON message_reactions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM messages m
      JOIN profiles p ON p.household_id = m.household_id
      WHERE m.id = message_reactions.message_id
      AND p.id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can add reactions" ON message_reactions;
CREATE POLICY "Users can add reactions" ON message_reactions
  FOR INSERT WITH CHECK (profile_id = auth.uid());

DROP POLICY IF EXISTS "Users can remove own reactions" ON message_reactions;
CREATE POLICY "Users can remove own reactions" ON message_reactions
  FOR DELETE USING (profile_id = auth.uid());


-- 3. CHAT READ CURSORS TABLE
CREATE TABLE IF NOT EXISTS chat_read_cursors (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  household_id UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  last_read_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(profile_id, household_id)
);

ALTER TABLE chat_read_cursors ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own read cursors" ON chat_read_cursors;
CREATE POLICY "Users can view own read cursors" ON chat_read_cursors
  FOR SELECT USING (profile_id = auth.uid());

DROP POLICY IF EXISTS "Users can upsert own read cursors" ON chat_read_cursors;
CREATE POLICY "Users can upsert own read cursors" ON chat_read_cursors
  FOR INSERT WITH CHECK (profile_id = auth.uid());

DROP POLICY IF EXISTS "Users can update own read cursors" ON chat_read_cursors;
CREATE POLICY "Users can update own read cursors" ON chat_read_cursors
  FOR UPDATE USING (profile_id = auth.uid());


-- 4. CRITICAL: GRANTS (Fixes 401 errors)
GRANT ALL ON TABLE messages TO authenticated;
GRANT ALL ON TABLE message_reactions TO authenticated;
GRANT ALL ON TABLE chat_read_cursors TO authenticated;
GRANT USAGE ON SCHEMA public TO authenticated;


-- 5. REALTIME CONFIGURATION
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'messages'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE messages;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'message_reactions'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE message_reactions;
  END IF;
END $$;
