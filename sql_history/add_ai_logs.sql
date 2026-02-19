-- Migration : table de logs pour les interactions IA (Miam, scan, dictée)
-- Branche : feature/miam-orchestrator — 2026-02-19
-- À exécuter dans le SQL Editor de Supabase

CREATE TABLE IF NOT EXISTS ai_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id UUID REFERENCES households(id) ON DELETE CASCADE,
  profile_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  endpoint TEXT NOT NULL,           -- 'miam-orchestrator', 'scan-receipt', 'correct-transcription', etc.
  input JSONB,                      -- données envoyées à l'IA (sans binaires)
  output JSONB,                     -- réponse reçue
  duration_ms INTEGER,              -- durée de l'appel en millisecondes
  error TEXT,                       -- message d'erreur si échec
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE ai_logs ENABLE ROW LEVEL SECURITY;

-- Lecture ouverte aux membres du foyer (pour debug)
CREATE POLICY "ai_logs_select"
  ON ai_logs FOR SELECT
  USING (true);

-- Insertion ouverte (le client insère silencieusement)
CREATE POLICY "ai_logs_insert"
  ON ai_logs FOR INSERT
  WITH CHECK (true);

-- Index pour les requêtes de debug par foyer / endpoint
CREATE INDEX idx_ai_logs_household_id ON ai_logs(household_id);
CREATE INDEX idx_ai_logs_endpoint ON ai_logs(endpoint);
CREATE INDEX idx_ai_logs_created_at ON ai_logs(created_at DESC);
