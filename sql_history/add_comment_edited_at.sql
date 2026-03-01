-- Add edited_at column to recipe_comments for tracking comment edits
ALTER TABLE recipe_comments
ADD COLUMN IF NOT EXISTS edited_at TIMESTAMPTZ;
