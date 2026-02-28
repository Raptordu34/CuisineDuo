-- Add name_translations column to inventory_items and consumed_items
ALTER TABLE public.inventory_items ADD COLUMN IF NOT EXISTS name_translations JSONB DEFAULT '{}'::jsonb;
ALTER TABLE public.consumed_items ADD COLUMN IF NOT EXISTS name_translations JSONB DEFAULT '{}'::jsonb;
