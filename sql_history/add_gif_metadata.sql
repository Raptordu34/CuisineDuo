-- Ajouter les metadonnees GIF aux messages pour l'IA et l'historique
ALTER TABLE messages ADD COLUMN gif_title TEXT;
ALTER TABLE messages ADD COLUMN giphy_id TEXT;

-- Index pour accelerer les requetes d'historique GIF par utilisateur
CREATE INDEX idx_messages_gif_history
ON messages(profile_id, message_type, created_at DESC)
WHERE message_type = 'gif';
