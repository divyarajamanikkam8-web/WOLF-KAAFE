-- Admin customer insights needs profile rows, while customers remain limited
-- to their own profile. This policy grants all-profile reads only to admins.
alter table public.profiles enable row level security;
drop policy if exists "profiles owner read" on public.profiles;
drop policy if exists "profiles own or admin read" on public.profiles;
drop policy if exists "profiles owner or admin read" on public.profiles;
create policy "profiles owner or admin read" on public.profiles
  for select to authenticated
  using (id = (select auth.uid()) or public.is_admin());

-- Admin Customers already listens for profile changes. Publish the existing
-- profile table so Auth-triggered profile inserts invalidate its query live.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
    and not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = 'profiles'
    ) then
    alter publication supabase_realtime add table public.profiles;
  end if;
end;
$$;
