CREATE TABLE message_reactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  emoji TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (message_id, profile_id, emoji)
);

ALTER TABLE message_reactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view reactions" ON message_reactions FOR SELECT USING (true);
CREATE POLICY "Anyone can add reactions" ON message_reactions FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can remove reactions" ON message_reactions FOR DELETE USING (true);
CREATE INDEX idx_message_reactions_message_id ON message_reactions(message_id);
ALTER PUBLICATION supabase_realtime ADD TABLE message_reactions;
