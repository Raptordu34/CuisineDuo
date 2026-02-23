-- Fix search_path pour auth_user_household_id
CREATE OR REPLACE FUNCTION public.auth_user_household_id()
RETURNS UUID AS $$
SELECT household_id FROM public.profiles WHERE id = auth.uid()
$$ LANGUAGE sql SECURITY DEFINER STABLE
SET search_path = '';

-- Fix search_path pour handle_new_user
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
INSERT INTO public.profiles (id, display_name)
VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'display_name', 'Utilisateur')
);
RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = '';