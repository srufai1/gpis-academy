-- T04 (4 of 5): registered checker installs, and the results they send.
--
-- Neither table can be inserted into by a signed-in learner:
--   * devices    rows are created by the device-registration function (T18);
--   * check_runs rows are created only by record_check_run() (T19), after the
--                platform route has verified the stamp and the signature.
-- This migration builds the closed tables. T18 and T19 add their one
-- SECURITY DEFINER function each; nothing else needs to change here.
begin;

create table public.devices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete restrict,
  public_key text not null unique check (char_length(public_key) between 32 and 200),
  label text not null default '' check (char_length(label) <= 80),
  created_at timestamptz not null default now(),
  revoked_at timestamptz,
  -- Lets check_runs prove "this device belongs to this learner" with a foreign key.
  unique (id, user_id)
);
comment on table public.devices is
  'A registered checker install (public key). Created by the T18 function; the owner may only revoke it.';
create index devices_user_idx on public.devices (user_id);

alter table public.devices enable row level security;
revoke all on table public.devices from public, anon, authenticated, service_role;
grant select on table public.devices to authenticated;
grant update (revoked_at) on table public.devices to authenticated;

create policy devices_select_own on public.devices
  for select to authenticated using (user_id = (select auth.uid()));
create policy devices_revoke_own on public.devices
  for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- Revoking is one way: a revoked device cannot be made valid again, and the
-- time of revoking cannot be moved.
create function public.devices_revoke_once() returns trigger
language plpgsql set search_path = '' as $$
begin
  if old.revoked_at is not null and new.revoked_at is distinct from old.revoked_at then
    raise exception 'devices: a revoked device stays revoked' using errcode = '23514';
  end if;
  if old.revoked_at is null and new.revoked_at is not null then
    new.revoked_at := pg_catalog.now();
  end if;
  return new;
end;
$$;
revoke all on function public.devices_revoke_once() from public, anon, authenticated;

create trigger devices_revoke_once before update of revoked_at on public.devices
  for each row execute function public.devices_revoke_once();

-- One row per checker result received. History: insert only (see 0005), and
-- only through record_check_run() (T19).
create table public.check_runs (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles (id) on delete restrict,
  device_id uuid not null,
  definition_id bigint not null references public.check_definitions (id) on delete restrict,
  -- The platform's one-time challenge. Unique: the same result cannot be recorded twice.
  nonce text not null unique check (char_length(nonce) between 16 and 128),
  commit_sha text check (commit_sha ~ '^[0-9a-f]{7,64}$'),
  tree_clean boolean,
  passed boolean not null,
  -- Per-step outcome and short reasons. Never source code.
  results jsonb not null check (jsonb_typeof(results) = 'object' and pg_column_size(results) <= 65536),
  -- The device's signature over the canonical result (T12), kept as evidence.
  signature text not null check (char_length(signature) between 32 and 400),
  checker_version text not null check (char_length(checker_version) between 1 and 40),
  started_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz not null default now(),
  -- The device must belong to the same learner as the run.
  foreign key (device_id, user_id) references public.devices (id, user_id) on delete restrict,
  check (finished_at is null or started_at is null or finished_at >= started_at)
);
comment on table public.check_runs is
  'One row per checker result. Inserted only by record_check_run() (T19). No direct insert, update or delete.';
create index check_runs_user_definition_idx on public.check_runs (user_id, definition_id, id desc);
create index check_runs_device_idx on public.check_runs (device_id);

alter table public.check_runs enable row level security;
revoke all on table public.check_runs from public, anon, authenticated, service_role;
grant select on table public.check_runs to authenticated;

create policy check_runs_select_own on public.check_runs
  for select to authenticated using (user_id = (select auth.uid()));
-- No INSERT policy and no INSERT grant, on purpose.

commit;
