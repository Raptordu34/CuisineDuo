-- ============================================
-- CuisineDuo — Script complet de création de la base de données
-- À exécuter dans le SQL Editor de Supabase
--
-- STRUCTURE :
--   PARTIE 1 : Création de toutes les tables
--   PARTIE 2 : Activation du RLS
--   PARTIE 3 : Création de toutes les policies
--   PARTIE 4 : Realtime
-- ============================================
-- ============================================
-- PARTIE 1 : CRÉATION DES TABLES
-- ============================================
-- 1. HOUSEHOLDS
create table households (
  id UUID primary key default gen_random_uuid (),
  name TEXT not null,
  invite_code TEXT unique default lower(substr(md5(random()::text), 1, 6)),
  created_at TIMESTAMPTZ default now()
);

-- 2. PROFILES
create table profiles (
  id UUID primary key default gen_random_uuid (),
  display_name TEXT not null,
  household_id UUID references households (id) on delete set null,
  created_at TIMESTAMPTZ default now()
);

-- 3. RECIPES
create table recipes (
  id UUID primary key default gen_random_uuid (),
  household_id UUID not null references households (id) on delete CASCADE,
  created_by UUID not null references profiles (id) on delete CASCADE,
  name TEXT not null,
  description TEXT,
  category TEXT,
  servings SMALLINT,
  prep_time SMALLINT,
  cook_time SMALLINT,
  difficulty TEXT,
  equipment JSONB default '[]'::jsonb,
  ingredients JSONB default '[]'::jsonb,
  steps JSONB default '[]'::jsonb,
  tips JSONB default '[]'::jsonb,
  image_url TEXT,
  image_source TEXT default 'none',
  created_at TIMESTAMPTZ default now(),
  updated_at TIMESTAMPTZ default now()
);

-- 4. INVENTORY_ITEMS
create table inventory_items (
  id UUID primary key default gen_random_uuid (),
  household_id UUID not null references households (id) on delete CASCADE,
  added_by UUID not null references profiles (id) on delete CASCADE,
  name TEXT not null,
  brand TEXT,
  quantity NUMERIC not null default 1,
  unit TEXT not null default 'piece',
  price NUMERIC,
  price_per_kg NUMERIC,
  price_estimated BOOLEAN default false,
  category TEXT not null default 'other',
  purchase_date DATE,
  estimated_expiry_date DATE,
  fill_level SMALLINT default 1,
  store TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ default now()
);

-- 5. CONSUMED_ITEMS
create table consumed_items (
  id UUID primary key default gen_random_uuid (),
  household_id UUID not null references households (id) on delete CASCADE,
  consumed_by UUID not null references profiles (id) on delete CASCADE,
  added_by UUID references profiles (id) on delete set null,
  name TEXT not null,
  brand TEXT,
  quantity NUMERIC,
  unit TEXT,
  price NUMERIC,
  price_per_kg NUMERIC,
  price_estimated BOOLEAN default false,
  category TEXT,
  purchase_date DATE,
  consumption_date DATE default CURRENT_DATE,
  store TEXT,
  notes TEXT,
  fill_level SMALLINT default 1,
  created_at TIMESTAMPTZ default now()
);

-- 6. MESSAGES
create table messages (
  id UUID primary key default gen_random_uuid (),
  household_id UUID not null references households (id) on delete CASCADE,
  profile_id UUID not null references profiles (id) on delete CASCADE,
  content TEXT not null,
  is_ai BOOLEAN default false,
  created_at TIMESTAMPTZ default now()
);

-- 7. RECIPE_COMMENTS
create table recipe_comments (
  id UUID primary key default gen_random_uuid (),
  recipe_id UUID not null references recipes (id) on delete CASCADE,
  profile_id UUID not null references profiles (id) on delete CASCADE,
  content TEXT not null,
  created_at TIMESTAMPTZ default now()
);

-- 8. PUSH_SUBSCRIPTIONS
create table push_subscriptions (
  id UUID primary key default gen_random_uuid (),
  profile_id UUID not null references profiles (id) on delete CASCADE,
  household_id UUID not null references households (id) on delete CASCADE,
  subscription JSONB not null,
  created_at TIMESTAMPTZ default now()
);

create unique INDEX push_subscriptions_profile_endpoint_idx on push_subscriptions (profile_id, (subscription ->> 'endpoint'));

-- 9. SWIPE_SESSIONS
create table swipe_sessions (
  id UUID primary key default gen_random_uuid (),
  household_id UUID not null references households (id) on delete CASCADE,
  created_by UUID not null references profiles (id) on delete CASCADE,
  title TEXT not null default '',
  meal_count SMALLINT not null default 7,
  meal_types text[] not null default '{}',
  status TEXT not null default 'generating' check (
    status in ('generating', 'voting', 'completed', 'cancelled')
  ),
  created_at TIMESTAMPTZ default now(),
  updated_at TIMESTAMPTZ default now()
);

-- 10. SWIPE_SESSION_RECIPES
create table swipe_session_recipes (
  id UUID primary key default gen_random_uuid (),
  session_id UUID not null references swipe_sessions (id) on delete CASCADE,
  recipe_id UUID references recipes (id) on delete set null,
  name TEXT not null,
  description TEXT,
  category TEXT,
  image_url TEXT,
  difficulty TEXT,
  prep_time SMALLINT,
  cook_time SMALLINT,
  servings SMALLINT,
  ai_recipe_data JSONB,
  is_existing_recipe BOOLEAN not null default false,
  sort_order SMALLINT not null default 0,
  created_at TIMESTAMPTZ default now()
);

-- 11. SWIPE_VOTES
create table swipe_votes (
  id UUID primary key default gen_random_uuid (),
  session_recipe_id UUID not null references swipe_session_recipes (id) on delete CASCADE,
  profile_id UUID not null references profiles (id) on delete CASCADE,
  vote BOOLEAN not null,
  created_at TIMESTAMPTZ default now(),
  unique (session_recipe_id, profile_id)
);

-- 12. SHOPPING_LISTS
create table shopping_lists (
  id UUID primary key default gen_random_uuid (),
  household_id UUID not null references households (id) on delete CASCADE,
  name TEXT not null default '',
  session_id UUID references swipe_sessions (id) on delete set null,
  status TEXT not null default 'active' check (status in ('active', 'completed', 'archived')),
  created_by UUID not null references profiles (id) on delete CASCADE,
  created_at TIMESTAMPTZ default now(),
  updated_at TIMESTAMPTZ default now()
);

-- 13. SHOPPING_LIST_ITEMS
create table shopping_list_items (
  id UUID primary key default gen_random_uuid (),
  list_id UUID not null references shopping_lists (id) on delete CASCADE,
  name TEXT not null,
  quantity NUMERIC,
  unit TEXT,
  category TEXT,
  recipe_name TEXT,
  checked BOOLEAN not null default false,
  checked_by UUID references profiles (id) on delete set null,
  checked_at TIMESTAMPTZ,
  notes TEXT,
  sort_order SMALLINT not null default 0,
  created_at TIMESTAMPTZ default now()
);

-- 14. COOKING_HISTORY
create table cooking_history (
  id UUID primary key default gen_random_uuid (),
  recipe_id UUID not null references recipes (id) on delete CASCADE,
  household_id UUID not null references households (id) on delete CASCADE,
  cooked_by UUID not null references profiles (id) on delete CASCADE,
  cooked_at TIMESTAMPTZ not null default now(),
  notes TEXT,
  servings_cooked SMALLINT,
  created_at TIMESTAMPTZ default now()
);

-- 15. RECIPE_TASTE_PARAMS
create table recipe_taste_params (
  id UUID primary key default gen_random_uuid (),
  recipe_id UUID not null references recipes (id) on delete CASCADE unique,
  sweetness SMALLINT check (sweetness between 1 and 5),
  saltiness SMALLINT check (saltiness between 1 and 5),
  spiciness SMALLINT check (spiciness between 1 and 5),
  acidity SMALLINT check (acidity between 1 and 5),
  bitterness SMALLINT check (bitterness between 1 and 5),
  umami SMALLINT check (umami between 1 and 5),
  richness SMALLINT check (richness between 1 and 5),
  created_at TIMESTAMPTZ default now(),
  updated_at TIMESTAMPTZ default now()
);

-- 16. RECIPE_RATINGS
create table recipe_ratings (
  id UUID primary key default gen_random_uuid (),
  recipe_id UUID not null references recipes (id) on delete CASCADE,
  profile_id UUID not null references profiles (id) on delete CASCADE,
  rating SMALLINT not null check (rating between 1 and 5),
  created_at TIMESTAMPTZ default now(),
  updated_at TIMESTAMPTZ default now(),
  unique (recipe_id, profile_id)
);

-- 17. TASTE_PREFERENCES
create table taste_preferences (
  id UUID primary key default gen_random_uuid (),
  profile_id UUID not null references profiles (id) on delete CASCADE unique,
  sweetness SMALLINT check (sweetness between 1 and 5),
  saltiness SMALLINT check (saltiness between 1 and 5),
  spiciness SMALLINT check (spiciness between 1 and 5),
  acidity SMALLINT check (acidity between 1 and 5),
  bitterness SMALLINT check (bitterness between 1 and 5),
  umami SMALLINT check (umami between 1 and 5),
  richness SMALLINT check (richness between 1 and 5),
  notes TEXT,
  created_at TIMESTAMPTZ default now(),
  updated_at TIMESTAMPTZ default now()
);

-- ============================================
-- PARTIE 2 : ACTIVER LE RLS SUR TOUTES LES TABLES
-- ============================================
alter table households ENABLE row LEVEL SECURITY;

alter table profiles ENABLE row LEVEL SECURITY;

alter table recipes ENABLE row LEVEL SECURITY;

alter table inventory_items ENABLE row LEVEL SECURITY;

alter table consumed_items ENABLE row LEVEL SECURITY;

alter table messages ENABLE row LEVEL SECURITY;

alter table recipe_comments ENABLE row LEVEL SECURITY;

alter table push_subscriptions ENABLE row LEVEL SECURITY;

alter table swipe_sessions ENABLE row LEVEL SECURITY;

alter table swipe_session_recipes ENABLE row LEVEL SECURITY;

alter table swipe_votes ENABLE row LEVEL SECURITY;

alter table shopping_lists ENABLE row LEVEL SECURITY;

alter table shopping_list_items ENABLE row LEVEL SECURITY;

alter table cooking_history ENABLE row LEVEL SECURITY;

alter table recipe_taste_params ENABLE row LEVEL SECURITY;

alter table recipe_ratings ENABLE row LEVEL SECURITY;

alter table taste_preferences ENABLE row LEVEL SECURITY;

-- ============================================
-- PARTIE 3 : POLICIES RLS
-- (Toutes les tables existent maintenant, les sous-requêtes fonctionnent)
-- ============================================
-- ---- HOUSEHOLDS ----
create policy "Anyone can read households" on households for
select
  using (true);

create policy "Anyone can create a household" on households for INSERT
with
  check (true);

create policy "Anyone can update households" on households
for update
  using (true);

-- ---- PROFILES ----
create policy "Anyone can read profiles" on profiles for
select
  using (true);

create policy "Anyone can create a profile" on profiles for INSERT
with
  check (true);

create policy "Anyone can update profiles" on profiles
for update
  using (true);

create policy "Anyone can delete profiles" on profiles for DELETE using (true);

-- ---- RECIPES ----
create policy "Household members can view recipes" on recipes for
select
  using (
    household_id in (
      select
        household_id
      from
        profiles
    )
  );

create policy "Household members can insert recipes" on recipes for INSERT
with
  check (
    household_id in (
      select
        household_id
      from
        profiles
    )
  );

create policy "Household members can update recipes" on recipes
for update
  using (
    household_id in (
      select
        household_id
      from
        profiles
    )
  );

create policy "Household members can delete recipes" on recipes for DELETE using (
  household_id in (
    select
      household_id
    from
      profiles
  )
);

-- ---- INVENTORY_ITEMS ----
create policy "Household members can view inventory" on inventory_items for
select
  using (
    household_id in (
      select
        household_id
      from
        profiles
    )
  );

create policy "Household members can insert inventory" on inventory_items for INSERT
with
  check (
    household_id in (
      select
        household_id
      from
        profiles
    )
  );

create policy "Household members can update inventory" on inventory_items
for update
  using (
    household_id in (
      select
        household_id
      from
        profiles
    )
  );

create policy "Household members can delete inventory" on inventory_items for DELETE using (
  household_id in (
    select
      household_id
    from
      profiles
  )
);

-- ---- CONSUMED_ITEMS ----
create policy "Household members can view consumed items" on consumed_items for
select
  using (
    household_id in (
      select
        household_id
      from
        profiles
    )
  );

create policy "Household members can insert consumed items" on consumed_items for INSERT
with
  check (
    household_id in (
      select
        household_id
      from
        profiles
    )
  );

create policy "Household members can update consumed items" on consumed_items
for update
  using (
    household_id in (
      select
        household_id
      from
        profiles
    )
  );

create policy "Household members can delete consumed items" on consumed_items for DELETE using (
  household_id in (
    select
      household_id
    from
      profiles
  )
);

-- ---- MESSAGES ----
create policy "Household members can view messages" on messages for
select
  using (
    household_id in (
      select
        household_id
      from
        profiles
    )
  );

create policy "Household members can insert messages" on messages for INSERT
with
  check (
    household_id in (
      select
        household_id
      from
        profiles
    )
  );

create policy "Household members can update messages" on messages
for update
  using (
    household_id in (
      select
        household_id
      from
        profiles
    )
  );

create policy "Household members can delete messages" on messages for DELETE using (
  household_id in (
    select
      household_id
    from
      profiles
  )
);

-- ---- RECIPE_COMMENTS ----
create policy "Household members can view comments" on recipe_comments for
select
  using (
    recipe_id in (
      select
        id
      from
        recipes
    )
  );

create policy "Household members can insert comments" on recipe_comments for INSERT
with
  check (
    recipe_id in (
      select
        id
      from
        recipes
    )
  );

create policy "Household members can update comments" on recipe_comments
for update
  using (
    recipe_id in (
      select
        id
      from
        recipes
    )
  );

create policy "Household members can delete comments" on recipe_comments for DELETE using (
  recipe_id in (
    select
      id
    from
      recipes
  )
);

-- ---- PUSH_SUBSCRIPTIONS ----
create policy "Household members can view push subscriptions" on push_subscriptions for
select
  using (
    household_id in (
      select
        household_id
      from
        profiles
    )
  );

create policy "Anyone can insert push subscriptions" on push_subscriptions for INSERT
with
  check (true);

create policy "Anyone can update push subscriptions" on push_subscriptions
for update
  using (true);

create policy "Anyone can delete push subscriptions" on push_subscriptions for DELETE using (true);

-- ---- SWIPE_SESSIONS ----
create policy "Household members can view swipe sessions" on swipe_sessions for
select
  using (
    household_id in (
      select
        household_id
      from
        profiles
    )
  );

create policy "Household members can insert swipe sessions" on swipe_sessions for INSERT
with
  check (
    household_id in (
      select
        household_id
      from
        profiles
    )
  );

create policy "Household members can update swipe sessions" on swipe_sessions
for update
  using (
    household_id in (
      select
        household_id
      from
        profiles
    )
  );

create policy "Household members can delete swipe sessions" on swipe_sessions for DELETE using (
  household_id in (
    select
      household_id
    from
      profiles
  )
);

-- ---- SWIPE_SESSION_RECIPES ----
create policy "Household members can view session recipes" on swipe_session_recipes for
select
  using (
    session_id in (
      select
        id
      from
        swipe_sessions
    )
  );

create policy "Household members can insert session recipes" on swipe_session_recipes for INSERT
with
  check (
    session_id in (
      select
        id
      from
        swipe_sessions
    )
  );

create policy "Household members can update session recipes" on swipe_session_recipes
for update
  using (
    session_id in (
      select
        id
      from
        swipe_sessions
    )
  );

create policy "Household members can delete session recipes" on swipe_session_recipes for DELETE using (
  session_id in (
    select
      id
    from
      swipe_sessions
  )
);

-- ---- SWIPE_VOTES ----
create policy "Household members can view votes" on swipe_votes for
select
  using (
    session_recipe_id in (
      select
        id
      from
        swipe_session_recipes
    )
  );

create policy "Household members can insert votes" on swipe_votes for INSERT
with
  check (
    session_recipe_id in (
      select
        id
      from
        swipe_session_recipes
    )
  );

create policy "Household members can update votes" on swipe_votes
for update
  using (
    session_recipe_id in (
      select
        id
      from
        swipe_session_recipes
    )
  );

create policy "Household members can delete votes" on swipe_votes for DELETE using (
  session_recipe_id in (
    select
      id
    from
      swipe_session_recipes
  )
);

-- ---- SHOPPING_LISTS ----
create policy "Household members can view shopping lists" on shopping_lists for
select
  using (
    household_id in (
      select
        household_id
      from
        profiles
    )
  );

create policy "Household members can insert shopping lists" on shopping_lists for INSERT
with
  check (
    household_id in (
      select
        household_id
      from
        profiles
    )
  );

create policy "Household members can update shopping lists" on shopping_lists
for update
  using (
    household_id in (
      select
        household_id
      from
        profiles
    )
  );

create policy "Household members can delete shopping lists" on shopping_lists for DELETE using (
  household_id in (
    select
      household_id
    from
      profiles
  )
);

-- ---- SHOPPING_LIST_ITEMS ----
create policy "Household members can view shopping list items" on shopping_list_items for
select
  using (
    list_id in (
      select
        id
      from
        shopping_lists
    )
  );

create policy "Household members can insert shopping list items" on shopping_list_items for INSERT
with
  check (
    list_id in (
      select
        id
      from
        shopping_lists
    )
  );

create policy "Household members can update shopping list items" on shopping_list_items
for update
  using (
    list_id in (
      select
        id
      from
        shopping_lists
    )
  );

create policy "Household members can delete shopping list items" on shopping_list_items for DELETE using (
  list_id in (
    select
      id
    from
      shopping_lists
  )
);

-- ---- COOKING_HISTORY ----
create policy "Household members can view cooking history" on cooking_history for
select
  using (
    household_id in (
      select
        household_id
      from
        profiles
    )
  );

create policy "Household members can insert cooking history" on cooking_history for INSERT
with
  check (
    household_id in (
      select
        household_id
      from
        profiles
    )
  );

create policy "Household members can update cooking history" on cooking_history
for update
  using (
    household_id in (
      select
        household_id
      from
        profiles
    )
  );

create policy "Household members can delete cooking history" on cooking_history for DELETE using (
  household_id in (
    select
      household_id
    from
      profiles
  )
);

-- ---- RECIPE_TASTE_PARAMS ----
create policy "Users can view taste params" on recipe_taste_params for
select
  using (
    recipe_id in (
      select
        id
      from
        recipes
    )
  );

create policy "Users can insert taste params" on recipe_taste_params for INSERT
with
  check (
    recipe_id in (
      select
        id
      from
        recipes
    )
  );

create policy "Users can update taste params" on recipe_taste_params
for update
  using (
    recipe_id in (
      select
        id
      from
        recipes
    )
  );

create policy "Users can delete taste params" on recipe_taste_params for DELETE using (
  recipe_id in (
    select
      id
    from
      recipes
  )
);

-- ---- RECIPE_RATINGS ----
create policy "Users can view ratings" on recipe_ratings for
select
  using (
    recipe_id in (
      select
        id
      from
        recipes
    )
  );

create policy "Users can insert ratings" on recipe_ratings for INSERT
with
  check (
    recipe_id in (
      select
        id
      from
        recipes
    )
  );

create policy "Users can update ratings" on recipe_ratings
for update
  using (
    recipe_id in (
      select
        id
      from
        recipes
    )
  );

create policy "Users can delete ratings" on recipe_ratings for DELETE using (
  recipe_id in (
    select
      id
    from
      recipes
  )
);

-- ---- TASTE_PREFERENCES ----
create policy "Users can view taste preferences" on taste_preferences for
select
  using (true);

create policy "Users can insert taste preferences" on taste_preferences for INSERT
with
  check (true);

create policy "Users can update taste preferences" on taste_preferences
for update
  using (true);

create policy "Users can delete taste preferences" on taste_preferences for DELETE using (true);

-- ============================================
-- PARTIE 4 : ACTIVER LE REALTIME
-- ============================================
alter publication supabase_realtime
add table inventory_items;

alter publication supabase_realtime
add table messages;

alter publication supabase_realtime
add table recipes;

alter publication supabase_realtime
add table recipe_comments;

alter publication supabase_realtime
add table swipe_sessions;

alter publication supabase_realtime
add table swipe_votes;

alter publication supabase_realtime
add table shopping_list_items;

-- ============================================
-- FIN — 17 tables créées avec RLS et Realtime !
-- ============================================