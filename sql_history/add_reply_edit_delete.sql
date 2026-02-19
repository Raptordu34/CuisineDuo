-- Migration : ajout des colonnes reply, soft delete et edit sur la table messages

ALTER TABLE messages ADD COLUMN IF NOT EXISTS reply_to_id UUID REFERENCES messages(id) ON DELETE SET NULL;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS edited_at TIMESTAMPTZ;

-- Index pour améliorer les requêtes de lookup par reply_to_id
CREATE INDEX IF NOT EXISTS idx_messages_reply_to_id ON messages(reply_to_id);
