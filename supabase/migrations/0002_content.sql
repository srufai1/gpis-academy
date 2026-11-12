-- T04 (2 of 5): the course index and the published checks.
-- Both are written only by the content build, with the database owner's
-- connection (T06). Learners read them; nobody signed in can write them.
begin;

create table public.content_items (
  slug text primary key check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) <= 80),
  kind text not null check (kind in ('module', 'unit', 'lesson', 'quiz', 'project')),
  parent_slug text references public.content_items (slug) on delete restrict,
  position integer not null check (position >= 0),
  title text not null check (char_length(title) between 1 and 200),
  guidance text check (guidance in ('guided', 'half', 'independent')),
  content_hash text not null check (content_hash ~ '^[0-9a-f]{64}$'),
  check (parent_slug is distinct from slug)
);
comment on table public.content_items is
  'Index of modules, units, quizzes and projects, built from content/ in the repo. Read only for learners.';
create index content_items_parent_idx on public.content_items (parent_slug, position);

alter table public.content_items enable row level security;
revoke all on table public.content_items from public, anon, authenticated, service_role;
grant select on table public.content_items to authenticated;
create policy content_items_select_signed_in on public.content_items
  for select to authenticated using (true);

create table public.check_definitions (
  id bigint generated always as identity primary key,
  item_slug text not null references public.content_items (slug) on delete restrict,
  version text not null check (version ~ '^[0-9]+\.[0-9]+\.[0-9]+$'),
  sha256 text not null check (sha256 ~ '^[0-9a-f]{64}$'),
  published_at timestamptz not null default now(),
  unique (item_slug, version)
);
comment on table public.check_definitions is
  'Published check versions (id, version, hash of the check folder). A run is accepted only for a row here.';

alter table public.check_definitions enable row level security;
revoke all on table public.check_definitions from public, anon, authenticated, service_role;
grant select on table public.check_definitions to authenticated;
create policy check_definitions_select_signed_in on public.check_definitions
  for select to authenticated using (true);

commit;
