-- Shared, non-personal data is published for Supabase Realtime. Existing
-- account-scoped private table policies remain in force.
-- Realtime must still be able to see a row after an admin deactivates it;
-- customer-facing queries filter inactive rows before displaying them.
drop policy if exists "food active public read" on public.food_items;
drop policy if exists "food public read" on public.food_items;
create policy "food public read" on public.food_items
  for select to anon, authenticated using (true);

drop policy if exists "menu public read" on public.categories;
create policy "menu public read" on public.categories
  for select to anon, authenticated using (true);

drop policy if exists "offers public read active" on public.offers;
create policy "offers public read active" on public.offers
  for select to anon, authenticated using (true);

drop policy if exists "home offers public active read" on public.home_special_offers;
create policy "home offers public active read" on public.home_special_offers
  for select to anon, authenticated using (true);

drop policy if exists "home offer foods public active read" on public.home_special_offer_food_items;
create policy "home offer foods public active read" on public.home_special_offer_food_items
  for select to anon, authenticated using (true);

do $$
declare
  table_name text;
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    return;
  end if;

  foreach table_name in array array[
    'food_items',
    'categories',
    'offers',
    'home_special_offers',
    'home_special_offer_food_items',
    'food_review_rating_summaries',
    'restaurant_settings'
  ] loop
    if to_regclass(format('public.%I', table_name)) is not null
      and not exists (
        select 1 from pg_publication_tables
        where pubname = 'supabase_realtime'
          and schemaname = 'public'
          and tablename = table_name
      ) then
      execute format('alter publication supabase_realtime add table public.%I', table_name);
    end if;
  end loop;
end;
$$;
