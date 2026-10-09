-- Keep each customer profile tied to the matching Supabase Auth user.
alter table public.profiles
  alter column phone type text using phone::text,
  add column if not exists email_id text,
  add column if not exists avatar_url text;

create or replace function public.create_profile_for_user() returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  insert into public.profiles(id, full_name, phone, email_id)
  values (
    new.id,
    coalesce(nullif(new.raw_user_meta_data->>'full_name', ''), ''),
    nullif(new.raw_user_meta_data->>'phone', ''),
    new.email
  )
  on conflict (id) do update set
    full_name = coalesce(nullif(excluded.full_name, ''), public.profiles.full_name),
    phone = coalesce(excluded.phone, public.profiles.phone),
    email_id = coalesce(excluded.email_id, public.profiles.email_id),
    updated_at = now();
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.create_profile_for_user();

create or replace function public.touch_profile_updated_at() returns trigger
language plpgsql set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_touch_updated_at on public.profiles;
create trigger profiles_touch_updated_at
  before update on public.profiles
  for each row execute procedure public.touch_profile_updated_at();

alter table public.profiles enable row level security;
drop policy if exists "profiles own or admin read" on public.profiles;
drop policy if exists "profiles own update" on public.profiles;
create policy "profiles own or admin read" on public.profiles
  for select to authenticated
  using (id = auth.uid() or public.is_admin());
create policy "profiles own customer update" on public.profiles
  for update to authenticated
  using (id = auth.uid() and role = 'customer')
  with check (id = auth.uid() and role = 'customer');

revoke all on table public.profiles from anon;
revoke insert, update, delete on table public.profiles from authenticated;
grant select on table public.profiles to authenticated;
grant update (full_name, phone, avatar_url) on table public.profiles to authenticated;

insert into public.profiles(id, full_name, phone, email_id)
select
  u.id,
  coalesce(nullif(u.raw_user_meta_data->>'full_name', ''), ''),
  nullif(u.raw_user_meta_data->>'phone', ''),
  u.email
from auth.users u
on conflict (id) do update set
  full_name = coalesce(nullif(public.profiles.full_name, ''), excluded.full_name),
  phone = coalesce(public.profiles.phone, excluded.phone),
  email_id = coalesce(excluded.email_id, public.profiles.email_id),
  updated_at = now();

update public.profiles p
set phone = coalesce(nullif(u.raw_user_meta_data->>'phone', ''), p.phone),
    email_id = coalesce(u.email, p.email_id),
    updated_at = now()
from auth.users u
where u.id = p.id;
