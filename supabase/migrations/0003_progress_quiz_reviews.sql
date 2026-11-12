-- T04 (3 of 5): what a learner did: progress (current state), quiz attempts
-- and self-review revisions (both history).
begin;

-- Current state of one item for one learner. "correct" and "reviewed" are not
-- stored here: they are derived from check_runs and reviews when read.
create table public.progress (
  user_id uuid not null references public.profiles (id) on delete restrict,
  item_slug text not null references public.content_items (slug) on delete restrict,
  state text not null check (state in ('started', 'read', 'quiz_passed', 'done')),
  due_on timestamptz,
  updated_at timestamptz not null default now(),
  primary key (user_id, item_slug)
);
comment on table public.progress is
  'Current state of one content item for one learner. Own rows only; never deleted.';

alter table public.progress enable row level security;
revoke all on table public.progress from public, anon, authenticated, service_role;
grant select on table public.progress to authenticated;
grant insert (user_id, item_slug, state, due_on) on table public.progress to authenticated;
grant update (state, due_on) on table public.progress to authenticated;

create policy progress_select_own on public.progress
  for select to authenticated using (user_id = (select auth.uid()));
create policy progress_insert_own on public.progress
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy progress_update_own on public.progress
  for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create trigger progress_set_updated_at before update on public.progress
  for each row execute function public.set_updated_at();

-- One row per quiz attempt. History: insert only (see 0005).
-- id and created_at cannot be supplied by the learner (column grants).
create table public.quiz_attempts (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles (id) on delete restrict,
  item_slug text not null references public.content_items (slug) on delete restrict,
  answers jsonb not null check (jsonb_typeof(answers) = 'object' and pg_column_size(answers) <= 16384),
  score integer not null check (score between 0 and 1000),
  content_hash text not null check (content_hash ~ '^[0-9a-f]{64}$'),
  created_at timestamptz not null default now()
);
comment on table public.quiz_attempts is
  'One row per quiz attempt, with the content version it was marked against. Insert only.';
create index quiz_attempts_user_item_idx on public.quiz_attempts (user_id, item_slug, id desc);

alter table public.quiz_attempts enable row level security;
revoke all on table public.quiz_attempts from public, anon, authenticated, service_role;
grant select on table public.quiz_attempts to authenticated;
grant insert (user_id, item_slug, answers, score, content_hash) on table public.quiz_attempts to authenticated;

create policy quiz_attempts_select_own on public.quiz_attempts
  for select to authenticated using (user_id = (select auth.uid()));
create policy quiz_attempts_insert_own on public.quiz_attempts
  for insert to authenticated with check (user_id = (select auth.uid()));

-- Self-review revisions. A change is a new revision; the number is given by
-- the database, never by the learner.
create table public.reviews (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles (id) on delete restrict,
  item_slug text not null references public.content_items (slug) on delete restrict,
  revision integer not null check (revision >= 1),
  checklist jsonb not null check (jsonb_typeof(checklist) = 'object' and pg_column_size(checklist) <= 16384),
  explanation text not null check (char_length(explanation) between 1 and 4000),
  gpis_comparison text not null check (char_length(gpis_comparison) between 1 and 4000),
  created_at timestamptz not null default now(),
  unique (user_id, item_slug, revision)
);
comment on table public.reviews is
  'Self-review revisions (checklist, explanation, GPIS comparison). Self-assessed. Insert only.';

alter table public.reviews enable row level security;
revoke all on table public.reviews from public, anon, authenticated, service_role;
grant select on table public.reviews to authenticated;
grant insert (user_id, item_slug, checklist, explanation, gpis_comparison) on table public.reviews to authenticated;

create policy reviews_select_own on public.reviews
  for select to authenticated using (user_id = (select auth.uid()));
create policy reviews_insert_own on public.reviews
  for insert to authenticated with check (user_id = (select auth.uid()));

-- Next revision for this learner and item. SECURITY DEFINER so the count does
-- not depend on what the caller may read; the unique constraint settles a race.
create function public.reviews_set_revision() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  select coalesce(max(r.revision), 0) + 1 into new.revision
    from public.reviews r
   where r.user_id = new.user_id and r.item_slug = new.item_slug;
  return new;
end;
$$;
revoke all on function public.reviews_set_revision() from public, anon, authenticated;

create trigger reviews_set_revision before insert on public.reviews
  for each row execute function public.reviews_set_revision();

commit;
