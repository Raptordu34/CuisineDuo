-- Add translations JSONB column to recipes table
-- Format: { "fr": { "name": "...", "description": "...", "ingredients": [...], "steps": [...], "tips": [...] }, "en": { ... }, "zh": { ... } }
ALTER TABLE public.recipes ADD COLUMN IF NOT EXISTS translations JSONB DEFAULT '{}'::jsonb;
