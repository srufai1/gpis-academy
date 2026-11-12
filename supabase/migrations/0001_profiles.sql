-- T04 (1 of 5): shared helpers, profiles, and the sign-up trigger.
--
-- Rules used in every migration of this task:
--   * RLS is enabled on every table. No policy means no access (deny by default).
--   * Supabase grants ALL on new public tables to anon, authenticated and
--     service_role by default. Each table therefore starts with REVOKE ALL from
--     those roles, then grants only what a signed-in learner needs.
--     service_role gets nothing: the app never uses it (AGENTS.md).
--   * "Own row" always means user_id = auth.uid().
--   * Every function pins search_path = '' and names every object in full.
begin;

-- The role of the signed-in user. Only from app_metadata, which the user
-- cannot change. user_metadata is never read for a decision.
create function public.app_role() returns text
language sql stable set search_path = '' as $$
  select nullif(auth.jwt() -> 'app_metadata' ->> 'role', '')
$$;
revoke all on function public.app_role() from public, anon;
grant execute on function public.app_role() to authenticated;

create function public.set_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at := pg_catalog.now();
  return new;
end;
$$;
revoke all on function public.set_updated_at() from public, anon, authenticated;

-- One row per learner. The id is the Auth user's id.
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null default '' check (char_length(full_name) <= 120),
  time_zone text not null default 'Africa/Accra' check (char_length(time_zone) between 1 and 64),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on table public.profiles is
  'One row per learner, created by the sign-up trigger. A learner reads and renames only their own row.';

alter table public.profiles enable row level security;
revoke all on table public.profiles from public, anon, authenticated, service_role;
grant select on table public.profiles to authenticated;
grant update (full_name, time_zone) on table public.profiles to authenticated;

create policy profiles_select_own on public.profiles
  for select to authenticated using (id = (select auth.uid()));
create policy profiles_update_own on public.profiles
  for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

create trigger profiles_set_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

-- Sign-up: Auth inserts into auth.users; this creates the profile. The name is
-- a display value only (user_metadata is user-written), cut to the column limit.
create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, pg_catalog.left(coalesce(new.raw_user_meta_data ->> 'full_name', ''), 120))
  on conflict (id) do nothing;
  return new;
end;
$$;
revoke all on function public.handle_new_user() from public, anon, authenticated;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

commit;
