-- Vérifier les tables dans la publication Realtime
select
  schemaname,
  tablename
from
  pg_publication_tables
where
  pubname = 'supabase_realtime';