-- Let customers see active dishes even when temporarily out of stock.
-- Soft-deleted dishes stay hidden and retain foreign keys from historical orders.
alter table public.food_items
  add column if not exists is_active boolean not null default true;

create or replace function public.touch_food_item_updated_at() returns trigger
language plpgsql set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists food_items_touch_updated_at on public.food_items;
create trigger food_items_touch_updated_at
  before update on public.food_items
  for each row execute procedure public.touch_food_item_updated_at();

drop policy if exists "food public read" on public.food_items;
drop policy if exists "food active public read" on public.food_items;
create policy "food active public read" on public.food_items
  for select to anon, authenticated
  using (is_active or public.is_admin());

do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'food_items') then
    alter publication supabase_realtime add table public.food_items;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'categories') then
    alter publication supabase_realtime add table public.categories;
  end if;
end;
$$;
