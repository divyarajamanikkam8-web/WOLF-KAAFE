create table if not exists public.home_special_offers (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  heading text not null,
  description text not null default '',
  discount_text text not null default '',
  button_text text not null,
  image_url text,
  video_url text,
  is_active boolean not null default false,
  start_date timestamptz,
  end_date timestamptz,
  display_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint home_special_offers_dates_valid check (start_date is null or end_date is null or start_date < end_date),
  constraint home_special_offers_one_media check (image_url is null or video_url is null)
);

create table if not exists public.home_special_offer_food_items (
  offer_id uuid not null references public.home_special_offers(id) on delete cascade,
  food_item_id uuid not null references public.food_items(id) on delete cascade,
  primary key (offer_id, food_item_id)
);

alter table public.home_special_offers enable row level security;
alter table public.home_special_offer_food_items enable row level security;

drop policy if exists "home offers public active read" on public.home_special_offers;
create policy "home offers public active read" on public.home_special_offers
  for select using (
    is_active
    and (start_date is null or start_date <= now())
    and (end_date is null or end_date > now())
  );
drop policy if exists "home offers admin manage" on public.home_special_offers;
create policy "home offers admin manage" on public.home_special_offers
  for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "home offer foods public active read" on public.home_special_offer_food_items;
create policy "home offer foods public active read" on public.home_special_offer_food_items
  for select using (exists (
    select 1 from public.home_special_offers offer
    where offer.id = offer_id and offer.is_active
      and (offer.start_date is null or offer.start_date <= now())
      and (offer.end_date is null or offer.end_date > now())
  ));
drop policy if exists "home offer foods admin manage" on public.home_special_offer_food_items;
create policy "home offer foods admin manage" on public.home_special_offer_food_items
  for all using (public.is_admin()) with check (public.is_admin());

grant select on public.home_special_offers, public.home_special_offer_food_items to anon, authenticated;
grant insert, update, delete on public.home_special_offers, public.home_special_offer_food_items to authenticated;

create or replace function public.touch_home_special_offer_updated_at()
returns trigger language plpgsql set search_path = public as $$
begin
  new.updated_at := now();
  return new;
end;
$$;
drop trigger if exists home_special_offers_touch_updated_at on public.home_special_offers;
create trigger home_special_offers_touch_updated_at
before update on public.home_special_offers
for each row execute function public.touch_home_special_offer_updated_at();
revoke all on function public.touch_home_special_offer_updated_at() from public, anon, authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('home-offer-media', 'home-offer-media', true, 52428800, array['image/jpeg','image/png','image/webp','image/avif','video/mp4','video/webm'])
on conflict (id) do update set public = true, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "home offer media public read" on storage.objects;
create policy "home offer media public read" on storage.objects
  for select using (bucket_id = 'home-offer-media');
drop policy if exists "home offer media admin insert" on storage.objects;
create policy "home offer media admin insert" on storage.objects
  for insert to authenticated with check (bucket_id = 'home-offer-media' and public.is_admin());
drop policy if exists "home offer media admin update" on storage.objects;
create policy "home offer media admin update" on storage.objects
  for update to authenticated using (bucket_id = 'home-offer-media' and public.is_admin())
  with check (bucket_id = 'home-offer-media' and public.is_admin());
drop policy if exists "home offer media admin delete" on storage.objects;
create policy "home offer media admin delete" on storage.objects
  for delete to authenticated using (bucket_id = 'home-offer-media' and public.is_admin());

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
    and not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'home_special_offers'
    ) then
    execute 'alter publication supabase_realtime add table public.home_special_offers';
  end if;
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
    and not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'home_special_offer_food_items'
    ) then
    execute 'alter publication supabase_realtime add table public.home_special_offer_food_items';
  end if;
end;
$$;
