-- ============================================
-- Chat Improvements Migration
-- ============================================

-- 1. Add reply_to_id to messages table
ALTER TABLE messages ADD COLUMN IF NOT EXISTS reply_to_id UUID REFERENCES messages(id) ON DELETE SET NULL;

-- 2. Create message_reactions table
CREATE TABLE IF NOT EXISTS message_reactions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  message_id UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  emoji TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(message_id, profile_id, emoji)
);

-- Enable RLS on message_reactions
ALTER TABLE message_reactions ENABLE ROW LEVEL SECURITY;

-- Policy: members of the household can read reactions on their messages
CREATE POLICY "Household members can view reactions" ON message_reactions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM messages m
      JOIN profiles p ON p.household_id = m.household_id
      WHERE m.id = message_reactions.message_id
      AND p.id = auth.uid()
    )
  );

-- Policy: users can insert their own reactions
CREATE POLICY "Users can add reactions" ON message_reactions
  FOR INSERT WITH CHECK (profile_id = auth.uid());

-- Policy: users can delete their own reactions
CREATE POLICY "Users can remove own reactions" ON message_reactions
  FOR DELETE USING (profile_id = auth.uid());

-- 3. Create chat_read_cursors table
CREATE TABLE IF NOT EXISTS chat_read_cursors (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  household_id UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  last_read_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(profile_id, household_id)
);

-- Enable RLS on chat_read_cursors
ALTER TABLE chat_read_cursors ENABLE ROW LEVEL SECURITY;

-- Policy: users can read their own cursors
CREATE POLICY "Users can view own read cursors" ON chat_read_cursors
  FOR SELECT USING (profile_id = auth.uid());

-- Policy: users can upsert their own cursors
CREATE POLICY "Users can upsert own read cursors" ON chat_read_cursors
  FOR INSERT WITH CHECK (profile_id = auth.uid());

CREATE POLICY "Users can update own read cursors" ON chat_read_cursors
  FOR UPDATE USING (profile_id = auth.uid());

-- Enable realtime for new tables
ALTER PUBLICATION supabase_realtime ADD TABLE message_reactions;
