-- T04 (5 of 5): quiz_attempts, check_runs and reviews are history.
--
-- Three layers keep a recorded row unchanged:
--   1. no UPDATE or DELETE privilege for any API role (earlier migrations);
--   2. no UPDATE or DELETE policy;
--   3. this trigger, which refuses UPDATE, DELETE and TRUNCATE for EVERY role,
--      the table owner included, so a later mistake in grants cannot open them.
--
-- Consequence: a learner who has history cannot be deleted (the foreign keys
-- are ON DELETE RESTRICT). Removing a learner's history, if ever needed, is a
-- deliberate migration, not an everyday action.
begin;

create function public.forbid_history_change() returns trigger
language plpgsql set search_path = '' as $$
begin
  raise exception '%: history rows cannot be changed or removed (% refused)', tg_table_name, tg_op
    using errcode = '42501';
end;
$$;
revoke all on function public.forbid_history_change() from public, anon, authenticated;

create trigger quiz_attempts_immutable before update or delete on public.quiz_attempts
  for each row execute function public.forbid_history_change();
create trigger quiz_attempts_no_truncate before truncate on public.quiz_attempts
  for each statement execute function public.forbid_history_change();

create trigger check_runs_immutable before update or delete on public.check_runs
  for each row execute function public.forbid_history_change();
create trigger check_runs_no_truncate before truncate on public.check_runs
  for each statement execute function public.forbid_history_change();

create trigger reviews_immutable before update or delete on public.reviews
  for each row execute function public.forbid_history_change();
create trigger reviews_no_truncate before truncate on public.reviews
  for each statement execute function public.forbid_history_change();

commit;
