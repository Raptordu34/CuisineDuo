-- Table pour tracker le statut de lecture du chat par profil
create table chat_read_status (
  id UUID primary key default gen_random_uuid(),
  profile_id UUID not null references profiles(id) on delete cascade,
  household_id UUID not null references households(id) on delete cascade,
  last_read_at TIMESTAMPTZ not null default now(),
  created_at TIMESTAMPTZ default now(),
  unique(profile_id, household_id)
);

alter table chat_read_status enable row level security;

create policy "Household members can view read status"
  on chat_read_status for select
  using (
    household_id in (
      select household_id from profiles
    )
  );

create policy "Users can insert their own read status"
  on chat_read_status for insert
  with check (
    household_id in (
      select household_id from profiles
    )
  );

create policy "Users can update their own read status"
  on chat_read_status for update
  using (
    household_id in (
      select household_id from profiles
    )
  );

alter publication supabase_realtime add table chat_read_status;
