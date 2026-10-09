-- Cart persistence is always owned by the Supabase auth user. The browser may
-- cache a cart per auth.uid, but this table is the durable source of truth.
-- Admin access to orders is intentionally retained; addresses and profiles
-- remain private to their owning auth user.
alter table public.profiles enable row level security;
drop policy if exists "profiles own or admin read" on public.profiles;
drop policy if exists "profiles owner read" on public.profiles;
create policy "profiles owner read" on public.profiles
  for select to authenticated using (id = (select auth.uid()));

alter table public.addresses enable row level security;
drop policy if exists "addresses own or admin" on public.addresses;
drop policy if exists "addresses owner only" on public.addresses;
create policy "addresses owner only" on public.addresses
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

alter table public.cart_items
  add column if not exists offer_id uuid references public.home_special_offers(id) on delete set null,
  add column if not exists offer_discount_percentage numeric(5,2) not null default 0 check (offer_discount_percentage between 0 and 100),
  add column if not exists special_instructions text;

alter table public.cart_items
  drop constraint if exists cart_items_user_id_food_item_id_size_customizations_key;
create unique index if not exists cart_items_owner_line_unique_idx
  on public.cart_items(
    user_id,
    food_item_id,
    coalesce(size, ''),
    customizations,
    coalesce(offer_id, '00000000-0000-0000-0000-000000000000'::uuid),
    coalesce(special_instructions, '')
  );

alter table public.cart_items enable row level security;
drop policy if exists "cart own or admin" on public.cart_items;
drop policy if exists "cart owner only" on public.cart_items;
create policy "cart owner only" on public.cart_items
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

alter table public.favorites enable row level security;
drop policy if exists "favorites own or admin" on public.favorites;
drop policy if exists "favorites owner only" on public.favorites;
create policy "favorites owner only" on public.favorites
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- Order data is created through the authenticated, validating COD RPC. Direct
-- customer inserts could otherwise fabricate line items or arbitrary totals.
drop policy if exists "orders own create" on public.orders;
drop policy if exists "order items owner create" on public.order_items;
drop policy if exists "order customizations owner create" on public.order_item_customizations;
revoke insert, delete on public.orders from anon, authenticated;
revoke insert, update, delete on public.order_items from anon, authenticated;
revoke insert, update, delete on public.order_item_customizations from anon, authenticated;
grant select, update on public.orders to authenticated;
grant select on public.order_items, public.order_item_customizations to authenticated;

grant select, insert, update, delete on public.cart_items to authenticated;
revoke all on public.cart_items from anon;

create or replace function public.save_customer_cart(p_items jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_item jsonb;
  v_food_id uuid;
  v_offer_id uuid;
  v_quantity integer;
  v_size text;
  v_customizations jsonb;
  v_discount numeric(5,2);
  v_note text;
begin
  if v_user_id is null then raise exception 'Sign in to save your cart.'; end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) > 100 then raise exception 'Invalid cart data.'; end if;

  delete from public.cart_items where user_id = v_user_id;
  for v_item in select value from jsonb_array_elements(p_items) loop
    v_food_id := (v_item->>'food_item_id')::uuid;
    v_quantity := (v_item->>'quantity')::integer;
    v_size := coalesce(v_item->>'size', 'Regular');
    v_customizations := coalesce(v_item->'customizations', '[]'::jsonb);
    v_offer_id := nullif(v_item->>'offer_id', '')::uuid;
    v_discount := coalesce((v_item->>'offer_discount_percentage')::numeric, 0);
    v_note := nullif(v_item->>'special_instructions', '');

    if v_quantity < 1 or v_quantity > 50 then raise exception 'Invalid cart quantity.'; end if;
    if v_size not in ('Regular', 'Large') then raise exception 'Invalid cart size.'; end if;
    if jsonb_typeof(v_customizations) <> 'array' or jsonb_array_length(v_customizations) > 10 then raise exception 'Invalid cart customizations.'; end if;
    if v_discount < 0 or v_discount > 100 then raise exception 'Invalid offer discount.'; end if;
    if v_note is not null and char_length(v_note) > 500 then raise exception 'Cart note is too long.'; end if;
    if not exists (select 1 from public.food_items where id = v_food_id) then raise exception 'A cart food item no longer exists.'; end if;

    insert into public.cart_items(user_id, food_item_id, quantity, size, customizations, offer_id, offer_discount_percentage, special_instructions)
    values(v_user_id, v_food_id, v_quantity, v_size, v_customizations, v_offer_id, v_discount, v_note);
  end loop;
end;
$$;

revoke all on function public.save_customer_cart(jsonb) from public, anon;
grant execute on function public.save_customer_cart(jsonb) to authenticated;

-- A user's cart can sync to their other signed-in devices. RLS and the client
-- subscription filter both scope the event to that same auth.uid().
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
    and to_regclass('public.cart_items') is not null
    and not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'cart_items'
    ) then
    alter publication supabase_realtime add table public.cart_items;
  end if;
end;
$$;
