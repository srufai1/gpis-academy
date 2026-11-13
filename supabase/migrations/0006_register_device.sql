-- T18 (ADR-7): the only way a device is created. The CLI signs in as the learner
-- (email one-time code), then registers its public key here. user_id is always
-- auth.uid(): nobody can register a device for someone else.

create function public.register_device(p_public_key text, p_label text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_id uuid;
begin
  if v_user is null then
    raise exception 'register_device: sign in first' using errcode = '42501';
  end if;
  -- "ed25519:" + base64url (no padding) of 32 bytes: 43 characters, the last one
  -- carrying 4 bits (protocol.md §4). Same rule as isDevicePublicKey().
  if p_public_key is null or p_public_key !~ '^ed25519:[A-Za-z0-9_-]{42}[AEIMQUYcgkosw048]$' then
    raise exception 'register_device: not a device public key' using errcode = '22023';
  end if;
  if p_label is null or char_length(p_label) > 80 or p_label ~ '[\r\n]' then
    raise exception 'register_device: the label is one line of at most 80 characters' using errcode = '22023';
  end if;
  -- One learner at a time: two logins at once cannot both pass the count.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('register_device:' || v_user::text));
  if (select count(*) from public.devices d where d.user_id = v_user and d.revoked_at is null) >= 5 then
    raise exception 'register_device: at most 5 devices; revoke one on the platform first' using errcode = '23514';
  end if;
  insert into public.devices (user_id, public_key, label)
  values (v_user, p_public_key, btrim(p_label))
  returning id into v_id;
  return v_id;
end;
$$;

revoke all on function public.register_device(text, text) from public, anon, authenticated, service_role;
grant execute on function public.register_device(text, text) to authenticated;
