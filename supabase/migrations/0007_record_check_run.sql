-- T19: the one door into check_runs.
--
-- The platform route verifies a submission (protocol.md §8: challenge stamp,
-- device signature, schema, bindings) and then calls record_check_run() AS THE
-- LEARNER (their Bearer token, ADR-7). Because the learner could call this
-- function directly too, the route passes a "record stamp": an HMAC made with
-- a key only the route and the database hold (protocol.md §6). Without a
-- correct stamp nothing is inserted.
--
-- The key lives in private.server_keys. The schema "private" is not exposed by
-- the API and no API role may use it; only this function (owner's rights) reads it.
-- The owner sets the key once by hand (see docs/runbook-check-runs.md); its value
-- is never in the repository.
begin;

-- HMAC comes from pgcrypto. On Supabase it is already installed in "extensions".
create extension if not exists pgcrypto with schema extensions;

create schema private;
revoke all on schema private from public, anon, authenticated, service_role;

create table private.server_keys (
  name text primary key check (name in ('record')),
  key bytea not null check (octet_length(key) >= 32),
  created_at timestamptz not null default now()
);
comment on table private.server_keys is
  'Server-held keys. "record" is the key of the record stamp (protocol.md §6). No API role can read this table.';
alter table private.server_keys enable row level security;
revoke all on table private.server_keys from public, anon, authenticated, service_role;

-- Records one verified checker result for the signed-in learner.
--   p_payload    the canonical result exactly as the device signed it
--   p_signature  the device signature (kept as evidence; verified by the route)
--   p_stamp      the route's record stamp, lowercase hex
-- Refusals: 42501 not allowed (not signed in, wrong stamp, not the learner's
-- valid device); 22023 the arguments do not fit together; 23505 the nonce was
-- already recorded (a replay); 55000 the record key is not set.
create function public.record_check_run(
  p_device_id uuid,
  p_definition_id bigint,
  p_nonce text,
  p_payload text,
  p_signature text,
  p_stamp text
) returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_key bytea;
  v_sha text;
  v_expected text;
  v jsonb;
  v_id bigint;
begin
  if v_user is null then
    raise exception 'record_check_run: sign in first' using errcode = '42501';
  end if;
  if p_device_id is null or p_definition_id is null or p_nonce is null or p_payload is null
     or p_signature is null or p_stamp is null
     or char_length(p_payload) > 200000 or p_nonce ~ '[\r\n]' then
    raise exception 'record_check_run: bad arguments' using errcode = '22023';
  end if;

  select k.key into v_key from private.server_keys k where k.name = 'record';
  if v_key is null then
    raise exception 'record_check_run: the record key is not set' using errcode = '55000';
  end if;

  -- 1. Did the platform route send this? Recompute the stamp over the learner,
  --    the device, the check version, the nonce and the exact payload.
  v_sha := pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(p_payload, 'UTF8')), 'hex');
  v_expected := pg_catalog.encode(extensions.hmac(
    pg_catalog.convert_to(
      'ruftech-academy/record/v1' || E'\n' || v_user::text || E'\n' || p_device_id::text || E'\n'
        || p_definition_id::text || E'\n' || p_nonce || E'\n' || v_sha, 'UTF8'),
    v_key, 'sha256'), 'hex');
  if p_stamp is distinct from v_expected then
    raise exception 'record_check_run: not sent by the platform' using errcode = '42501';
  end if;

  -- 2. The payload is the one the stamp covers. It must name the same learner,
  --    device and nonce as the arguments (the route checked this; checked again).
  v := p_payload::jsonb;
  if v ->> 'user_id' is distinct from v_user::text
     or v ->> 'device_id' is distinct from p_device_id::text
     or v -> 'challenge' ->> 'nonce' is distinct from p_nonce
     or pg_catalog.jsonb_typeof(v -> 'passed') is distinct from 'boolean'
     or pg_catalog.jsonb_typeof(v -> 'results') is distinct from 'object' then
    raise exception 'record_check_run: the payload does not match the arguments' using errcode = '22023';
  end if;

  -- 3. The learner's own device, still valid at this moment.
  perform 1 from public.devices d
    where d.id = p_device_id and d.user_id = v_user and d.revoked_at is null
    for share;
  if not found then
    raise exception 'record_check_run: not a valid device of this learner' using errcode = '42501';
  end if;

  -- 4. The published check version the payload names.
  perform 1 from public.check_definitions c
    where c.id = p_definition_id
      and c.item_slug = v -> 'check' ->> 'id'
      and c.version = v -> 'check' ->> 'version'
      and c.sha256 = v -> 'check' ->> 'sha256';
  if not found then
    raise exception 'record_check_run: not a published check version' using errcode = '22023';
  end if;

  -- 5. Insert. nonce is UNIQUE: a second use raises 23505 (a replay).
  insert into public.check_runs (
    user_id, device_id, definition_id, nonce, commit_sha, tree_clean, passed, results,
    signature, checker_version, started_at, finished_at)
  values (
    v_user, p_device_id, p_definition_id, p_nonce,
    v -> 'commit' ->> 'sha', (v -> 'commit' ->> 'clean')::boolean, (v ->> 'passed')::boolean, v -> 'results',
    p_signature, v ->> 'checker_version',
    pg_catalog.to_timestamp((v ->> 'started_at')::bigint), pg_catalog.to_timestamp((v ->> 'finished_at')::bigint))
  returning id into v_id;
  return v_id;
end;
$$;

comment on function public.record_check_run(uuid, bigint, text, text, text, text) is
  'The only way a check_runs row is created (T19). Needs the platform route''s record stamp; runs as the signed-in learner.';
revoke all on function public.record_check_run(uuid, bigint, text, text, text, text) from public, anon, authenticated, service_role;
grant execute on function public.record_check_run(uuid, bigint, text, text, text, text) to authenticated;

commit;
