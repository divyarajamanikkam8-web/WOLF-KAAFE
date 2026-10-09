-- The Wolf Kaafe: fresh Supabase project setup
-- Generated from supabase/migrations in filename order.
-- Run once in the SQL Editor of a NEW/EMPTY project.
-- Includes schema, policies, triggers, storage buckets, seed data, and realtime setup.

-- ============================================================================
-- Migration: 202609300001_initial_schema.sql
-- ============================================================================

create extension if not exists pgcrypto;

do $$ begin
  create type public.app_role as enum ('customer', 'admin');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.order_status as enum ('pending', 'accepted', 'preparing', 'ready', 'out_for_delivery', 'delivered', 'cancelled');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.payment_status as enum ('pending', 'paid');
exception when duplicate_object then null;
end $$;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '', phone text, avatar_url text,
  role public.app_role not null default 'customer', created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.categories (
  id uuid primary key default gen_random_uuid(), name text not null unique, image_url text, sort_order int not null default 0, is_active boolean not null default true, created_at timestamptz not null default now()
);
create table public.food_items (
  id uuid primary key default gen_random_uuid(), category_id uuid references public.categories(id) on delete set null,
  name text not null, description text not null default '', price numeric(10,2) not null check(price >= 0), discount_percent numeric(5,2) not null default 0 check(discount_percent between 0 and 100),
  image_url text, is_veg boolean not null default false, prep_minutes int not null default 20, is_available boolean not null default true, is_featured boolean not null default false,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.customization_groups (
  id uuid primary key default gen_random_uuid(), food_item_id uuid not null references public.food_items(id) on delete cascade, name text not null, required boolean not null default false, sort_order int not null default 0
);
create table public.customization_options (
  id uuid primary key default gen_random_uuid(), group_id uuid not null references public.customization_groups(id) on delete cascade, name text not null, additional_price numeric(10,2) not null default 0 check(additional_price >= 0), is_available boolean not null default true
);
create table public.addresses (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references public.profiles(id) on delete cascade, full_name text not null, phone text not null,
  house text not null, street text not null, area text not null, city text not null, pincode text not null, landmark text, is_default boolean not null default false, created_at timestamptz not null default now()
);
create table public.offers (
  id uuid primary key default gen_random_uuid(), code text unique, title text not null, description text not null default '', discount_type text not null check(discount_type in ('percentage','fixed')),
  discount_value numeric(10,2) not null check(discount_value > 0), min_order numeric(10,2) not null default 0, max_discount numeric(10,2), starts_at timestamptz, ends_at timestamptz, is_active boolean not null default true, created_at timestamptz not null default now()
);
create table public.orders (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references public.profiles(id), address_id uuid references public.addresses(id) on delete set null,
  status public.order_status not null default 'pending', payment_method text not null default 'cod' check(payment_method = 'cod'), payment_status public.payment_status not null default 'pending',
  subtotal numeric(10,2) not null check(subtotal >= 0), delivery_fee numeric(10,2) not null default 0, discount numeric(10,2) not null default 0, total numeric(10,2) not null check(total >= 0),
  address_snapshot jsonb not null, special_instructions text, estimated_delivery_at timestamptz, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.order_items (
  id uuid primary key default gen_random_uuid(), order_id uuid not null references public.orders(id) on delete cascade, food_item_id uuid references public.food_items(id) on delete set null,
  name_snapshot text not null, unit_price numeric(10,2) not null, quantity int not null check(quantity > 0), size text, special_instructions text
);
create table public.order_item_customizations (
  id uuid primary key default gen_random_uuid(), order_item_id uuid not null references public.order_items(id) on delete cascade, option_name_snapshot text not null, additional_price numeric(10,2) not null default 0
);
create table public.cart_items (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references public.profiles(id) on delete cascade, food_item_id uuid not null references public.food_items(id) on delete cascade,
  quantity int not null check(quantity > 0), size text, customizations jsonb not null default '[]', updated_at timestamptz not null default now(), unique(user_id, food_item_id, size, customizations)
);
create table public.favorites (user_id uuid not null references public.profiles(id) on delete cascade, food_item_id uuid not null references public.food_items(id) on delete cascade, created_at timestamptz not null default now(), primary key(user_id, food_item_id));
create table public.reviews (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references public.profiles(id) on delete cascade, order_id uuid not null references public.orders(id) on delete cascade,
  food_item_id uuid references public.food_items(id) on delete set null, food_rating int not null check(food_rating between 1 and 5), delivery_rating int not null check(delivery_rating between 1 and 5), comment text not null default '', created_at timestamptz not null default now(), unique(user_id, order_id, food_item_id)
);
create table public.notifications (
  id uuid primary key default gen_random_uuid(), user_id uuid references public.profiles(id) on delete cascade, title text not null, message text not null, audience text not null default 'customer', read_at timestamptz, created_at timestamptz not null default now()
);
create table public.restaurant_settings (
  id int primary key default 1 check(id=1), restaurant_name text not null default 'THE WOLF KAAFE', logo_url text, phone text, email text, address text,
  opening_time time, closing_time time, is_open boolean not null default true, delivery_fee numeric(10,2) not null default 39, free_delivery_threshold numeric(10,2) not null default 499,
  minimum_order numeric(10,2) not null default 0, delivery_radius_km numeric(5,2) not null default 8, estimated_delivery_minutes int not null default 35
);
insert into public.restaurant_settings(id) values(1) on conflict do nothing;

create or replace function public.is_admin() returns boolean language sql stable security definer set search_path = public as $$ select exists(select 1 from public.profiles where id = auth.uid() and role = 'admin') $$;
create or replace function public.create_profile_for_user() returns trigger language plpgsql security definer set search_path = public as $$ begin insert into public.profiles(id, full_name) values(new.id, coalesce(new.raw_user_meta_data->>'full_name','')); return new; end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute procedure public.create_profile_for_user();

alter table public.profiles enable row level security;
alter table public.categories enable row level security;
alter table public.food_items enable row level security;
alter table public.customization_groups enable row level security;
alter table public.customization_options enable row level security;
alter table public.addresses enable row level security;
alter table public.offers enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.order_item_customizations enable row level security;
alter table public.cart_items enable row level security;
alter table public.favorites enable row level security;
alter table public.reviews enable row level security;
alter table public.notifications enable row level security;
alter table public.restaurant_settings enable row level security;

create policy "profiles own or admin read" on public.profiles for select using(id=auth.uid() or public.is_admin());
create policy "profiles own update" on public.profiles for update using(id=auth.uid()) with check(id=auth.uid() and role='customer');
create policy "menu public read" on public.categories for select using(is_active or public.is_admin());
create policy "menu admin manage categories" on public.categories for all using(public.is_admin()) with check(public.is_admin());
create policy "food public read" on public.food_items for select using(is_available or public.is_admin());
create policy "food admin manage" on public.food_items for all using(public.is_admin()) with check(public.is_admin());
create policy "custom groups public read" on public.customization_groups for select using(true);
create policy "custom groups admin manage" on public.customization_groups for all using(public.is_admin()) with check(public.is_admin());
create policy "custom options public read" on public.customization_options for select using(is_available or public.is_admin());
create policy "custom options admin manage" on public.customization_options for all using(public.is_admin()) with check(public.is_admin());
create policy "addresses own or admin" on public.addresses for all using(user_id=auth.uid() or public.is_admin()) with check(user_id=auth.uid() or public.is_admin());
create policy "offers public read active" on public.offers for select using(is_active or public.is_admin());
create policy "offers admin manage" on public.offers for all using(public.is_admin()) with check(public.is_admin());
create policy "orders own or admin read" on public.orders for select using(user_id=auth.uid() or public.is_admin());
create policy "orders own create" on public.orders for insert with check(user_id=auth.uid() and payment_method='cod' and payment_status='pending' and status='pending');
create policy "orders admin update" on public.orders for update using(public.is_admin()) with check(public.is_admin());
create policy "order items owner or admin read" on public.order_items for select using(exists(select 1 from public.orders o where o.id=order_id and (o.user_id=auth.uid() or public.is_admin())));
create policy "order items owner create" on public.order_items for insert with check(exists(select 1 from public.orders o where o.id=order_id and o.user_id=auth.uid()));
create policy "order customizations owner or admin" on public.order_item_customizations for select using(exists(select 1 from public.order_items i join public.orders o on o.id=i.order_id where i.id=order_item_id and (o.user_id=auth.uid() or public.is_admin())));
create policy "order customizations owner create" on public.order_item_customizations for insert with check(exists(select 1 from public.order_items i join public.orders o on o.id=i.order_id where i.id=order_item_id and o.user_id=auth.uid()));
create policy "cart own or admin" on public.cart_items for all using(user_id=auth.uid() or public.is_admin()) with check(user_id=auth.uid() or public.is_admin());
create policy "favorites own or admin" on public.favorites for all using(user_id=auth.uid() or public.is_admin()) with check(user_id=auth.uid() or public.is_admin());
create policy "reviews public read" on public.reviews for select using(true);
create policy "reviews own insert completed" on public.reviews for insert with check(user_id=auth.uid() and exists(select 1 from public.orders o where o.id=order_id and o.user_id=auth.uid() and o.status='delivered'));
create policy "reviews admin manage" on public.reviews for all using(public.is_admin()) with check(public.is_admin());
create policy "notifications own or admin" on public.notifications for select using(user_id=auth.uid() or public.is_admin() or (user_id is null and audience='customer'));
create policy "notifications owner read update" on public.notifications for update using(user_id=auth.uid()) with check(user_id=auth.uid());
create policy "notifications admin manage" on public.notifications for all using(public.is_admin()) with check(public.is_admin());
create policy "settings public read" on public.restaurant_settings for select using(true);
create policy "settings admin manage" on public.restaurant_settings for all using(public.is_admin()) with check(public.is_admin());

insert into storage.buckets(id,name,public) values ('food-images','food-images',true),('category-images','category-images',true),('restaurant-assets','restaurant-assets',true),('profile-images','profile-images',false) on conflict do nothing;
create policy "public menu images read" on storage.objects for select using(bucket_id in ('food-images','category-images','restaurant-assets'));
create policy "admin menu images manage" on storage.objects for all using(bucket_id in ('food-images','category-images','restaurant-assets') and public.is_admin()) with check(bucket_id in ('food-images','category-images','restaurant-assets') and public.is_admin());
create policy "profile image owner access" on storage.objects for all using(bucket_id='profile-images' and (storage.foldername(name))[1]=auth.uid()::text) with check(bucket_id='profile-images' and (storage.foldername(name))[1]=auth.uid()::text);

alter publication supabase_realtime add table public.orders;


-- ============================================================================
-- Migration: 202610020001_wolf_kaafe_data_persistence.sql
-- ============================================================================

-- Incremental data setup for the customer ordering flow.
-- Safe to run more than once; menu items are upserted by name.

create unique index if not exists food_items_name_unique on public.food_items (name);

insert into public.categories (name, image_url, sort_order, is_active)
values
  ('Burgers', 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=400&q=80', 1, true),
  ('Pizza', 'https://images.unsplash.com/photo-1574071318508-1cdbab80d002?auto=format&fit=crop&w=400&q=80', 2, true),
  ('Biriyani', 'https://images.unsplash.com/photo-1563379091339-03246963d96c?auto=format&fit=crop&w=400&q=80', 3, true),
  ('Shawarma', 'https://images.unsplash.com/photo-1529006557810-274b9b2fc783?auto=format&fit=crop&w=400&q=80', 4, true),
  ('Fried Chicken', 'https://images.unsplash.com/photo-1626082927389-6cd097cdc6ec?auto=format&fit=crop&w=400&q=80', 5, true),
  ('Sandwiches', 'https://images.unsplash.com/photo-1553909489-cd47e0ef937f?auto=format&fit=crop&w=400&q=80', 6, true),
  ('Desserts', 'https://images.unsplash.com/photo-1606313564200-e75d5e30476c?auto=format&fit=crop&w=400&q=80', 7, true),
  ('Beverages', 'https://images.unsplash.com/photo-1461023058943-07fcbe16d735?auto=format&fit=crop&w=400&q=80', 8, true)
on conflict (name) do update set image_url = excluded.image_url, sort_order = excluded.sort_order, is_active = true;

insert into public.food_items (category_id, name, description, price, image_url, is_veg, prep_minutes, is_available, is_featured)
select c.id, f.name, f.description, f.price, f.image_url, f.is_veg, f.prep_minutes, true, f.is_featured
from (values
  ('Wolf Smash Burger', 'Burgers', 'Double smashed beef, cheddar, caramelized onion and signature sauce.', 249::numeric, 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=900&q=85', false, 25, true),
  ('Peri Peri Chicken', 'Fried Chicken', 'Flame grilled peri peri chicken with a cool garlic dip.', 289::numeric, 'https://images.unsplash.com/photo-1626082927389-6cd097cdc6ec?auto=format&fit=crop&w=900&q=85', false, 30, false),
  ('Dum Chicken Biriyani', 'Biriyani', 'Aromatic basmati rice, slow cooked with tender chicken and spices.', 279::numeric, 'https://images.unsplash.com/photo-1563379091339-03246963d96c?auto=format&fit=crop&w=900&q=85', false, 35, true),
  ('Garden Margherita', 'Pizza', 'Stone baked crust, mozzarella, basil and rich tomato sauce.', 299::numeric, 'https://images.unsplash.com/photo-1574071318508-1cdbab80d002?auto=format&fit=crop&w=900&q=85', true, 25, false),
  ('Classic Chicken Shawarma', 'Shawarma', 'Juicy spiced chicken, crunchy pickles and creamy tahini wrap.', 179::numeric, 'https://images.unsplash.com/photo-1529006557810-274b9b2fc783?auto=format&fit=crop&w=900&q=85', false, 20, false),
  ('Choco Lava Cake', 'Desserts', 'Warm chocolate cake with a molten Belgian chocolate centre.', 129::numeric, 'https://images.unsplash.com/photo-1606313564200-e75d5e30476c?auto=format&fit=crop&w=900&q=85', true, 15, false),
  ('Wolf Club Sandwich', 'Sandwiches', 'Toasted triple decker with grilled chicken, egg and house mayo.', 219::numeric, 'https://images.unsplash.com/photo-1553909489-cd47e0ef937f?auto=format&fit=crop&w=900&q=85', false, 20, false),
  ('Classic Iced Coffee', 'Beverages', 'Slow brewed coffee, chilled milk and a hint of vanilla.', 119::numeric, 'https://images.unsplash.com/photo-1461023058943-07fcbe16d735?auto=format&fit=crop&w=900&q=85', true, 10, false)
) as f(name, category, description, price, image_url, is_veg, prep_minutes, is_featured)
join public.categories c on c.name = f.category
on conflict (name) do update set
  category_id = excluded.category_id, description = excluded.description,
  price = excluded.price, image_url = excluded.image_url, is_veg = excluded.is_veg,
  prep_minutes = excluded.prep_minutes, is_available = true, is_featured = excluded.is_featured;

-- Keep the profile table in step with customer name and phone collected at sign-up.
-- Keep phone numbers as text (numeric columns can drop leading zeroes and formatting).
alter table public.profiles alter column phone type text using phone::text;
alter table public.profiles add column if not exists email_id text;

create or replace function public.create_profile_for_user() returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  insert into public.profiles(id, full_name, phone, email_id)
  values(new.id, coalesce(new.raw_user_meta_data->>'full_name',''), nullif(new.raw_user_meta_data->>'phone',''), new.email)
  on conflict (id) do update set
    full_name = excluded.full_name,
    phone = coalesce(excluded.phone, public.profiles.phone),
    email_id = coalesce(excluded.email_id, public.profiles.email_id),
    updated_at = now();
  return new;
end;
$$;
update public.profiles p
set phone = coalesce(nullif(u.raw_user_meta_data->>'phone',''), p.phone),
    email_id = coalesce(u.email, p.email_id),
    updated_at = now()
from auth.users u
where u.id = p.id;

create or replace function public.place_cod_order(p_address jsonb, p_items jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_address_id uuid;
  v_address jsonb;
  v_order_id uuid;
  v_subtotal numeric(10,2) := 0;
  v_delivery_fee numeric(10,2) := 39;
  v_free_threshold numeric(10,2) := 499;
  v_minimum numeric(10,2) := 0;
  v_item jsonb;
  v_food public.food_items%rowtype;
  v_qty integer;
  v_size text;
  v_extras jsonb;
  v_unit numeric(10,2);
  v_order_item_id uuid;
begin
  if v_user_id is null then raise exception 'Sign in before placing an order.'; end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then raise exception 'Your cart is empty.'; end if;
  if coalesce(p_address->>'full_name','') = '' or coalesce(p_address->>'phone','') = '' or coalesce(p_address->>'house','') = '' or coalesce(p_address->>'street','') = '' or coalesce(p_address->>'area','') = '' or coalesce(p_address->>'city','') = '' or coalesce(p_address->>'pincode','') = '' then raise exception 'Complete all required delivery address fields.'; end if;

  insert into public.addresses(user_id, full_name, phone, house, street, area, city, pincode, landmark, is_default)
  values(v_user_id, p_address->>'full_name', p_address->>'phone', p_address->>'house', p_address->>'street', p_address->>'area', p_address->>'city', p_address->>'pincode', nullif(p_address->>'landmark',''), false)
  returning id into v_address_id;
  v_address := jsonb_build_object('full_name',p_address->>'full_name','phone',p_address->>'phone','house',p_address->>'house','street',p_address->>'street','area',p_address->>'area','city',p_address->>'city','pincode',p_address->>'pincode','landmark',p_address->>'landmark');

  select coalesce(delivery_fee,39), coalesce(free_delivery_threshold,499), coalesce(minimum_order,0)
  into v_delivery_fee, v_free_threshold, v_minimum from public.restaurant_settings where id=1;
  for v_item in select value from jsonb_array_elements(p_items) loop
    select * into v_food from public.food_items where id=(v_item->>'food_item_id')::uuid and is_available=true;
    if not found then raise exception 'One of the selected dishes is unavailable.'; end if;
    v_qty := (v_item->>'quantity')::integer;
    if v_qty < 1 or v_qty > 50 then raise exception 'Invalid item quantity.'; end if;
    v_size := coalesce(v_item->>'size','Regular');
    if v_size not in ('Regular','Large') then raise exception 'Invalid size.'; end if;
    v_extras := coalesce(v_item->'extras','[]'::jsonb);
    if jsonb_typeof(v_extras) <> 'array' or jsonb_array_length(v_extras) > 10 then raise exception 'Invalid customizations.'; end if;
    v_unit := v_food.price + case when v_size='Large' then 60 else 0 end + (jsonb_array_length(v_extras) * 30);
    v_subtotal := v_subtotal + (v_unit * v_qty);
  end loop;
  if v_subtotal < v_minimum then raise exception 'Order does not meet the minimum order value.'; end if;
  if v_subtotal >= v_free_threshold then v_delivery_fee := 0; end if;

  insert into public.orders(user_id,address_id,status,payment_method,payment_status,subtotal,delivery_fee,discount,total,address_snapshot)
  values(v_user_id,v_address_id,'pending','cod','pending',v_subtotal,v_delivery_fee,0,v_subtotal+v_delivery_fee,v_address)
  returning id into v_order_id;

  for v_item in select value from jsonb_array_elements(p_items) loop
    select * into v_food from public.food_items where id=(v_item->>'food_item_id')::uuid;
    v_qty := (v_item->>'quantity')::integer;
    v_size := coalesce(v_item->>'size','Regular');
    v_extras := coalesce(v_item->'extras','[]'::jsonb);
    v_unit := v_food.price + case when v_size='Large' then 60 else 0 end + (jsonb_array_length(v_extras) * 30);
    insert into public.order_items(order_id,food_item_id,name_snapshot,unit_price,quantity,size,special_instructions)
    values(v_order_id,v_food.id,v_food.name,v_unit,v_qty,v_size,nullif(v_item->>'note','')) returning id into v_order_item_id;
    insert into public.order_item_customizations(order_item_id,option_name_snapshot,additional_price)
    select v_order_item_id, value #>> '{}', 30 from jsonb_array_elements(v_extras);
  end loop;
  return jsonb_build_object('id',v_order_id,'total',v_subtotal+v_delivery_fee,'subtotal',v_subtotal,'delivery_fee',v_delivery_fee,'address',v_address);
end;
$$;

revoke all on function public.place_cod_order(jsonb,jsonb) from public, anon;
grant execute on function public.place_cod_order(jsonb,jsonb) to authenticated;


-- ============================================================================
-- Migration: 202610020002_customer_profile_security.sql
-- ============================================================================

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


-- ============================================================================
-- Migration: 202610020003_database_driven_menu.sql
-- ============================================================================

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


-- ============================================================================
-- Migration: 202610020004_cod_price_guard.sql
-- ============================================================================

-- The browser sends the price it last displayed. Never create an order when
-- that value no longer matches the current row in PostgreSQL.
create or replace function public.place_cod_order(p_address jsonb, p_items jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_address_id uuid;
  v_address jsonb;
  v_order_id uuid;
  v_subtotal numeric(10,2) := 0;
  v_delivery_fee numeric(10,2) := 39;
  v_free_threshold numeric(10,2) := 499;
  v_minimum numeric(10,2) := 0;
  v_item jsonb;
  v_food public.food_items%rowtype;
  v_qty integer;
  v_size text;
  v_extras jsonb;
  v_unit numeric(10,2);
  v_order_item_id uuid;
begin
  if v_user_id is null then raise exception 'Sign in before placing your order.'; end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then raise exception 'Your cart is empty.'; end if;
  if coalesce(p_address->>'full_name','') = '' or coalesce(p_address->>'phone','') = '' or coalesce(p_address->>'house','') = '' or coalesce(p_address->>'street','') = '' or coalesce(p_address->>'area','') = '' or coalesce(p_address->>'city','') = '' or coalesce(p_address->>'pincode','') = '' then raise exception 'Complete all required delivery address fields.'; end if;

  select coalesce(delivery_fee,39), coalesce(free_delivery_threshold,499), coalesce(minimum_order,0)
  into v_delivery_fee, v_free_threshold, v_minimum from public.restaurant_settings where id=1;

  -- Validate and lock all item rows before creating any records.
  for v_item in select value from jsonb_array_elements(p_items) loop
    select * into v_food from public.food_items
    where id=(v_item->>'food_item_id')::uuid and is_active=true and is_available=true
    for update;
    if not found then raise exception 'One of the selected dishes is unavailable.'; end if;
    if not (v_item ? 'client_price') then raise exception 'Refresh your cart and review current food prices before ordering.'; end if;
    if (v_item->>'client_price')::numeric <> v_food.price then
      raise exception 'The price for % changed. Review the updated cart and place your order again.', v_food.name;
    end if;
    v_qty := (v_item->>'quantity')::integer;
    if v_qty < 1 or v_qty > 50 then raise exception 'Invalid item quantity.'; end if;
    v_size := coalesce(v_item->>'size','Regular');
    if v_size not in ('Regular','Large') then raise exception 'Invalid size.'; end if;
    v_extras := coalesce(v_item->'extras','[]'::jsonb);
    if jsonb_typeof(v_extras) <> 'array' or jsonb_array_length(v_extras) > 10 then raise exception 'Invalid customizations.'; end if;
    v_unit := v_food.price + case when v_size='Large' then 60 else 0 end + (jsonb_array_length(v_extras) * 30);
    v_subtotal := v_subtotal + (v_unit * v_qty);
  end loop;

  if v_subtotal < v_minimum then raise exception 'Order does not meet the minimum order value.'; end if;
  if v_subtotal >= v_free_threshold then v_delivery_fee := 0; end if;

  insert into public.addresses(user_id, full_name, phone, house, street, area, city, pincode, landmark, is_default)
  values(v_user_id, p_address->>'full_name', p_address->>'phone', p_address->>'house', p_address->>'street', p_address->>'area', p_address->>'city', p_address->>'pincode', nullif(p_address->>'landmark',''), false)
  returning id into v_address_id;
  v_address := jsonb_build_object('full_name',p_address->>'full_name','phone',p_address->>'phone','house',p_address->>'house','street',p_address->>'street','area',p_address->>'area','city',p_address->>'city','pincode',p_address->>'pincode','landmark',p_address->>'landmark');

  insert into public.orders(user_id,address_id,status,payment_method,payment_status,subtotal,delivery_fee,discount,total,address_snapshot)
  values(v_user_id,v_address_id,'pending','cod','pending',v_subtotal,v_delivery_fee,0,v_subtotal+v_delivery_fee,v_address)
  returning id into v_order_id;

  for v_item in select value from jsonb_array_elements(p_items) loop
    select * into v_food from public.food_items where id=(v_item->>'food_item_id')::uuid;
    v_qty := (v_item->>'quantity')::integer;
    v_size := coalesce(v_item->>'size','Regular');
    v_extras := coalesce(v_item->'extras','[]'::jsonb);
    v_unit := v_food.price + case when v_size='Large' then 60 else 0 end + (jsonb_array_length(v_extras) * 30);
    insert into public.order_items(order_id,food_item_id,name_snapshot,unit_price,quantity,size,special_instructions)
    values(v_order_id,v_food.id,v_food.name,v_unit,v_qty,v_size,nullif(v_item->>'note','')) returning id into v_order_item_id;
    insert into public.order_item_customizations(order_item_id,option_name_snapshot,additional_price)
    select v_order_item_id, value #>> '{}', 30 from jsonb_array_elements(v_extras);
  end loop;
  return jsonb_build_object('id',v_order_id,'total',v_subtotal+v_delivery_fee,'subtotal',v_subtotal,'delivery_fee',v_delivery_fee,'address',v_address);
end;
$$;

revoke all on function public.place_cod_order(jsonb,jsonb) from public, anon;
grant execute on function public.place_cod_order(jsonb,jsonb) to authenticated;


-- ============================================================================
-- Migration: 202610020005_seed_menu_categories.sql
-- ============================================================================

-- Ensure the standard Wolf Kaafe categories exist for the Add Food form.
-- Existing categories and their active/inactive state are preserved.
insert into public.categories (name, image_url, sort_order, is_active)
values
  ('Burgers', 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=400&q=80', 1, true),
  ('Pizza', 'https://images.unsplash.com/photo-1574071318508-1cdbab80d002?auto=format&fit=crop&w=400&q=80', 2, true),
  ('Biriyani', 'https://images.unsplash.com/photo-1563379091339-03246963d96c?auto=format&fit=crop&w=400&q=80', 3, true),
  ('Shawarma', 'https://images.unsplash.com/photo-1529006557810-274b9b2fc783?auto=format&fit=crop&w=400&q=80', 4, true),
  ('Fried Chicken', 'https://images.unsplash.com/photo-1626082927389-6cd097cdc6ec?auto=format&fit=crop&w=400&q=80', 5, true),
  ('Sandwiches', 'https://images.unsplash.com/photo-1553909489-cd47e0ef937f?auto=format&fit=crop&w=400&q=80', 6, true),
  ('Desserts', 'https://images.unsplash.com/photo-1606313564200-e75d5e30476c?auto=format&fit=crop&w=400&q=80', 7, true),
  ('Beverages', 'https://images.unsplash.com/photo-1461023058943-07fcbe16d735?auto=format&fit=crop&w=400&q=80', 8, true)
on conflict (name) do nothing;


-- ============================================================================
-- Migration: 202610020006_add_requested_categories.sql
-- ============================================================================

-- Add the requested food and drink categories to the database-backed menu.
-- Names stay plain text; each category uses a real food/drink image URL.
insert into public.categories (name, image_url, sort_order, is_active)
values
  ('Pizza', 'https://images.unsplash.com/photo-1574071318508-1cdbab80d002?auto=format&fit=crop&w=400&q=80', 1, true),
  ('Burgers', 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=400&q=80', 2, true),
  ('Sandwiches', 'https://images.unsplash.com/photo-1553909489-cd47e0ef937f?auto=format&fit=crop&w=400&q=80', 3, true),
  ('Pasta', 'https://images.unsplash.com/photo-1473093295043-cdd812d0e601?auto=format&fit=crop&w=400&q=80', 4, true),
  ('Appetizers', 'https://images.unsplash.com/photo-1547592180-85f173990554?auto=format&fit=crop&w=400&q=80', 5, true),
  ('Fruit Juices', 'https://images.unsplash.com/photo-1600271886742-f049cd451bba?auto=format&fit=crop&w=400&q=80', 6, true),
  ('Iced Coffee', 'https://images.unsplash.com/photo-1461023058943-07fcbe16d735?auto=format&fit=crop&w=400&q=80', 7, true),
  ('Milkshakes', 'https://images.unsplash.com/photo-1572490122747-3968b75cc699?auto=format&fit=crop&w=400&q=80', 8, true),
  ('Smoothies', 'https://images.unsplash.com/photo-1505252585461-04db1a846145?auto=format&fit=crop&w=400&q=80', 9, true),
  ('Mocktails', 'https://images.unsplash.com/photo-1513558161293-cdaf765edfd47?auto=format&fit=crop&w=400&q=80', 10, true),
  ('Mojitos', 'https://images.unsplash.com/photo-1514362545857-3bc16c4c7d1b?auto=format&fit=crop&w=400&q=80', 11, true),
  ('Lassi', 'https://images.unsplash.com/photo-1553530666-ba11a7da3888?auto=format&fit=crop&w=400&q=80', 12, true),
  ('Shots', 'https://images.unsplash.com/photo-1514362545857-3bc16c4c7d1b?auto=format&fit=crop&w=400&q=80', 13, true),
  ('Sprout / Chaat', 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&fit=crop&w=400&q=80', 14, true),
  ('Tea', 'https://images.unsplash.com/photo-1544787219-7f47ccb76574?auto=format&fit=crop&w=400&q=80', 15, true)
on conflict (name) do update
set image_url = excluded.image_url,
    sort_order = excluded.sort_order,
    is_active = true;


-- ============================================================================
-- Migration: 202610030001_fix_cod_order_food_lock_rls.sql
-- ============================================================================

-- Customers can read available food rows, but they do not have an UPDATE
-- policy on food_items. PostgreSQL applies UPDATE policies to SELECT FOR
-- UPDATE, so an invoker function could mistake a readable food for a missing
-- one. This RPC validates auth.uid(), availability, price, and quantity itself
-- and uses only schema-qualified database objects, so run it as its owner.
alter function public.place_cod_order(jsonb, jsonb) security definer;
alter function public.place_cod_order(jsonb, jsonb) set search_path = '';

revoke all on function public.place_cod_order(jsonb, jsonb) from public, anon;
grant execute on function public.place_cod_order(jsonb, jsonb) to authenticated;


-- ============================================================================
-- Migration: 202610030001_live_order_realtime.sql
-- ============================================================================

-- Ensure order inserts and admin status/payment updates are available to the
-- customer and owner Realtime subscriptions. This is safe if already enabled.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'orders'
  ) then
    alter publication supabase_realtime add table public.orders;
  end if;
end;
$$;


-- ============================================================================
-- Migration: 202610030002_limit_active_categories.sql
-- ============================================================================

-- Keep the requested 15 categories as the only active categories. Existing
-- categories are deactivated rather than deleted so food/order history keeps
-- its foreign-key references.
insert into public.categories (name, image_url, sort_order, is_active)
values
  ('Pizza', 'https://images.unsplash.com/photo-1574071318508-1cdbab80d002?auto=format&fit=crop&w=400&q=80', 1, true),
  ('Burgers', 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=400&q=80', 2, true),
  ('Sandwiches', 'https://images.unsplash.com/photo-1553909489-cd47e0ef937f?auto=format&fit=crop&w=400&q=80', 3, true),
  ('Pasta', 'https://images.unsplash.com/photo-1473093295043-cdd812d0e601?auto=format&fit=crop&w=400&q=80', 4, true),
  ('Appetizers', 'https://images.unsplash.com/photo-1547592180-85f173990554?auto=format&fit=crop&w=400&q=80', 5, true),
  ('Fruit Juices', 'https://images.unsplash.com/photo-1600271886742-f049cd451bba?auto=format&fit=crop&w=400&q=80', 6, true),
  ('Iced Coffee', 'https://images.unsplash.com/photo-1461023058943-07fcbe16d735?auto=format&fit=crop&w=400&q=80', 7, true),
  ('Milkshakes', 'https://images.unsplash.com/photo-1572490122747-3968b75cc699?auto=format&fit=crop&w=400&q=80', 8, true),
  ('Smoothies', 'https://images.unsplash.com/photo-1505252585461-04db1a846145?auto=format&fit=crop&w=400&q=80', 9, true),
  ('Mocktails', 'https://images.unsplash.com/photo-1513558161293-cdaf765edfd47?auto=format&fit=crop&w=400&q=80', 10, true),
  ('Mojitos', 'https://images.unsplash.com/photo-1514362545857-3bc16c4c7d1b?auto=format&fit=crop&w=400&q=80', 11, true),
  ('Lassi', 'https://images.unsplash.com/photo-1553530666-ba11a7da3888?auto=format&fit=crop&w=400&q=80', 12, true),
  ('Shots', 'https://images.unsplash.com/photo-1514362545857-3bc16c4c7d1b?auto=format&fit=crop&w=400&q=80', 13, true),
  ('Sprout / Chaat', 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&fit=crop&w=400&q=80', 14, true),
  ('Tea', 'https://images.unsplash.com/photo-1544787219-7f47ccb76574?auto=format&fit=crop&w=400&q=80', 15, true)
on conflict (name) do update
set image_url = excluded.image_url,
    sort_order = excluded.sort_order,
    is_active = true;

update public.categories
set is_active = false
where name not in (
  'Pizza', 'Burgers', 'Sandwiches', 'Pasta', 'Appetizers',
  'Fruit Juices', 'Iced Coffee', 'Milkshakes', 'Smoothies',
  'Mocktails', 'Mojitos', 'Lassi', 'Shots', 'Sprout / Chaat', 'Tea'
);


-- ============================================================================
-- Migration: 202610030003_expand_and_seed_full_menu.sql
-- ============================================================================

begin;

-- Database-backed catalog fields used by both Owner and customer screens.
alter table public.food_items add column if not exists subcategory text;
alter table public.food_items add column if not exists food_type text;
alter table public.food_items add column if not exists regular_price numeric(10,2);
alter table public.food_items add column if not exists large_price numeric(10,2);
alter table public.food_items add column if not exists display_order integer not null default 0;

alter table public.food_items drop constraint if exists food_items_food_type_check;
alter table public.food_items add constraint food_items_food_type_check
  check (food_type is null or food_type in ('VEG', 'NON_VEG', 'EGG'));
alter table public.food_items drop constraint if exists food_items_regular_price_check;
alter table public.food_items add constraint food_items_regular_price_check
  check (regular_price is null or regular_price > 0);
alter table public.food_items drop constraint if exists food_items_large_price_check;
alter table public.food_items add constraint food_items_large_price_check
  check (large_price is null or large_price > 0);

-- Pasta has same-name VEG and NON_VEG rows. Replace the old global-name
-- uniqueness rule with a catalog identity that includes category, subcategory,
-- and food type so those two records remain distinct and reruns are safe.
drop index if exists public.food_items_name_unique;

-- Preserve the old Chaat category id if it exists, while using the exact new
-- canonical spelling from this menu.
do $$
declare
  old_category_id uuid;
  canonical_category_id uuid;
begin
  select id into old_category_id from public.categories where name = 'Sprout / Chaat';
  select id into canonical_category_id from public.categories where name = 'Chaat / Sprout';
  if old_category_id is not null and canonical_category_id is null then
    update public.categories set name = 'Chaat / Sprout' where id = old_category_id;
  elsif old_category_id is not null and canonical_category_id is not null then
    update public.food_items set category_id = canonical_category_id where category_id = old_category_id;
    update public.categories set is_active = false where id = old_category_id;
  end if;
end;
$$;

insert into public.categories (name, image_url, sort_order, is_active)
values
  ('Pizza', 'https://images.unsplash.com/photo-1574071318508-1cdbab80d002?auto=format&fit=crop&w=400&q=80', 1, true),
  ('Burgers', 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=400&q=80', 2, true),
  ('Sandwiches', 'https://images.unsplash.com/photo-1553909489-cd47e0ef937f?auto=format&fit=crop&w=400&q=80', 3, true),
  ('Pasta', 'https://images.unsplash.com/photo-1473093295043-cdd812d0e601?auto=format&fit=crop&w=400&q=80', 4, true),
  ('Appetizers', 'https://images.unsplash.com/photo-1547592180-85f173990554?auto=format&fit=crop&w=400&q=80', 5, true),
  ('Fruit Juices', 'https://images.unsplash.com/photo-1600271886742-f049cd451bba?auto=format&fit=crop&w=400&q=80', 6, true),
  ('Iced Coffee', 'https://images.unsplash.com/photo-1461023058943-07fcbe16d735?auto=format&fit=crop&w=400&q=80', 7, true),
  ('Milkshakes', 'https://images.unsplash.com/photo-1572490122747-3968b75cc699?auto=format&fit=crop&w=400&q=80', 8, true),
  ('Smoothies', 'https://images.unsplash.com/photo-1505252585461-04db1a846145?auto=format&fit=crop&w=400&q=80', 9, true),
  ('Mocktails', 'https://images.unsplash.com/photo-1513558161293-cdaf765edfd47?auto=format&fit=crop&w=400&q=80', 10, true),
  ('Mojitos', 'https://images.unsplash.com/photo-1514362545857-3bc16c4c7d1b?auto=format&fit=crop&w=400&q=80', 11, true),
  ('Lassi', 'https://images.unsplash.com/photo-1553530666-ba11a7da3888?auto=format&fit=crop&w=400&q=80', 12, true),
  ('Shots', 'https://images.unsplash.com/photo-1514362545857-3bc16c4c7d1b?auto=format&fit=crop&w=400&q=80', 13, true),
  ('Chaat / Sprout', 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&fit=crop&w=400&q=80', 14, true),
  ('Tea', 'https://images.unsplash.com/photo-1544787219-7f47ccb76574?auto=format&fit=crop&w=400&q=80', 15, true)
on conflict (name) do update
set image_url = excluded.image_url,
    sort_order = excluded.sort_order,
    is_active = true;

update public.categories
set is_active = false
where name not in (
  'Pizza', 'Burgers', 'Sandwiches', 'Pasta', 'Appetizers', 'Fruit Juices',
  'Iced Coffee', 'Milkshakes', 'Smoothies', 'Mocktails', 'Mojitos', 'Lassi',
  'Shots', 'Chaat / Sprout', 'Tea'
);

-- Retire the demo/previous menu without deleting rows referenced by order
-- history. The supplied catalog below reactivates/upserts its own 139 records.
update public.food_items set is_active = false, is_available = false
where is_active or is_available;

create unique index if not exists food_items_catalog_identity_unique
  on public.food_items (category_id, lower(name), coalesce(subcategory, ''), coalesce(food_type, ''))
  where is_active = true;

create temporary table wolf_kaafe_menu_seed (
  category text not null,
  subcategory text,
  name text not null,
  food_type text,
  price numeric(10,2) not null,
  regular_price numeric(10,2),
  large_price numeric(10,2),
  display_order integer not null
) on commit drop;

insert into wolf_kaafe_menu_seed (category, subcategory, name, food_type, price, regular_price, large_price, display_order) values
('Pizza','Veg Pizza','Double Pizza','VEG',160,null,null,1),
('Pizza','Veg Pizza','Capsicum Pizza','VEG',130,null,null,2),
('Pizza','Veg Pizza','Sweet Corn Pizza','VEG',130,null,null,3),
('Pizza','Veg Pizza','Baby Corn Pizza','VEG',130,null,null,4),
('Pizza','Veg Pizza','Mushroom Pizza','VEG',130,null,null,5),
('Pizza','Veg Pizza','Paneer Pizza','VEG',140,null,null,6),
('Pizza','Veg Pizza','Onion Pizza','VEG',120,null,null,7),
('Pizza','Classic Veg Pizza','Veg Farmhouse','VEG',140,null,null,8),
('Pizza','Classic Veg Pizza','Veg Overloaded','VEG',150,null,null,9),
('Pizza','Classic Veg Pizza','French Fries Pizza','VEG',180,null,null,10),
('Pizza','Non-Veg Pizza','Spicy Chicken Pizza','NON_VEG',190,null,null,11),
('Pizza','Non-Veg Pizza','Chicken Feast Pizza','NON_VEG',150,null,null,12),
('Pizza','Non-Veg Pizza','Peri Peri Chicken Pizza','NON_VEG',140,null,null,13),
('Pizza','Non-Veg Pizza','Chicken Overloaded Pizza','NON_VEG',200,null,null,14),
('Burgers','Veg Burgers','Aloo Tikki Burger','VEG',129,null,null,15),
('Burgers','Veg Burgers','Veg Burger','VEG',129,null,null,16),
('Burgers','Veg Burgers','Cheesy Paneer Burger','VEG',129,null,null,17),
('Burgers','Veg Burgers','Egg & Cheese Burger','EGG',189,null,null,18),
('Burgers','Non-Veg Burgers','Chicken Kheema Burger','NON_VEG',189,null,null,19),
('Burgers','Non-Veg Burgers','Spicy Chicken Burger','NON_VEG',189,null,null,20),
('Burgers','Non-Veg Burgers','Chicken Club Burger','NON_VEG',199,null,null,21),
('Sandwiches','Veg Sandwiches','Veg Grilled Sandwich','VEG',129,null,null,22),
('Sandwiches','Veg Sandwiches','Coleslaw Sandwich','VEG',139,null,null,23),
('Sandwiches','Veg Sandwiches','Chocolate Sandwich','VEG',139,null,null,24),
('Sandwiches','Veg Sandwiches','Cheese & Corn Mixed Sandwich','VEG',159,null,null,25),
('Sandwiches','Non-Veg Sandwiches','Minced Chicken Sandwich','NON_VEG',209,null,null,26),
('Sandwiches','Non-Veg Sandwiches','Chicken Ham Sandwich','NON_VEG',199,null,null,27),
('Sandwiches','Non-Veg Sandwiches','Chicken Club Sandwich','NON_VEG',249,null,null,28),
('Pasta','Veg Pasta','Arrabbiata Sauce Pasta','VEG',179,null,null,29),
('Pasta','Veg Pasta','Alfredo Sauce Pasta','VEG',189,null,null,30),
('Pasta','Veg Pasta','Mixed Sauce Pasta','VEG',189,null,null,31),
('Pasta','Non-Veg Pasta','Arrabbiata Sauce Pasta','NON_VEG',199,null,null,32),
('Pasta','Non-Veg Pasta','Alfredo Sauce Pasta','NON_VEG',229,null,null,33),
('Pasta','Non-Veg Pasta','Mixed Sauce Pasta','NON_VEG',229,null,null,34),
('Appetizers','Veg Appetizers','Plain Garlic Bread','VEG',79,79,null,35),
('Appetizers','Veg Appetizers','Cheese Garlic Bread','VEG',109,109,null,36),
('Appetizers','Veg Appetizers','Garlic Garlic Spicy Supreme','VEG',129,129,null,37),
('Appetizers','Veg Appetizers','French Fries','VEG',79,79,109,38),
('Appetizers','Veg Appetizers','Peri Peri / Onion Fries','VEG',99,99,129,39),
('Appetizers','Veg Appetizers','Jalapeno Poppers','VEG',169,169,null,40),
('Appetizers','Non-Veg Appetizers','Chicken Popcorn','NON_VEG',109,null,null,41),
('Appetizers','Non-Veg Appetizers','Boneless Chicken Strips','NON_VEG',109,null,null,42),
('Appetizers','Non-Veg Appetizers','Crispy Chicken Fries','NON_VEG',129,null,null,43),
('Appetizers','Non-Veg Appetizers','Fiery Wings','NON_VEG',190,null,null,44),
('Appetizers','Non-Veg Appetizers','Fried Crispy Chicken 2 pcs','NON_VEG',199,null,null,45),
('Appetizers','Non-Veg Appetizers','Fried Crispy Chicken 4 pcs','NON_VEG',389,null,null,46),
('Appetizers','Non-Veg Appetizers','Fried Crispy Chicken 6 pcs','NON_VEG',449,null,null,47),
('Fruit Juices',null,'Amla',null,60,null,null,48),
('Fruit Juices',null,'Mosambi',null,40,null,null,49),
('Fruit Juices',null,'Pineapple',null,40,null,null,50),
('Fruit Juices',null,'Watermelon',null,40,null,null,51),
('Fruit Juices',null,'Beetroot',null,40,null,null,52),
('Fruit Juices',null,'Cucumber',null,20,null,null,53),
('Fruit Juices',null,'Coconut',null,30,null,null,54),
('Fruit Juices',null,'Karela',null,20,null,null,55),
('Fruit Juices',null,'Loki',null,30,null,null,56),
('Fruit Juices',null,'Anari with Beetroot',null,40,null,null,57),
('Fruit Juices',null,'Apple',null,70,null,null,58),
('Iced Coffee',null,'Cold Coffee',null,70,null,null,59),
('Iced Coffee',null,'Cold Coffee with Ice Cream',null,80,null,null,60),
('Iced Coffee',null,'Mocha',null,90,null,null,61),
('Iced Coffee',null,'Tres Leches Iced Coffee',null,120,null,null,62),
('Iced Coffee',null,'Mexican Iced Coffee',null,120,null,null,63),
('Iced Coffee',null,'Iced Mocha',null,120,null,null,64),
('Iced Coffee',null,'Arabic Iced Coffee',null,120,null,null,65),
('Iced Coffee',null,'Strawberry Coffee',null,130,null,null,66),
('Iced Coffee',null,'Chocolate Cold Coffee',null,130,null,null,67),
('Iced Coffee',null,'Coconut Cold Coffee',null,150,null,null,68),
('Milkshakes',null,'Anjeer Milk Shake',null,100,null,null,69),
('Milkshakes',null,'Dry Fruits Milk Shake',null,120,null,null,70),
('Milkshakes',null,'Dates Shake',null,130,null,null,71),
('Milkshakes',null,'Kit Kat Milk Shake',null,130,null,null,72),
('Milkshakes',null,'Chocolate Thick Shake',null,150,null,null,73),
('Milkshakes',null,'Coffee Thick Shake',null,150,null,null,74),
('Milkshakes',null,'Mango Walnut',null,150,null,null,75),
('Milkshakes',null,'Costa Orange Milk Shake',null,150,null,null,76),
('Milkshakes',null,'Cocktail Milk Shake',null,150,null,null,77),
('Milkshakes',null,'Special Milk Shake',null,180,null,null,78),
('Smoothies',null,'Mango Smoothie',null,120,null,null,79),
('Smoothies',null,'Kiwi Smoothie',null,150,null,null,80),
('Smoothies',null,'Oreo Smoothie',null,150,null,null,81),
('Smoothies',null,'Oreo & Banana Smoothie',null,120,null,null,82),
('Smoothies',null,'Banana Smoothie',null,120,null,null,83),
('Smoothies',null,'Fruit Smoothie',null,120,null,null,84),
('Smoothies',null,'Papaya Smoothie',null,110,null,null,85),
('Smoothies',null,'Chocolate Banana Smoothie',null,150,null,null,86),
('Smoothies',null,'Watermelon Smoothie',null,150,null,null,87),
('Smoothies',null,'Pomegranate Smoothie',null,150,null,null,88),
('Mocktails',null,'Deep Blue Sea Mocktail',null,160,null,null,89),
('Mocktails',null,'Ice Land Mocktail',null,200,null,null,90),
('Mocktails',null,'Falling Ice Bag Mocktail',null,200,null,null,91),
('Mocktails',null,'Midnight Beauty Mocktail',null,250,null,null,92),
('Mocktails',null,'Love Bliss Mocktail',null,270,null,null,93),
('Mocktails',null,'The Violet Mocktail',null,270,null,null,94),
('Mocktails',null,'Margarita Mocktail',null,220,null,null,95),
('Mocktails',null,'The Dark Dark Mocktail',null,270,null,null,96),
('Mocktails',null,'The Way Mocktail',null,300,null,null,97),
('Mocktails',null,'Free Pleasure Mocktail',null,300,null,null,98),
('Mojitos',null,'Virgin Mojito',null,250,null,null,99),
('Mojitos',null,'Green Apple Mojito',null,250,null,null,100),
('Mojitos',null,'Watermelon Mojito',null,230,null,null,101),
('Mojitos',null,'Pineapple Mojito',null,250,null,null,102),
('Mojitos',null,'Kiwi Mojito',null,250,null,null,103),
('Mojitos',null,'Cucumber Mojito',null,250,null,null,104),
('Mojitos',null,'Strawberry Mojito',null,250,null,null,105),
('Mojitos',null,'Orange Mojito',null,250,null,null,106),
('Mojitos',null,'Indian Mojito',null,250,null,null,107),
('Mojitos',null,'Black Grapes Mojito',null,250,null,null,108),
('Lassi',null,'Sweet Lassi',null,40,null,null,109),
('Lassi',null,'Coconut Lassi',null,60,null,null,110),
('Lassi',null,'Mango Lassi',null,60,null,null,111),
('Lassi',null,'Punjabi Lassi',null,50,null,null,112),
('Lassi',null,'Banana Lassi',null,50,null,null,113),
('Lassi',null,'Dry Fruit Lassi',null,90,null,null,114),
('Lassi',null,'Coffee Lassi',null,60,null,null,115),
('Lassi',null,'Strawberry Lassi',null,60,null,null,116),
('Lassi',null,'Fruit Lassi',null,70,null,null,117),
('Shots',null,'Black Dog Shots',null,80,null,null,118),
('Shots',null,'Split Creamy Shots',null,80,null,null,119),
('Shots',null,'Lemon Drop Shots',null,80,null,null,120),
('Shots',null,'Jamun Shots',null,80,null,null,121),
('Shots',null,'Kiwi Shots',null,100,null,null,122),
('Shots',null,'Guava Shots',null,100,null,null,123),
('Shots',null,'Strawberry Shots',null,100,null,null,124),
('Shots',null,'Walnut Shots',null,100,null,null,125),
('Shots',null,'Mango Shots',null,80,null,null,126),
('Shots',null,'Apple Bell Share',null,80,null,null,127),
('Chaat / Sprout',null,'Fruit Chaat',null,35,null,null,128),
('Chaat / Sprout',null,'Fruit Salad',null,45,null,null,129),
('Chaat / Sprout',null,'Peanut Chaat',null,35,null,null,130),
('Chaat / Sprout',null,'Baby Corn with Sprout',null,20,null,null,131),
('Chaat / Sprout',null,'Sprout',null,20,null,null,132),
('Tea',null,'Green Tea',null,40,null,null,133),
('Tea',null,'Black Tea',null,60,null,null,134),
('Tea',null,'Hibiscus Tea',null,60,null,null,135),
('Tea',null,'Ginger Tea',null,60,null,null,136),
('Tea',null,'BnE Tea',null,100,null,null,137),
('Tea',null,'Lavender Tea',null,120,null,null,138),
('Tea',null,'Peppermint Tea',null,100,null,null,139);

do $$
declare
  item record;
  target_category_id uuid;
  target_food_id uuid;
  item_description text;
begin
  if (select count(*) from pg_temp.wolf_kaafe_menu_seed) <> 139 then
    raise exception 'Expected exactly 139 menu seed records.';
  end if;

  for item in select * from pg_temp.wolf_kaafe_menu_seed order by display_order loop
    select id into target_category_id from public.categories where name = item.category and is_active = true;
    if target_category_id is null then
      raise exception 'Missing active category: %', item.category;
    end if;

    item_description := case item.category
      when 'Pizza' then format('A pizza prepared in the %s style.', lower(item.name))
      when 'Burgers' then format('A %s served as a burger.', lower(item.name))
      when 'Sandwiches' then format('A %s served as a satisfying sandwich.', lower(item.name))
      when 'Pasta' then format('A pasta dish in the %s style.', lower(item.name))
      when 'Appetizers' then format('A savoury %s to enjoy as a snack or starter.', lower(item.name))
      when 'Fruit Juices' then format('A refreshing fruit juice in the %s style.', lower(item.name))
      when 'Iced Coffee' then format('A chilled coffee drink in the %s style.', lower(item.name))
      when 'Milkshakes' then format('A smooth milkshake in the %s style.', lower(item.name))
      when 'Smoothies' then format('A refreshing smoothie in the %s style.', lower(item.name))
      when 'Mocktails' then format('A refreshing mocktail in the %s style.', lower(item.name))
      when 'Mojitos' then format('A refreshing mojito in the %s style.', lower(item.name))
      when 'Lassi' then format('A smooth lassi in the %s style.', lower(item.name))
      when 'Shots' then format('A shot drink in the %s style.', lower(item.name))
      when 'Chaat / Sprout' then format('A savoury %s snack.', lower(item.name))
      when 'Tea' then format('A cup of tea in the %s style.', lower(item.name))
      else format('A serving of %s from The Wolf Kaafe.', item.name)
    end;

    select id into target_food_id
    from public.food_items
    where category_id = target_category_id
      and lower(name) = lower(item.name)
      and (subcategory is null or subcategory is not distinct from item.subcategory)
      and (food_type is null or food_type = item.food_type)
    order by (subcategory is not distinct from item.subcategory) desc,
             (food_type is not distinct from item.food_type) desc
    limit 1;

    if target_food_id is null then
      insert into public.food_items (
        category_id, subcategory, name, description, food_type, price,
        regular_price, large_price, image_url, is_veg, prep_minutes,
        is_available, is_featured, is_active, display_order, discount_percent
      ) values (
        target_category_id, item.subcategory, item.name, item_description, item.food_type, item.price,
        item.regular_price, item.large_price, null, coalesce(item.food_type = 'VEG', false), 20,
        true, false, true, item.display_order, 0
      );
    else
      update public.food_items set
        category_id = target_category_id,
        subcategory = item.subcategory,
        name = item.name,
        description = item_description,
        food_type = item.food_type,
        price = item.price,
        regular_price = item.regular_price,
        large_price = item.large_price,
        is_veg = coalesce(item.food_type = 'VEG', false),
        is_available = true,
        is_active = true,
        is_featured = false,
        display_order = item.display_order,
        discount_percent = 0,
        updated_at = now()
      where id = target_food_id;
    end if;
  end loop;

  if (select count(*) from public.food_items where is_active = true) <> 139 then
    raise exception 'Menu seed must leave exactly 139 active food records.';
  end if;
  if (select count(*) from public.categories where is_active = true) <> 15 then
    raise exception 'Menu seed must leave exactly 15 active categories.';
  end if;
end;
$$;

-- COD validation reads and locks food rows as the function owner. The function
-- still requires auth.uid(), verifies availability/price, and is executable
-- only by authenticated callers.
create or replace function public.place_cod_order(p_address jsonb, p_items jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_address_id uuid;
  v_address jsonb;
  v_order_id uuid;
  v_subtotal numeric(10,2) := 0;
  v_delivery_fee numeric(10,2) := 39;
  v_free_threshold numeric(10,2) := 499;
  v_minimum numeric(10,2) := 0;
  v_item jsonb;
  v_food public.food_items%rowtype;
  v_qty integer;
  v_size text;
  v_extras jsonb;
  v_variant_price numeric(10,2);
  v_unit numeric(10,2);
  v_order_item_id uuid;
begin
  if v_user_id is null then raise exception 'Sign in before placing your order.'; end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then raise exception 'Your cart is empty.'; end if;
  if coalesce(p_address->>'full_name','') = '' or coalesce(p_address->>'phone','') = '' or coalesce(p_address->>'house','') = '' or coalesce(p_address->>'street','') = '' or coalesce(p_address->>'area','') = '' or coalesce(p_address->>'city','') = '' or coalesce(p_address->>'pincode','') = '' then raise exception 'Complete all required delivery address fields.'; end if;

  select coalesce(delivery_fee,39), coalesce(free_delivery_threshold,499), coalesce(minimum_order,0)
  into v_delivery_fee, v_free_threshold, v_minimum from public.restaurant_settings where id=1;

  for v_item in select value from jsonb_array_elements(p_items) loop
    select * into v_food from public.food_items
    where id=(v_item->>'food_item_id')::uuid and is_active=true and is_available=true
    for update;
    if not found then raise exception 'One of the selected dishes is unavailable.'; end if;
    if not (v_item ? 'client_price') then raise exception 'Refresh your cart and review current food prices before ordering.'; end if;
    v_size := coalesce(v_item->>'size','Regular');
    if v_food.regular_price is not null or v_food.large_price is not null then
      if v_size = 'Regular' and v_food.regular_price is not null then
        v_variant_price := v_food.regular_price;
      elsif v_size = 'Large' and v_food.large_price is not null then
        v_variant_price := v_food.large_price;
      else
        raise exception 'The selected size is unavailable for %.', v_food.name;
      end if;
    else
      if v_size not in ('Regular','Large') then raise exception 'Invalid size.'; end if;
      v_variant_price := v_food.price;
    end if;
    if (v_item->>'client_price')::numeric <> v_variant_price then
      raise exception 'The price for % changed. Review the updated cart and place your order again.', v_food.name;
    end if;

    v_qty := (v_item->>'quantity')::integer;
    if v_qty < 1 or v_qty > 50 then raise exception 'Invalid item quantity.'; end if;
    v_extras := coalesce(v_item->'extras','[]'::jsonb);
    if jsonb_typeof(v_extras) <> 'array' or jsonb_array_length(v_extras) > 10 then raise exception 'Invalid customizations.'; end if;
    v_unit := v_variant_price + (jsonb_array_length(v_extras) * 30);
    v_subtotal := v_subtotal + (v_unit * v_qty);
  end loop;

  if v_subtotal < v_minimum then raise exception 'Order does not meet the minimum order value.'; end if;
  if v_subtotal >= v_free_threshold then v_delivery_fee := 0; end if;

  insert into public.addresses(user_id, full_name, phone, house, street, area, city, pincode, landmark, is_default)
  values(v_user_id, p_address->>'full_name', p_address->>'phone', p_address->>'house', p_address->>'street', p_address->>'area', p_address->>'city', p_address->>'pincode', nullif(p_address->>'landmark',''), false)
  returning id into v_address_id;
  v_address := jsonb_build_object('full_name',p_address->>'full_name','phone',p_address->>'phone','house',p_address->>'house','street',p_address->>'street','area',p_address->>'area','city',p_address->>'city','pincode',p_address->>'pincode','landmark',p_address->>'landmark');

  insert into public.orders(user_id,address_id,status,payment_method,payment_status,subtotal,delivery_fee,discount,total,address_snapshot)
  values(v_user_id,v_address_id,'pending','cod','pending',v_subtotal,v_delivery_fee,0,v_subtotal+v_delivery_fee,v_address)
  returning id into v_order_id;

  for v_item in select value from jsonb_array_elements(p_items) loop
    select * into v_food from public.food_items where id=(v_item->>'food_item_id')::uuid;
    v_qty := (v_item->>'quantity')::integer;
    v_size := coalesce(v_item->>'size','Regular');
    v_extras := coalesce(v_item->'extras','[]'::jsonb);
    if v_food.regular_price is not null or v_food.large_price is not null then
      v_variant_price := case when v_size = 'Large' then v_food.large_price else v_food.regular_price end;
    else
      v_variant_price := v_food.price;
    end if;
    v_unit := v_variant_price + (jsonb_array_length(v_extras) * 30);
    insert into public.order_items(order_id,food_item_id,name_snapshot,unit_price,quantity,size,special_instructions)
    values(v_order_id,v_food.id,v_food.name,v_unit,v_qty,v_size,nullif(v_item->>'note','')) returning id into v_order_item_id;
    insert into public.order_item_customizations(order_item_id,option_name_snapshot,additional_price)
    select v_order_item_id, value #>> '{}', 30 from jsonb_array_elements(v_extras);
  end loop;
  return jsonb_build_object('id',v_order_id,'total',v_subtotal+v_delivery_fee,'subtotal',v_subtotal,'delivery_fee',v_delivery_fee,'address',v_address);
end;
$$;

revoke all on function public.place_cod_order(jsonb,jsonb) from public, anon;
grant execute on function public.place_cod_order(jsonb,jsonb) to authenticated;

commit;


-- ============================================================================
-- Migration: 202610030004_unique_food_image_assignments.sql
-- ============================================================================

begin;

-- Store a content digest with each uploaded menu image. This makes it possible
-- to reject assigning the same photo bytes to more than one food item.
alter table public.food_items
  add column if not exists image_sha256 text;

alter table public.food_items
  drop constraint if exists food_items_image_sha256_check;
alter table public.food_items
  add constraint food_items_image_sha256_check
  check (image_sha256 is null or image_sha256 ~ '^[0-9a-f]{64}$');

update public.food_items
set image_url = null,
    image_sha256 = null,
    updated_at = now()
where image_url is not null and btrim(image_url) = '';

-- Keep one existing record when older data already reuses the same URL.
-- The remaining rows are marked missing so the Admin page can assign an
-- item-specific image instead of silently showing another food's photo.
with ranked_images as (
  select id,
         row_number() over (
           partition by btrim(image_url)
           order by updated_at desc nulls last, created_at desc nulls last, id
         ) as position
  from public.food_items
  where image_url is not null and btrim(image_url) <> ''
)
update public.food_items as food
set image_url = null,
    image_sha256 = null,
    updated_at = now()
from ranked_images
where food.id = ranked_images.id
  and ranked_images.position > 1;

-- Also clear previously recorded duplicate file digests, if this migration is
-- being applied after an earlier manual rollout of the digest column.
with ranked_digests as (
  select id,
         row_number() over (
           partition by image_sha256
           order by updated_at desc nulls last, created_at desc nulls last, id
         ) as position
  from public.food_items
  where image_sha256 is not null
)
update public.food_items as food
set image_url = null,
    image_sha256 = null,
    updated_at = now()
from ranked_digests
where food.id = ranked_digests.id
  and ranked_digests.position > 1;

-- Reject both reusing an image URL and uploading the same image file under a
-- different URL. Null values remain allowed while existing records are being
-- assigned their item-specific photos.
create unique index if not exists food_items_image_url_unique
  on public.food_items (image_url)
  where image_url is not null;

create unique index if not exists food_items_image_sha256_unique
  on public.food_items (image_sha256)
  where image_sha256 is not null;

commit;


-- ============================================================================
-- Migration: 202610030005_assign_unique_food_photos.sql
-- ============================================================================

begin;

-- Store the item-specific image digest used by the menu management checks.
alter table public.food_items
  add column if not exists image_sha256 text;

create temporary table wolf_kaafe_photo_assignments (
  id uuid primary key,
  image_url text not null unique,
  image_sha256 text not null unique
) on commit drop;

insert into wolf_kaafe_photo_assignments (id, image_url, image_sha256)
values
  ('627392ed-3c51-4bc0-aaeb-e4a98c257b8d'::uuid, '/food-images/627392ed-3c51-4bc0-aaeb-e4a98c257b8d.webp', '368a88af1bacbdf23e629252f658a80e1184f9764a6bb64415059807aa36e5d6'),
  ('9f500c7e-fd10-4a2a-ad5b-a987b0b3c3bd'::uuid, '/food-images/9f500c7e-fd10-4a2a-ad5b-a987b0b3c3bd.webp', '5942a1b2771ac7b5797d1694c0811c78cba92a01fdac43d583d7fd60a7e61c1a'),
  ('cdcf669b-5f20-4c13-b1cd-364be12f43e2'::uuid, '/food-images/cdcf669b-5f20-4c13-b1cd-364be12f43e2.webp', 'd0fac8ae89063baa19248be9463ac9064eb1f63974ad6aaecd5862f310fd1cda'),
  ('cf24e19e-8dcb-4926-b74b-e68ed2ca8644'::uuid, '/food-images/cf24e19e-8dcb-4926-b74b-e68ed2ca8644.webp', '66c60a8d5a7502175d3f088eadc48ff84457498fd70016c6e8c35996f39bd9b0'),
  ('604af462-a5bf-4942-88ec-86b1757f8c03'::uuid, '/food-images/604af462-a5bf-4942-88ec-86b1757f8c03.webp', 'ed3d84f5aefcddca5f65c9f838c424536469a29671901b2a689618e9df91bd93'),
  ('2e39ecd9-1f51-4428-bf94-25065c29db66'::uuid, '/food-images/2e39ecd9-1f51-4428-bf94-25065c29db66.webp', '2164eb7d5525998ed891b7def28c1618332fae89c48cf6b0ba17dac197a90f6a'),
  ('358ffb6b-ea92-4eca-8d41-41c89ad454f5'::uuid, '/food-images/358ffb6b-ea92-4eca-8d41-41c89ad454f5.webp', 'eec29ffb80c2029a948aba2543caea6fb8734db2f561dda334d2cebe390b13ea'),
  ('4ab31ea6-3929-4298-ad42-4ddb2b9bcbbe'::uuid, '/food-images/4ab31ea6-3929-4298-ad42-4ddb2b9bcbbe.webp', '1caa9b36dff5604474eed2a159ac3ad33ee91c587ae720e2ac314e2c39d002cf'),
  ('7489e7d9-6f28-4e0c-9229-acf99829ccfb'::uuid, '/food-images/7489e7d9-6f28-4e0c-9229-acf99829ccfb.webp', 'e2916eff676183c3f8ebd8d6d3b3562163827bcbfcc26205d440354e99e2b08a'),
  ('57af4db3-a713-4ba0-a962-60316f815dc5'::uuid, '/food-images/57af4db3-a713-4ba0-a962-60316f815dc5.webp', '922dc081f6b9e6d74064b1305ec2c588687550736ccd4fe1edd867b98d9cffcf'),
  ('6c7d85cf-fd49-46b0-8a89-4ed2d1523973'::uuid, '/food-images/6c7d85cf-fd49-46b0-8a89-4ed2d1523973.webp', 'c588470c94ed6f320181bbdc6b73ba305d8f49b47e85524d99ee1b5e97c32d36'),
  ('66d62d9c-10d1-49f0-9561-b60d0f506e3e'::uuid, '/food-images/66d62d9c-10d1-49f0-9561-b60d0f506e3e.webp', '92583c6aefbcd4bd2607f84fceb50562abd9319504cea83f37f32693ec21438a'),
  ('7ed6cf97-a273-4c67-abaa-4a79e9a05af2'::uuid, '/food-images/7ed6cf97-a273-4c67-abaa-4a79e9a05af2.webp', '7e40fee5ce11c994718377afd4099977dcc3f4b98ff34f06744a6625a5e16e89'),
  ('d16f7eac-1739-4739-9c0d-102b90dd4e34'::uuid, '/food-images/d16f7eac-1739-4739-9c0d-102b90dd4e34.webp', 'b1be165ca3239bb95b630be2133399317bc296de99b3a88311a5f4594dcb2b17'),
  ('959028ec-d57d-4dc7-a617-304e17b049f8'::uuid, '/food-images/959028ec-d57d-4dc7-a617-304e17b049f8.webp', 'b3967261eff82b77681abbf6b930c5c035c5a29c03804269a86bc2f283142508'),
  ('65437378-9bc7-45d6-ad15-31f054bc1040'::uuid, '/food-images/65437378-9bc7-45d6-ad15-31f054bc1040.webp', 'f66e40e00ed848757b435856732b0e72e975fd07994c0efee46dca5d5938f0b1'),
  ('4d44fff8-5d1b-495e-8323-29a16878a1cd'::uuid, '/food-images/4d44fff8-5d1b-495e-8323-29a16878a1cd.webp', '9aae01b947f1ea5093750e67895ce54fd186da542f014215cd30f399f13fc2c5'),
  ('00faf01b-e495-42ea-932a-9530d3d37541'::uuid, '/food-images/00faf01b-e495-42ea-932a-9530d3d37541.webp', '9338367afb255f01b32b8a82f2728fafffacc724de85939a802fa6665948274d'),
  ('f438e435-7727-4004-857b-c471f1733921'::uuid, '/food-images/f438e435-7727-4004-857b-c471f1733921.webp', '369bf040550fbd07486d9368fefe52c75ac99552501ec4b832c4add040ad4f57'),
  ('3e3b5b34-5daf-45cc-8933-87bb05a55011'::uuid, '/food-images/3e3b5b34-5daf-45cc-8933-87bb05a55011.webp', '6bb8b787197ac7891b40dd0844340ba3791eadc52cbc996f0d6d9ffa349ee055'),
  ('582857a3-45eb-4ef5-9fb8-63931ca86207'::uuid, '/food-images/582857a3-45eb-4ef5-9fb8-63931ca86207.webp', '967d31867501b01e4c36890d737a427ce88f5cf897cbe1dc165937ca5c621edd'),
  ('c3be513f-5911-49be-8c36-9f1d6dbe4286'::uuid, '/food-images/c3be513f-5911-49be-8c36-9f1d6dbe4286.webp', 'd30a65485a9b25bf7fb36845fac6c17866372fb2459b139dbea32194235f9504'),
  ('daa6f201-5a21-43c1-adad-e10deaf960f0'::uuid, '/food-images/daa6f201-5a21-43c1-adad-e10deaf960f0.webp', 'dbab954ede4866fb374e0361c8b64499720c413c5b7baa4d920d41ba21f3f49e'),
  ('a6c4c47a-87db-4fb9-bf5d-a96f0e79083d'::uuid, '/food-images/a6c4c47a-87db-4fb9-bf5d-a96f0e79083d.webp', 'aaed5bb2a3a1e037d3c51dc399651908ac2e5ff62860b48b86fad56ac15b3024'),
  ('fc1d4a2d-9e7f-445c-b7e6-471c530cb0ad'::uuid, '/food-images/fc1d4a2d-9e7f-445c-b7e6-471c530cb0ad.webp', '301fb21cfecae795a17ab570f02cd491e571d4aef9ac466066c7c68a76e16661'),
  ('c217eff5-410d-47ad-a73b-18144c81e455'::uuid, '/food-images/c217eff5-410d-47ad-a73b-18144c81e455.webp', '5dfb1e4af87582510b77479ed6104cd21b4987d76917f290a328eed42222ee09'),
  ('6e65379f-19bf-40de-bd4c-815db0443e8c'::uuid, '/food-images/6e65379f-19bf-40de-bd4c-815db0443e8c.webp', '0bd63b6971a5978bbc6c4632bc1d600c968ae06c079d378d7b3ddcfd825939b0'),
  ('6b1eeb3b-4fd7-4f64-9688-987587a8884f'::uuid, '/food-images/6b1eeb3b-4fd7-4f64-9688-987587a8884f.webp', 'a633ada00146e18ad31649a1d096e1cb3b2a643bfb19733282bfd48f56b7f3e9'),
  ('dd87aaa1-3f3d-4295-8900-3a7efff670d7'::uuid, '/food-images/dd87aaa1-3f3d-4295-8900-3a7efff670d7.webp', 'b81710bf73ebc65d66ad82ea2c1400498ffb59e48aabedb43ef1b852d72f2478'),
  ('d83adc46-33b8-4607-96a8-1cf79b6d6d4b'::uuid, '/food-images/d83adc46-33b8-4607-96a8-1cf79b6d6d4b.webp', '8f8f72f4685a963623b8eb8f0097f33cc4af97d0bd67c6a602e01e011be763ab'),
  ('9c1a7436-7092-48f2-964f-daab781215a1'::uuid, '/food-images/9c1a7436-7092-48f2-964f-daab781215a1.webp', 'e91aa4b5aa9c2e63b5d16d9285cbc920bac567be5816f804527211af181bae9e'),
  ('b164e725-7fc9-4da6-a16b-9c3a48833f21'::uuid, '/food-images/b164e725-7fc9-4da6-a16b-9c3a48833f21.webp', '197bf9f0247883debf13db364aaf94463571ec04de26102a64a36da7625b3fd2'),
  ('c0185002-974a-406c-bf3d-b272d13ebe30'::uuid, '/food-images/c0185002-974a-406c-bf3d-b272d13ebe30.webp', 'd3b5e4ac86f440e1ed5a958bfa622a4eb8f717bbd71680c83aca02fc5467f8a4'),
  ('6d9fd612-a559-447e-8bb5-2ab6182f28e2'::uuid, '/food-images/6d9fd612-a559-447e-8bb5-2ab6182f28e2.webp', '7fa001e499f87b6f1886fbff731539c7761396ec9337dcd9bb5a9d50047fe44d'),
  ('79342e80-1f6a-4d42-85ae-e4edf94bb20e'::uuid, '/food-images/79342e80-1f6a-4d42-85ae-e4edf94bb20e.webp', '25853228cbb5e45808448e7f04f32981022642ae513cc7b123d239b57b39567a'),
  ('d076ddc1-a273-4a48-9db7-c2a0ff12e134'::uuid, '/food-images/d076ddc1-a273-4a48-9db7-c2a0ff12e134.webp', 'a64b3f8a160b5fdec678a8e94bd0474647bc79f1f1cda429987185f82c6057ee'),
  ('3cd7e9f0-7fb7-47a9-9638-62f340d004be'::uuid, '/food-images/3cd7e9f0-7fb7-47a9-9638-62f340d004be.webp', '23d86a3296c032ce55a1b2ef2e6678f7880f20745eac06edb042d81de58e9f44'),
  ('af1e53a4-24aa-4f5b-be48-fcdbfd9900e5'::uuid, '/food-images/af1e53a4-24aa-4f5b-be48-fcdbfd9900e5.webp', 'a39afb2b36a52817655e0eff8aaceadf963a876cdceeeedfd5ebf3027c757805'),
  ('11d715ba-e855-4295-bfbf-69cc481ebaeb'::uuid, '/food-images/11d715ba-e855-4295-bfbf-69cc481ebaeb.webp', 'db3368df47fdb51b7c58a9c4b102d0f22fb537c33462b8740c9e2ab8faedee61'),
  ('3abc2855-d76a-46c3-9f68-1c81057424d5'::uuid, '/food-images/3abc2855-d76a-46c3-9f68-1c81057424d5.webp', 'd31eaa969f91abce3f4bf140ba0e3f0f3557af3cc865a4ee1c3ee84c499e3826'),
  ('7a2deafa-071a-4039-b0d1-82b811bb9340'::uuid, '/food-images/7a2deafa-071a-4039-b0d1-82b811bb9340.webp', '29d0ddcaf07a754a686fa28fbbd3d9d4f02907fff69575eca12b90cf3d568bd0'),
  ('43ca6e97-837e-4658-a9aa-b5b8a778f3bb'::uuid, '/food-images/43ca6e97-837e-4658-a9aa-b5b8a778f3bb.webp', '0c6cc8bf8fac0503d80ad37559443ffc217acee16dff29dd6774498f0d11a444'),
  ('10302a1d-fafe-4afe-878a-d12463249ef6'::uuid, '/food-images/10302a1d-fafe-4afe-878a-d12463249ef6.webp', '2dbc2bb5f9d05a1139269d8b4e4937d7018165cbdeb21a6e9b259af54bd79825'),
  ('2bf941c0-d057-47f4-8e63-5edba6c343ac'::uuid, '/food-images/2bf941c0-d057-47f4-8e63-5edba6c343ac.webp', 'f15ce58406cc53992e011bb94c1ef6e5069ccf61aa404a4a65e8f1d2d404aec5'),
  ('e5760aaf-ccf0-4b88-8642-7188ffe52afd'::uuid, '/food-images/e5760aaf-ccf0-4b88-8642-7188ffe52afd.webp', 'b578dda88ca4a7514a6adacd30affddbe27ed2715b47be0b77e47eb9c2add447'),
  ('3e71a1db-82eb-40b2-8ed8-fb0e96ff7c1f'::uuid, '/food-images/3e71a1db-82eb-40b2-8ed8-fb0e96ff7c1f.webp', 'e8127f6431056b199bb15e54637f558429eb8136e4b6b29cc580f50e7b6ef7fa'),
  ('bc20c7c2-8eb7-4961-9f8a-358951ce10b1'::uuid, '/food-images/bc20c7c2-8eb7-4961-9f8a-358951ce10b1.webp', 'e25e2dbec562bfbff1695eabb209c4ee9f8548bbd558c40e46eb4e00ffcbc916'),
  ('e8acbfec-0d3d-4c4d-a1e7-65dd0817166a'::uuid, '/food-images/e8acbfec-0d3d-4c4d-a1e7-65dd0817166a.webp', '9782f7b35c52a62a8f05ef4fdfcad1f14a0f4cf0b6af2c8b4f9a606750911fd1'),
  ('b25abcb2-4448-4f4b-aafb-e29de097a108'::uuid, '/food-images/b25abcb2-4448-4f4b-aafb-e29de097a108.webp', 'd93353ebc6f4ec6e3325db5694112a57d3d17208caf01d7e790539f05b93819f'),
  ('4429d1e1-8362-42a6-8bf2-46744f0c1974'::uuid, '/food-images/4429d1e1-8362-42a6-8bf2-46744f0c1974.webp', '37e0d067b63022e380bb1e2615295250d8b0f02a3a1fdf14f0c82f8a26a04bfd'),
  ('4d91dfbb-86e4-41fb-a919-a131488e2ee7'::uuid, '/food-images/4d91dfbb-86e4-41fb-a919-a131488e2ee7.webp', '7ee3c80730e9c9ad94166df5d37bac483998c7c378645737767335959544c586'),
  ('30bb8430-126a-4405-b6b0-2b73f28deb00'::uuid, '/food-images/30bb8430-126a-4405-b6b0-2b73f28deb00.webp', '950a8663e7112f1ac03ffd9900523dde2435801c3979de773a24cfd0083fcde8'),
  ('17a2ea12-979d-4170-af0d-e1f4d5234c4e'::uuid, '/food-images/17a2ea12-979d-4170-af0d-e1f4d5234c4e.webp', '990e22f55ccb553887d52141f83671e46cd9e4516794f71e6f27f24f42644eaf'),
  ('beca50ef-607f-4053-b5a0-df50d2518914'::uuid, '/food-images/beca50ef-607f-4053-b5a0-df50d2518914.webp', '9fe0f37734a80a6dded3a6bb778679540e8bb16c2bfbb8af6d47afcf5951e693'),
  ('85c09d72-e5d8-467e-b358-8033f3de0787'::uuid, '/food-images/85c09d72-e5d8-467e-b358-8033f3de0787.webp', '1d1cb49f911eff72ee90ce39987fbb7b06d72de811fbb294952b520a52f329d1'),
  ('77b49ca4-82b3-47fd-9dac-e728988e90cf'::uuid, '/food-images/77b49ca4-82b3-47fd-9dac-e728988e90cf.webp', '3bc4a8dd48c93aa60e8313af973afa7337f5f6d3a86f61d47d570645d6d38875'),
  ('3f621ba1-f487-490e-928e-923b6204b599'::uuid, '/food-images/3f621ba1-f487-490e-928e-923b6204b599.webp', '7182ea3180fdd733f19b9842dfa87f46ac363fb110a6afb99272c4b756a48fc5'),
  ('48e55431-b38f-459b-9d85-06a789734fcb'::uuid, '/food-images/48e55431-b38f-459b-9d85-06a789734fcb.webp', '1677a17f6d8ec08361415b41f7252c4c11ef9e8c0ec0f955089b1bf72537b549'),
  ('c66eacb0-e87e-420a-9f7b-1e4e54d06b2e'::uuid, '/food-images/c66eacb0-e87e-420a-9f7b-1e4e54d06b2e.webp', 'fa3f02d3bce37b5699c7a2f5b0e14edb3bc593a825d4a2054d2ea2fb898adb43'),
  ('8db70bef-4cf7-4d36-82e3-335d11eab0a2'::uuid, '/food-images/8db70bef-4cf7-4d36-82e3-335d11eab0a2.webp', '6202799336a9a07e7bfe425b53d0e035d3abd0e0cb142c80476d1ef8d4124dc6'),
  ('2b13e5b8-8ae3-4348-b895-5dcefe12470d'::uuid, '/food-images/2b13e5b8-8ae3-4348-b895-5dcefe12470d.webp', '65a091ad0eb1fcc54e039f63d015baa512eecdcb64a3829e2b31ca70886d5cc9'),
  ('8658eab1-e449-480f-a217-c1dd1a9e8de0'::uuid, '/food-images/8658eab1-e449-480f-a217-c1dd1a9e8de0.webp', '3b9e342e54b85afcdaebc1105ff79b600001bf6ee1ad84e2fcf07c7513043daf'),
  ('31df72e4-d8d1-41df-a6bd-b34467d61428'::uuid, '/food-images/31df72e4-d8d1-41df-a6bd-b34467d61428.webp', '5d848819ff9732edb00a5d6be9ae2ff053f0c409deba451a7ff4fd9174b93c0f'),
  ('e4fb3791-a20f-4c43-af91-8079bcb14278'::uuid, '/food-images/e4fb3791-a20f-4c43-af91-8079bcb14278.webp', '07d09f97736172606a011f5d596da3a99f2a0af3e799c82d8306bfb8a931698f'),
  ('7a692fa2-defb-42da-9e94-1228c0a01eaa'::uuid, '/food-images/7a692fa2-defb-42da-9e94-1228c0a01eaa.webp', 'f59ed0ef0ae8294585a451f3a3dcc394a018e855a5990b537fe4fcb4c9a4d4b6'),
  ('7195afb0-984f-47ca-854c-bfe91689e47a'::uuid, '/food-images/7195afb0-984f-47ca-854c-bfe91689e47a.webp', '2114a4e9147188ce4b5e092cb2985d960ba0882c938ab02fd1c7dbd27e48bcba'),
  ('f9595e20-2fcd-47a4-8d7f-c9dc7a4b8c1e'::uuid, '/food-images/f9595e20-2fcd-47a4-8d7f-c9dc7a4b8c1e.webp', '914557c2b9987c0fc65071ef7ba6c8365356647aa2256b7706cbad272782383e'),
  ('649f41d5-5cfc-4a53-82b1-e4d17f5a9037'::uuid, '/food-images/649f41d5-5cfc-4a53-82b1-e4d17f5a9037.webp', 'e7097c7313874507458fbe884a7bcc70bf5682afaf8fd2eb67d805938a993c82'),
  ('3058db77-e343-4955-b59d-d9a5413766a6'::uuid, '/food-images/3058db77-e343-4955-b59d-d9a5413766a6.webp', '5ad876f191d4f3a5a2ab6bfbc7c569767c748131a87323dc94576b0afc782fcd'),
  ('db2b56ba-2d87-486a-978d-64f7226d5823'::uuid, '/food-images/db2b56ba-2d87-486a-978d-64f7226d5823.webp', 'd6890663d0fb695d7006996c109277732a2164841c2e429c52e6c4d5aa7db002'),
  ('f704afb2-3593-47f0-a04b-02ce53dda7e6'::uuid, '/food-images/f704afb2-3593-47f0-a04b-02ce53dda7e6.webp', '6f3d35a5a48195852eb61a48016b078c8110c3eba24aeb48cd5e2ff9e3a780da'),
  ('6cd18615-ff65-487f-b8b3-05f5113fe2b2'::uuid, '/food-images/6cd18615-ff65-487f-b8b3-05f5113fe2b2.webp', 'e799f6eeefb6845d0663bab10e2535fcc57016d31387699f02ab9a17bf3f114a'),
  ('d690683d-0ff4-41c8-82b9-209a8126419c'::uuid, '/food-images/d690683d-0ff4-41c8-82b9-209a8126419c.webp', '037d4bc607c9f520d774d1167ac75b7a8e529a95682d046aabf0a5f318941a42'),
  ('a8de328f-864b-4b4e-a688-0ee7e38cb1a9'::uuid, '/food-images/a8de328f-864b-4b4e-a688-0ee7e38cb1a9.webp', 'd387750aabfc02a4cff23e92e92ccc75025cf6a6491ed0c4dcf01ba1b5fad3a2'),
  ('85c8a09f-e111-4d9d-b774-208b46c8636c'::uuid, '/food-images/85c8a09f-e111-4d9d-b774-208b46c8636c.webp', 'a6185c53a29639091cdaa848e5bb154ea304d7336b36ac1269045b16b60fa577'),
  ('dbdd8221-bad3-4666-8e1b-21d0cb74a882'::uuid, '/food-images/dbdd8221-bad3-4666-8e1b-21d0cb74a882.webp', '4ac6d3e124e666a7e22eec7d6c75f49a2c740cbc69bd9cbad4b5fd98e90e643a'),
  ('d5dcf5a4-937f-401c-a84d-fc320a46f2dc'::uuid, '/food-images/d5dcf5a4-937f-401c-a84d-fc320a46f2dc.webp', '3dda984a80aab28c6107abb2cb54e9db45e99a6e9a7ef450eaf1bcad0c132c42'),
  ('e885d89b-a35a-46be-b423-297166118dbb'::uuid, '/food-images/e885d89b-a35a-46be-b423-297166118dbb.webp', 'f6ef3ab3697b829cbe5fd3e46bfcd7479ed3b92c4444198eded6ac7214e33c8b'),
  ('28139900-93b1-4f63-8299-4a24e744ea75'::uuid, '/food-images/28139900-93b1-4f63-8299-4a24e744ea75.webp', '1d56f7854cb407f1649046f2f7a9015b2b6c0cbe9eddeb7ec8f1cc43b80bcc65'),
  ('3f927874-84ba-4dd9-afde-b9c7738ed30c'::uuid, '/food-images/3f927874-84ba-4dd9-afde-b9c7738ed30c.webp', '8c89eaad4c579bc1650be6704153d223286b9e8f6708a9b960b23fcfb5f4658f'),
  ('cc5287d3-07e1-4b76-ad2f-ff27ab9938f9'::uuid, '/food-images/cc5287d3-07e1-4b76-ad2f-ff27ab9938f9.webp', 'fd86b5cf0d2821347da20cce46466b28557858fac3bc5b919049ab8aceff9c8f'),
  ('54796f5a-7e5b-4984-a5d8-293f96ad83aa'::uuid, '/food-images/54796f5a-7e5b-4984-a5d8-293f96ad83aa.webp', '6d523de59bb85609c82ad2df381fe8d8787ce8d7c4cf1382aca4c85a659b01a7'),
  ('9e6ab617-87fc-413f-b024-a705df6f1d22'::uuid, '/food-images/9e6ab617-87fc-413f-b024-a705df6f1d22.webp', '569231a1187a94f35be4d15cb79b5b2492a376d8338548741fc1da872017f546'),
  ('4906cdc9-fe9a-4d81-90bc-81489e348996'::uuid, '/food-images/4906cdc9-fe9a-4d81-90bc-81489e348996.webp', 'b19882c7a844b21a3c3ffd483db9a18bc67e984d933caafd5bcca97f29f68735'),
  ('71951dfe-2848-41aa-8fac-a60f4c503dc8'::uuid, '/food-images/71951dfe-2848-41aa-8fac-a60f4c503dc8.webp', '2f24ef19359219f661fca05a7cfce9c8c10e3f709180d8c3f26af5a848685469'),
  ('88e91c28-ccfd-4f0e-82ff-a87ec3cf6d73'::uuid, '/food-images/88e91c28-ccfd-4f0e-82ff-a87ec3cf6d73.webp', '4e4612bacb7125ae958ce0074153e499b1d45802563167a42a80e5473dc22bdc'),
  ('e8b271b5-837e-4c28-8594-90ddf290e5ec'::uuid, '/food-images/e8b271b5-837e-4c28-8594-90ddf290e5ec.webp', 'a757d2425510de0f9bd20643dc34d9c23bc2ee83a760682c0cd22f5294405f31'),
  ('fdd52b27-1d99-421b-887e-0899af9d3774'::uuid, '/food-images/fdd52b27-1d99-421b-887e-0899af9d3774.webp', '45d8a2c274748a5909d24e87f1a139d44877601b5bd869c164de5382459e0912'),
  ('938a9106-7427-477a-a77e-e0e9f1611826'::uuid, '/food-images/938a9106-7427-477a-a77e-e0e9f1611826.webp', 'aa5bf22861fbcccf3e61c1d14ae001ab9c895f124c528478114161356b98d5fe'),
  ('88640363-3c8c-42a8-9789-975c32bbeacd'::uuid, '/food-images/88640363-3c8c-42a8-9789-975c32bbeacd.webp', '74e33638ec19fb2bf1a52e4cc252da15575da2eca4bc158e39ab9844ea69c8e3'),
  ('55435532-b058-4fc9-9441-501691cb02df'::uuid, '/food-images/55435532-b058-4fc9-9441-501691cb02df.webp', 'fa5a28b0aa1eae31a2f621a5a35a3e1517de4ee14633155ee9284812ea75c1da'),
  ('e7077c7c-cb66-4489-8eef-ab2331a16c93'::uuid, '/food-images/e7077c7c-cb66-4489-8eef-ab2331a16c93.webp', '3b6d454b28bad4a83c526b56e72ba1835a500c32e320e9f3d48751af5e85f6c4'),
  ('bead22e4-00ed-430a-829d-471600f2bc71'::uuid, '/food-images/bead22e4-00ed-430a-829d-471600f2bc71.webp', 'cfebd5a60d18f507ff67f4521a2d08a45ea1e0c81ee1d825ded09ec7dd9d2a4e'),
  ('3202d56c-ffe8-4286-ae33-af0220e8c7a8'::uuid, '/food-images/3202d56c-ffe8-4286-ae33-af0220e8c7a8.webp', '9ad6c9a4bdc658f1a5ad18e9907d80a54e748e3b81f37a0df5cca2cb688c6d2a'),
  ('d851ba72-4002-4d2e-a8a6-8099762cc6ca'::uuid, '/food-images/d851ba72-4002-4d2e-a8a6-8099762cc6ca.webp', 'caac1b4d3c97cdfe72b6cc3bb3b90287a568427efb6c68febb34f59953ab8b5f'),
  ('7fe5f7b2-8e49-461c-9067-563c1fba5e3f'::uuid, '/food-images/7fe5f7b2-8e49-461c-9067-563c1fba5e3f.webp', '185a7e599f75f824ee26741ab2ee784c1fb3c8dd9568834715c6b389cb152e4c'),
  ('c15f6947-f872-4ef3-889a-88ad4c6ba92e'::uuid, '/food-images/c15f6947-f872-4ef3-889a-88ad4c6ba92e.webp', '35426c6621c896904efdd07dcfd66477bc3c3dc9c3ebac676dd0a753d71ba8e2'),
  ('62581ebc-a64e-4161-a8da-b61bca5d9f59'::uuid, '/food-images/62581ebc-a64e-4161-a8da-b61bca5d9f59.webp', '1ae0f66b18e5553c3eea1a6d9de99982526af997f8aff5a8f0719c432ff67108'),
  ('35398842-78f7-4671-9078-d37ab36c3441'::uuid, '/food-images/35398842-78f7-4671-9078-d37ab36c3441.webp', 'd8ba04c88423d506bc1e2d64c9576bb6d0db7da124817ad7119891b29c065eab'),
  ('dabea064-a09c-4e26-8e81-a9eac9457607'::uuid, '/food-images/dabea064-a09c-4e26-8e81-a9eac9457607.webp', '8d8a6de57ef4563e4594a13dd8bee5ddbd13cc1c4feffd840c6c586e9467b40f'),
  ('2fe801b6-1935-4e33-b1ee-d3e1f49ab5f5'::uuid, '/food-images/2fe801b6-1935-4e33-b1ee-d3e1f49ab5f5.webp', '8c269444f91b0ba0cb35c38ce93e1b848226c8f367025b2ff6790048630b5004'),
  ('df7c9688-37a3-492e-92aa-c766293262a0'::uuid, '/food-images/df7c9688-37a3-492e-92aa-c766293262a0.webp', '3a049721cc0e716df8f023e86a37d5e3f25808458e8ee6a208a0948e64eaf837'),
  ('0326e4ff-2038-4b84-8721-d7050bc8f4a9'::uuid, '/food-images/0326e4ff-2038-4b84-8721-d7050bc8f4a9.webp', 'a133434895b8700781704a826f81cf661898893116aafce48e8a319a5dc5845a'),
  ('3172fda0-bb0b-4e8d-ac0f-d018aff6a727'::uuid, '/food-images/3172fda0-bb0b-4e8d-ac0f-d018aff6a727.webp', '70de013355a93541d29d55a17d8bc07ceeead21f419b082a8052139bfb0aed39'),
  ('28707dbc-d8ec-4fd3-8b10-c641ef1ddad5'::uuid, '/food-images/28707dbc-d8ec-4fd3-8b10-c641ef1ddad5.webp', '685613ab326c540ccb74aac410f487ee3c9944c3f2d2fe0773e174f33ba91bb4'),
  ('69bd6992-af9e-4473-b4f1-93fe5d4e88a1'::uuid, '/food-images/69bd6992-af9e-4473-b4f1-93fe5d4e88a1.webp', 'a00c7f5d058327d44924296ae27e63f95bc173d973ed196ad153ff18dcd5ecd4'),
  ('9d196ba7-af91-4dd2-a37f-483f8e042d07'::uuid, '/food-images/9d196ba7-af91-4dd2-a37f-483f8e042d07.webp', '9e634fd9ff8a9347feac7db8e09b5a485062395b7bdb8d488d28bd32e64e6c62'),
  ('7a642b78-2141-4928-a46f-311a1550ebe0'::uuid, '/food-images/7a642b78-2141-4928-a46f-311a1550ebe0.webp', '486965f909888454308ee49b0e8dd4358ae9aba0509db6c6400983cce362298d'),
  ('4bd05f00-0a39-49dc-a71c-a0580275436d'::uuid, '/food-images/4bd05f00-0a39-49dc-a71c-a0580275436d.webp', '297d5e9ba530f1c72ef4925fd0136ebe0afe2fa9991575c4e33c6619f1e46a29'),
  ('ca59c78b-615e-46c8-8e35-819a0e7480cc'::uuid, '/food-images/ca59c78b-615e-46c8-8e35-819a0e7480cc.webp', '86feca6852d290f6e76ae1bf09ab394cc9a96b92bd8ae2d29e8f7c14e1f3d962'),
  ('2db219c2-aa16-470f-b936-175a9fe449e0'::uuid, '/food-images/2db219c2-aa16-470f-b936-175a9fe449e0.webp', '989e113818485570f11a5f5dcc406fae391220154b8424ce8ff0eebaaa962ea4'),
  ('40458961-7748-4bfc-8f6c-641df9c44673'::uuid, '/food-images/40458961-7748-4bfc-8f6c-641df9c44673.webp', '6e2c2fa09b479f41de59ea60e48361556426da644af7433f03b554d99fad50b9'),
  ('0a78df04-03fb-4b00-8eb0-e00f86212a16'::uuid, '/food-images/0a78df04-03fb-4b00-8eb0-e00f86212a16.webp', 'ef82dea454f138b5c27233e16d5bf7b0e08ba9e36d35bdb72b21f3e71c2bd6b6'),
  ('a54a194a-d81b-4214-bb35-ac356bc6bb1a'::uuid, '/food-images/a54a194a-d81b-4214-bb35-ac356bc6bb1a.webp', 'ca18a5dba57cb6e6c6c74a1eed69477eea9f1e51ff1fc89d6f34d558dceba74f'),
  ('fad3e74f-f75d-4031-9a16-1b685646b3f5'::uuid, '/food-images/fad3e74f-f75d-4031-9a16-1b685646b3f5.webp', '7bf2063644e7aace1216b9bd3badb7688ff65fc488287b92ea1a7903d4d92bab'),
  ('86a18812-a15d-4b22-9c09-2c2d041a5e41'::uuid, '/food-images/86a18812-a15d-4b22-9c09-2c2d041a5e41.webp', 'b140d65640c114c6b25bb9947d0be909e3b72d2220613f631a1dcfc9b27ffad8'),
  ('345cbd8d-0778-44e8-9f5c-0a71e3c6fbd6'::uuid, '/food-images/345cbd8d-0778-44e8-9f5c-0a71e3c6fbd6.webp', 'c3771bfb6b127ea798e5f82d4c76bc7dcfb5775ce3a93a45edb8cd414c07994a'),
  ('29041199-7ab7-4133-9748-462d9e88a07d'::uuid, '/food-images/29041199-7ab7-4133-9748-462d9e88a07d.webp', '33310923c294ad58be274e39980f926d75305e6b5289f44794acefed0f685abd'),
  ('b265087d-f53d-4f2c-b303-a7485c4d047c'::uuid, '/food-images/b265087d-f53d-4f2c-b303-a7485c4d047c.webp', '87e8e70d9bd1d9ba0b594091fa6f370d535de8ee17f992af7b86247a70c38429'),
  ('df6b28ff-c283-4b81-b793-955efc387c1e'::uuid, '/food-images/df6b28ff-c283-4b81-b793-955efc387c1e.webp', 'af5deb774251d4d3e2e9f87d2386ac3cc285d2e8b07f6c910183c5385f0e0c2f'),
  ('213b489a-43a0-421d-99df-e010f065bb54'::uuid, '/food-images/213b489a-43a0-421d-99df-e010f065bb54.webp', 'a6dcc25e3a40d8e382894b858c36232e5831ba1e2413846d08db2fcffb8f71df'),
  ('d4cac174-7282-4faf-85a6-526b5d728db4'::uuid, '/food-images/d4cac174-7282-4faf-85a6-526b5d728db4.webp', 'f695abb13d6bc4c64e7912099f01838eb0499191b0f24262f4be347a82f8f238'),
  ('a21653e8-d4ac-4bc8-a7d1-ed9858c99633'::uuid, '/food-images/a21653e8-d4ac-4bc8-a7d1-ed9858c99633.webp', '0243b4e2ea13e5e456b41ea81479c805da7282bdbd2024f44459f86e1dac9b99'),
  ('f64dfc41-118b-4332-94f5-e4b1271537cc'::uuid, '/food-images/f64dfc41-118b-4332-94f5-e4b1271537cc.webp', '781a1d2bbbd8a294d5e5a76a5e54cf313eac31ae53327d8d1408ff5432859787'),
  ('49e68f88-0fd8-40bc-89b7-5d932d068f56'::uuid, '/food-images/49e68f88-0fd8-40bc-89b7-5d932d068f56.webp', 'e3c48d0fe469279e3209cfabfdef9637ca73c3465a7490944d7a6b1bbf6da209'),
  ('194c95cb-4095-459d-8661-f2d82b6080cc'::uuid, '/food-images/194c95cb-4095-459d-8661-f2d82b6080cc.webp', '372b548671c51ca1ca8bd5256a6ee95622ae0c459cfe7159390e7e326bd8fc67'),
  ('b7014056-77ff-411e-931a-b9acbd7d7c33'::uuid, '/food-images/b7014056-77ff-411e-931a-b9acbd7d7c33.webp', '226cc30f0f37c98c36e96731f26d9e2ce4b91e9b48218088107de6400681e6ec'),
  ('4cd93ae8-a072-4c58-a81f-1b437c89c85b'::uuid, '/food-images/4cd93ae8-a072-4c58-a81f-1b437c89c85b.webp', '1fce6c5bb4018f91b0847afca32db802ec6f474758fb04485e7dd0a23f550cce'),
  ('4a4db01c-a42f-406c-8e70-043076b67bdc'::uuid, '/food-images/4a4db01c-a42f-406c-8e70-043076b67bdc.webp', '659fdf13aff655a1ccb39ac7d2c2ad51037ee3928df71517f05b01e71d9f2e5c'),
  ('7dae9d70-324f-491d-bea4-191c21d676b0'::uuid, '/food-images/7dae9d70-324f-491d-bea4-191c21d676b0.webp', '23c61e794c400357d8b3c6d46554852417f48f24e5b6377424a5f40acbe3eff0'),
  ('8bbb7454-1718-4090-93d8-dcb37cc8e485'::uuid, '/food-images/8bbb7454-1718-4090-93d8-dcb37cc8e485.webp', '566dc2d7b55f7bad024037b1d83a02a29e1eb13823c9c2fd7c0a7b4dfe28d349'),
  ('41075653-64ac-4529-9292-8858668024e4'::uuid, '/food-images/41075653-64ac-4529-9292-8858668024e4.webp', 'd770db8be1b5acd1f2c7472b38db57a3077d7d005be5376f78121602260e13dc'),
  ('0c739dfd-7e85-466f-8648-c703eaed9ba2'::uuid, '/food-images/0c739dfd-7e85-466f-8648-c703eaed9ba2.webp', 'bd4923bc42e656c2dc876d6969ca8ad21cf25edeb0da0be59be2c7e4eb6223f9'),
  ('6efc9824-7605-43cb-b816-e4479ea5b605'::uuid, '/food-images/6efc9824-7605-43cb-b816-e4479ea5b605.webp', '85867820c5eff9e808b9a7f6527b1bfbe65f9000c79c840e839a6dc162eebb12'),
  ('9c0e64db-a6e8-4d32-abb2-fad44bb4f5d4'::uuid, '/food-images/9c0e64db-a6e8-4d32-abb2-fad44bb4f5d4.webp', 'f3123aa1c0749f4efb1e8328b43605c9228d9e8eff3f7bfd360e5083f805935a'),
  ('39254808-c4bc-4649-84d6-ee4289fe43a8'::uuid, '/food-images/39254808-c4bc-4649-84d6-ee4289fe43a8.webp', '5e557d33ae44a6ffdd080eab8980cea84cc846b4ac72f2c87ce30ec4c03a10e8'),
  ('0d8fae7d-951a-44f6-a7ec-42698ad74cb6'::uuid, '/food-images/0d8fae7d-951a-44f6-a7ec-42698ad74cb6.webp', 'e32c597885945f82460ab6373d95fbd341d27b2d1ca6b9d196786562429ac33f'),
  ('1a6794b5-6efa-4a0a-a1c2-34a7a6dbb1fc'::uuid, '/food-images/1a6794b5-6efa-4a0a-a1c2-34a7a6dbb1fc.webp', '6b26ebd54f68befc3e3c0ba1a924a7ab65a10bbd89a96400954d55097e512c2e'),
  ('bc57c2fc-6dc1-4003-bfb5-fcaf86c30f25'::uuid, '/food-images/bc57c2fc-6dc1-4003-bfb5-fcaf86c30f25.webp', 'c4e5c99e0672cc52fe5770a25eaee8cdb5a268531618527ab158080f28fe8025');

do $$
declare
  expected_count integer := 139;
  active_count integer;
begin
  select count(*) into active_count
  from public.food_items as food
  join wolf_kaafe_photo_assignments as photo on photo.id = food.id
  where food.is_active is true;

  if active_count <> expected_count then
    raise exception 'Expected all 139 photo target items to remain active; found %', active_count;
  end if;
end $$;

update public.food_items as food
set image_url = photo.image_url,
    image_sha256 = photo.image_sha256,
    updated_at = now()
from wolf_kaafe_photo_assignments as photo
where food.id = photo.id
  and food.is_active is true;

do $$
declare
  expected_count integer := 139;
  applied_count integer;
begin
  select count(*) into applied_count
  from public.food_items as food
  join wolf_kaafe_photo_assignments as photo on photo.id = food.id
  where food.is_active is true
    and food.image_url = photo.image_url
    and food.image_sha256 = photo.image_sha256;

  if applied_count <> expected_count then
    raise exception 'Photo update incomplete: expected %, found %', expected_count, applied_count;
  end if;
end $$;

commit;


-- ============================================================================
-- Migration: 202610050001_customer_default_delivery_address.sql
-- ============================================================================

begin;

-- Keep exactly one saved default address for each customer. Previous checkout
-- versions inserted an address for every order without marking it as default;
-- preserve the customer's most recent address as the initial default.
with ranked_addresses as (
  select id,
         row_number() over (partition by user_id order by created_at desc, id desc) as position
  from public.addresses
)
update public.addresses as address
set is_default = (ranked_addresses.position = 1)
from ranked_addresses
where address.id = ranked_addresses.id;

create unique index if not exists addresses_one_default_per_user
  on public.addresses (user_id)
  where is_default = true;

-- Checkout updates the customer's saved default address and links the order to
-- that same row. Historical order address_snapshot values remain unchanged.
create or replace function public.place_cod_order(p_address jsonb, p_items jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_address_id uuid;
  v_address jsonb;
  v_order_id uuid;
  v_subtotal numeric(10,2) := 0;
  v_delivery_fee numeric(10,2) := 39;
  v_free_threshold numeric(10,2) := 499;
  v_minimum numeric(10,2) := 0;
  v_item jsonb;
  v_food public.food_items%rowtype;
  v_qty integer;
  v_size text;
  v_extras jsonb;
  v_variant_price numeric(10,2);
  v_unit numeric(10,2);
  v_order_item_id uuid;
begin
  if v_user_id is null then raise exception 'Sign in before placing your order.'; end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then raise exception 'Your cart is empty.'; end if;
  if coalesce(p_address->>'full_name','') = '' or coalesce(p_address->>'phone','') = '' or coalesce(p_address->>'house','') = '' or coalesce(p_address->>'street','') = '' or coalesce(p_address->>'area','') = '' or coalesce(p_address->>'city','') = '' or coalesce(p_address->>'pincode','') = '' then raise exception 'Complete all required delivery address fields.'; end if;

  select id into v_address_id
  from public.addresses
  where user_id = v_user_id and is_default = true
  order by created_at desc, id desc
  limit 1
  for update;

  if v_address_id is null then
    insert into public.addresses(user_id, full_name, phone, house, street, area, city, pincode, landmark, is_default)
    values(v_user_id, p_address->>'full_name', p_address->>'phone', p_address->>'house', p_address->>'street', p_address->>'area', p_address->>'city', p_address->>'pincode', nullif(p_address->>'landmark',''), true)
    returning id into v_address_id;
  else
    update public.addresses
    set full_name = p_address->>'full_name',
        phone = p_address->>'phone',
        house = p_address->>'house',
        street = p_address->>'street',
        area = p_address->>'area',
        city = p_address->>'city',
        pincode = p_address->>'pincode',
        landmark = nullif(p_address->>'landmark',''),
        is_default = true
    where id = v_address_id and user_id = v_user_id;
  end if;

  v_address := jsonb_build_object('full_name',p_address->>'full_name','phone',p_address->>'phone','house',p_address->>'house','street',p_address->>'street','area',p_address->>'area','city',p_address->>'city','pincode',p_address->>'pincode','landmark',p_address->>'landmark');

  select coalesce(delivery_fee,39), coalesce(free_delivery_threshold,499), coalesce(minimum_order,0)
  into v_delivery_fee, v_free_threshold, v_minimum from public.restaurant_settings where id=1;

  -- Validate and lock food rows before inserting the order or its line items.
  for v_item in select value from jsonb_array_elements(p_items) loop
    select * into v_food from public.food_items
    where id=(v_item->>'food_item_id')::uuid and is_active=true and is_available=true
    for update;
    if not found then raise exception 'One of the selected dishes is unavailable.'; end if;
    if not (v_item ? 'client_price') then raise exception 'Refresh your cart and review current food prices before ordering.'; end if;
    v_size := coalesce(v_item->>'size','Regular');
    if v_food.regular_price is not null or v_food.large_price is not null then
      if v_size = 'Regular' and v_food.regular_price is not null then
        v_variant_price := v_food.regular_price;
      elsif v_size = 'Large' and v_food.large_price is not null then
        v_variant_price := v_food.large_price;
      else
        raise exception 'The selected size is unavailable for %.', v_food.name;
      end if;
    else
      if v_size not in ('Regular','Large') then raise exception 'Invalid size.'; end if;
      v_variant_price := v_food.price;
    end if;
    if (v_item->>'client_price')::numeric <> v_variant_price then
      raise exception 'The price for % changed. Review the updated cart and place your order again.', v_food.name;
    end if;

    v_qty := (v_item->>'quantity')::integer;
    if v_qty < 1 or v_qty > 50 then raise exception 'Invalid item quantity.'; end if;
    v_extras := coalesce(v_item->'extras','[]'::jsonb);
    if jsonb_typeof(v_extras) <> 'array' or jsonb_array_length(v_extras) > 10 then raise exception 'Invalid customizations.'; end if;
    v_unit := v_variant_price + (jsonb_array_length(v_extras) * 30);
    v_subtotal := v_subtotal + (v_unit * v_qty);
  end loop;

  if v_subtotal < v_minimum then raise exception 'Order does not meet the minimum order value.'; end if;
  if v_subtotal >= v_free_threshold then v_delivery_fee := 0; end if;

  insert into public.orders(user_id,address_id,status,payment_method,payment_status,subtotal,delivery_fee,discount,total,address_snapshot)
  values(v_user_id,v_address_id,'pending','cod','pending',v_subtotal,v_delivery_fee,0,v_subtotal+v_delivery_fee,v_address)
  returning id into v_order_id;

  for v_item in select value from jsonb_array_elements(p_items) loop
    select * into v_food from public.food_items where id=(v_item->>'food_item_id')::uuid;
    v_qty := (v_item->>'quantity')::integer;
    v_size := coalesce(v_item->>'size','Regular');
    v_extras := coalesce(v_item->'extras','[]'::jsonb);
    if v_food.regular_price is not null or v_food.large_price is not null then
      v_variant_price := case when v_size = 'Large' then v_food.large_price else v_food.regular_price end;
    else
      v_variant_price := v_food.price;
    end if;
    v_unit := v_variant_price + (jsonb_array_length(v_extras) * 30);
    insert into public.order_items(order_id,food_item_id,name_snapshot,unit_price,quantity,size,special_instructions)
    values(v_order_id,v_food.id,v_food.name,v_unit,v_qty,v_size,nullif(v_item->>'note','')) returning id into v_order_item_id;
    insert into public.order_item_customizations(order_item_id,option_name_snapshot,additional_price)
    select v_order_item_id, value #>> '{}', 30 from jsonb_array_elements(v_extras);
  end loop;

  return jsonb_build_object('id',v_order_id,'total',v_subtotal+v_delivery_fee,'subtotal',v_subtotal,'delivery_fee',v_delivery_fee,'address',v_address);
end;
$$;

revoke all on function public.place_cod_order(jsonb,jsonb) from public, anon;
grant execute on function public.place_cod_order(jsonb,jsonb) to authenticated;

commit;


-- ============================================================================
-- Migration: 202610050002_admin_customer_realtime.sql
-- ============================================================================

-- Stream customer profile changes so the admin customer analysis stays current.
-- Existing profile RLS policies continue to control which users can read events.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'profiles'
  ) then
    alter publication supabase_realtime add table public.profiles;
  end if;
end;
$$;


-- ============================================================================
-- Migration: 202610050003_today_special_menu.sql
-- ============================================================================

begin;

alter table public.food_items
  add column if not exists is_today_special boolean not null default false,
  add column if not exists special_price numeric(10,2),
  add column if not exists special_discount_percent numeric(5,2) not null default 0,
  add column if not exists special_starts_at timestamptz,
  add column if not exists special_ends_at timestamptz;

do $$
begin
  if not exists (select 1 from pg_constraint where conrelid = 'public.food_items'::regclass and conname = 'food_items_special_price_valid') then
    alter table public.food_items add constraint food_items_special_price_valid
      check (special_price is null or (special_price > 0 and special_price < coalesce(regular_price, price)));
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.food_items'::regclass and conname = 'food_items_special_discount_valid') then
    alter table public.food_items add constraint food_items_special_discount_valid
      check (special_discount_percent >= 0 and special_discount_percent < 100);
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.food_items'::regclass and conname = 'food_items_special_pricing_exclusive') then
    alter table public.food_items add constraint food_items_special_pricing_exclusive
      check (special_price is null or special_discount_percent = 0);
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.food_items'::regclass and conname = 'food_items_special_dates_valid') then
    alter table public.food_items add constraint food_items_special_dates_valid
      check (special_starts_at is null or special_ends_at is null or special_starts_at < special_ends_at);
  end if;
end;
$$;

-- Home and Today’s Special use the existing food_items Postgres Changes feed.
do $$
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'food_items'
  ) then
    alter publication supabase_realtime add table public.food_items;
  end if;
end;
$$;

-- Validate the special price inside the existing order transaction so the
-- price displayed to customers is also the price saved to the order.
create or replace function public.place_cod_order(p_address jsonb, p_items jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_address_id uuid;
  v_address jsonb;
  v_order_id uuid;
  v_subtotal numeric(10,2) := 0;
  v_delivery_fee numeric(10,2) := 39;
  v_free_threshold numeric(10,2) := 499;
  v_minimum numeric(10,2) := 0;
  v_item jsonb;
  v_food public.food_items%rowtype;
  v_qty integer;
  v_size text;
  v_extras jsonb;
  v_original_price numeric(10,2);
  v_regular_price numeric(10,2);
  v_variant_price numeric(10,2);
  v_unit numeric(10,2);
  v_now timestamptz := now();
  v_order_item_id uuid;
begin
  if v_user_id is null then raise exception 'Sign in before placing your order.'; end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then raise exception 'Your cart is empty.'; end if;
  if coalesce(p_address->>'full_name','') = '' or coalesce(p_address->>'phone','') = '' or coalesce(p_address->>'house','') = '' or coalesce(p_address->>'street','') = '' or coalesce(p_address->>'area','') = '' or coalesce(p_address->>'city','') = '' or coalesce(p_address->>'pincode','') = '' then raise exception 'Complete all required delivery address fields.'; end if;

  select id into v_address_id
  from public.addresses
  where user_id = v_user_id and is_default = true
  order by created_at desc, id desc
  limit 1
  for update;

  if v_address_id is null then
    insert into public.addresses(user_id, full_name, phone, house, street, area, city, pincode, landmark, is_default)
    values(v_user_id, p_address->>'full_name', p_address->>'phone', p_address->>'house', p_address->>'street', p_address->>'area', p_address->>'city', p_address->>'pincode', nullif(p_address->>'landmark',''), true)
    returning id into v_address_id;
  else
    update public.addresses
    set full_name = p_address->>'full_name',
        phone = p_address->>'phone',
        house = p_address->>'house',
        street = p_address->>'street',
        area = p_address->>'area',
        city = p_address->>'city',
        pincode = p_address->>'pincode',
        landmark = nullif(p_address->>'landmark',''),
        is_default = true
    where id = v_address_id and user_id = v_user_id;
  end if;

  v_address := jsonb_build_object('full_name',p_address->>'full_name','phone',p_address->>'phone','house',p_address->>'house','street',p_address->>'street','area',p_address->>'area','city',p_address->>'city','pincode',p_address->>'pincode','landmark',p_address->>'landmark');

  select coalesce(delivery_fee,39), coalesce(free_delivery_threshold,499), coalesce(minimum_order,0)
  into v_delivery_fee, v_free_threshold, v_minimum
  from public.restaurant_settings where id = 1;
  if not found then
    v_delivery_fee := 39;
    v_free_threshold := 499;
    v_minimum := 0;
  end if;

  -- Validate and lock food rows before inserting the order or its line items.
  for v_item in select value from jsonb_array_elements(p_items) loop
    select * into v_food from public.food_items
    where id = (v_item->>'food_item_id')::uuid and is_active = true and is_available = true
    for update;
    if not found then raise exception 'One of the selected dishes is unavailable.'; end if;
    if not (v_item ? 'client_price') then raise exception 'Refresh your cart and review current food prices before ordering.'; end if;
    v_size := coalesce(v_item->>'size','Regular');

    if v_food.regular_price is not null or v_food.large_price is not null then
      if v_size = 'Regular' then
        v_original_price := coalesce(v_food.regular_price, v_food.price);
      elsif v_size = 'Large' and v_food.large_price is not null then
        v_original_price := v_food.large_price;
      else
        raise exception 'The selected size is unavailable for %.', v_food.name;
      end if;
    else
      if v_size not in ('Regular','Large') then raise exception 'Invalid size.'; end if;
      v_original_price := v_food.price;
    end if;

    v_variant_price := v_original_price;
    if v_food.is_today_special
      and (v_food.special_starts_at is null or v_food.special_starts_at <= v_now)
      and (v_food.special_ends_at is null or v_food.special_ends_at > v_now) then
      v_regular_price := coalesce(v_food.regular_price, v_food.price);
      if v_food.special_price is not null and v_regular_price > 0 then
        v_variant_price := round(v_original_price * v_food.special_price / v_regular_price, 2);
      elsif v_food.special_discount_percent > 0 then
        v_variant_price := round(v_original_price * (1 - v_food.special_discount_percent / 100), 2);
      end if;
    end if;

    if (v_item->>'client_price')::numeric <> v_variant_price then
      raise exception 'The price for % changed. Review the updated cart and place your order again.', v_food.name;
    end if;

    v_qty := (v_item->>'quantity')::integer;
    if v_qty < 1 or v_qty > 50 then raise exception 'Invalid item quantity.'; end if;
    v_extras := coalesce(v_item->'extras','[]'::jsonb);
    if jsonb_typeof(v_extras) <> 'array' or jsonb_array_length(v_extras) > 10 then raise exception 'Invalid customizations.'; end if;
    v_unit := v_variant_price + (jsonb_array_length(v_extras) * 30);
    v_subtotal := v_subtotal + (v_unit * v_qty);
  end loop;

  if v_subtotal < v_minimum then raise exception 'Order does not meet the minimum order value.'; end if;
  if v_subtotal >= v_free_threshold then v_delivery_fee := 0; end if;

  insert into public.orders(user_id,address_id,status,payment_method,payment_status,subtotal,delivery_fee,discount,total,address_snapshot)
  values(v_user_id,v_address_id,'pending','cod','pending',v_subtotal,v_delivery_fee,0,v_subtotal+v_delivery_fee,v_address)
  returning id into v_order_id;

  for v_item in select value from jsonb_array_elements(p_items) loop
    select * into v_food from public.food_items where id = (v_item->>'food_item_id')::uuid;
    v_qty := (v_item->>'quantity')::integer;
    v_size := coalesce(v_item->>'size','Regular');
    v_extras := coalesce(v_item->'extras','[]'::jsonb);

    if v_food.regular_price is not null or v_food.large_price is not null then
      if v_size = 'Large' then v_original_price := v_food.large_price;
      else v_original_price := coalesce(v_food.regular_price, v_food.price); end if;
    else
      v_original_price := v_food.price;
    end if;
    v_variant_price := v_original_price;
    if v_food.is_today_special
      and (v_food.special_starts_at is null or v_food.special_starts_at <= v_now)
      and (v_food.special_ends_at is null or v_food.special_ends_at > v_now) then
      v_regular_price := coalesce(v_food.regular_price, v_food.price);
      if v_food.special_price is not null and v_regular_price > 0 then
        v_variant_price := round(v_original_price * v_food.special_price / v_regular_price, 2);
      elsif v_food.special_discount_percent > 0 then
        v_variant_price := round(v_original_price * (1 - v_food.special_discount_percent / 100), 2);
      end if;
    end if;

    v_unit := v_variant_price + (jsonb_array_length(v_extras) * 30);
    insert into public.order_items(order_id,food_item_id,name_snapshot,unit_price,quantity,size,special_instructions)
    values(v_order_id,v_food.id,v_food.name,v_unit,v_qty,v_size,nullif(v_item->>'note','')) returning id into v_order_item_id;
    insert into public.order_item_customizations(order_item_id,option_name_snapshot,additional_price)
    select v_order_item_id, value #>> '{}', 30 from jsonb_array_elements(v_extras);
  end loop;

  return jsonb_build_object('id',v_order_id,'total',v_subtotal+v_delivery_fee,'subtotal',v_subtotal,'delivery_fee',v_delivery_fee,'address',v_address);
end;
$$;

revoke all on function public.place_cod_order(jsonb,jsonb) from public, anon;
grant execute on function public.place_cod_order(jsonb,jsonb) to authenticated;

commit;


-- ============================================================================
-- Migration: 202610050004_remove_food_subcategory.sql
-- ============================================================================

begin;

-- The menu now uses its primary category only. Remove the old catalog identity
-- index before dropping the column it depends on, then keep a lookup index
-- that supports category/name queries without making menu rows unique.
drop index if exists public.food_items_catalog_identity_unique;

alter table public.food_items
  drop column if exists subcategory;

create index if not exists food_items_catalog_identity_idx
  on public.food_items (category_id, lower(name), coalesce(food_type, ''))
  where is_active = true;

commit;


-- ============================================================================
-- Migration: 202610070001_food_review_rating_system.sql
-- ============================================================================

-- Extend the existing per-order, per-food reviews table for customer food reviews.
alter table public.reviews
  alter column delivery_rating drop not null,
  add column if not exists updated_at timestamptz not null default now();

create unique index if not exists reviews_order_food_unique_idx
  on public.reviews(order_id, food_item_id)
  where food_item_id is not null;

create index if not exists reviews_food_created_at_idx
  on public.reviews(food_item_id, created_at desc)
  where food_item_id is not null;

create or replace function public.set_review_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists reviews_set_updated_at on public.reviews;
create trigger reviews_set_updated_at
before update on public.reviews
for each row execute function public.set_review_updated_at();

-- Customers can see only their own review text. Public cards use the aggregate RPC below.
drop policy if exists "reviews public read" on public.reviews;
drop policy if exists "reviews own insert completed" on public.reviews;
drop policy if exists "reviews admin manage" on public.reviews;
drop policy if exists "reviews owner or admin read" on public.reviews;
create policy "reviews owner or admin read" on public.reviews
  for select using (user_id = auth.uid() or public.is_admin());

revoke insert, update, delete on public.reviews from anon, authenticated;
grant select on public.reviews to anon, authenticated;

create or replace function public.submit_order_food_reviews(
  p_order_id uuid,
  p_reviews jsonb
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_order_status public.order_status;
  v_review jsonb;
  v_food_id uuid;
  v_rating integer;
  v_review_text text;
  v_saved_count integer := 0;
begin
  if v_user_id is null then
    raise exception 'Sign in to submit a food review.';
  end if;
  if p_reviews is null or jsonb_typeof(p_reviews) <> 'array'
    or jsonb_array_length(p_reviews) < 1 or jsonb_array_length(p_reviews) > 50 then
    raise exception 'Submit between 1 and 50 food reviews.';
  end if;
  if exists (
    select 1 from jsonb_array_elements(p_reviews) as review_item(value)
    where nullif(review_item.value->>'food_item_id', '') is null
  ) then
    raise exception 'A food item is required for every review.';
  end if;
  if (select count(distinct (review_item.value->>'food_item_id')::uuid) from jsonb_array_elements(p_reviews) as review_item(value))
    <> jsonb_array_length(p_reviews) then
    raise exception 'Each food item can appear only once in an order review.';
  end if;

  select o.status into v_order_status
  from public.orders o
  where o.id = p_order_id and o.user_id = v_user_id
  for update;
  if not found then
    raise exception 'This order does not belong to your account.';
  end if;
  if v_order_status <> 'delivered' then
    raise exception 'You can review food after the order is delivered.';
  end if;

  for v_review in select review_item.value from jsonb_array_elements(p_reviews) as review_item(value) loop
    v_food_id := nullif(v_review->>'food_item_id', '')::uuid;
    v_rating := nullif(v_review->>'rating', '')::integer;
    v_review_text := trim(coalesce(v_review->>'review_text', ''));

    if v_food_id is null then
      raise exception 'A food item is required for every review.';
    end if;
    if v_rating is null or v_rating not between 1 and 5 then
      raise exception 'Food ratings must be between 1 and 5 stars.';
    end if;
    if char_length(v_review_text) > 1000 then
      raise exception 'Review text must be 1000 characters or fewer.';
    end if;
    if not exists (
      select 1 from public.order_items oi
      where oi.order_id = p_order_id and oi.food_item_id = v_food_id
    ) then
      raise exception 'You can review only food items included in this order.';
    end if;

    insert into public.reviews(user_id, order_id, food_item_id, food_rating, comment, updated_at)
    values (v_user_id, p_order_id, v_food_id, v_rating, v_review_text, now())
    on conflict (order_id, food_item_id) where food_item_id is not null
    do update set
      food_rating = excluded.food_rating,
      comment = excluded.comment,
      updated_at = now()
    where public.reviews.user_id = v_user_id;

    if not found then
      raise exception 'Could not update the review for this order.';
    end if;
    v_saved_count := v_saved_count + 1;
  end loop;

  return v_saved_count;
end;
$$;

revoke all on function public.submit_order_food_reviews(uuid, jsonb) from public, anon;
grant execute on function public.submit_order_food_reviews(uuid, jsonb) to authenticated;

-- Expose anonymous rating aggregates without exposing review text, customer IDs, or orders.
create table if not exists public.food_review_rating_summaries (
  food_item_id uuid primary key references public.food_items(id) on delete cascade,
  rating_total bigint not null default 0,
  review_count bigint not null default 0,
  five_star_count bigint not null default 0,
  four_star_count bigint not null default 0,
  three_star_count bigint not null default 0,
  two_star_count bigint not null default 0,
  one_star_count bigint not null default 0,
  updated_at timestamptz not null default now()
);

alter table public.food_review_rating_summaries enable row level security;
drop policy if exists "food rating summaries public read" on public.food_review_rating_summaries;
create policy "food rating summaries public read" on public.food_review_rating_summaries
  for select using (true);
revoke all on public.food_review_rating_summaries from public, anon, authenticated;
grant select on public.food_review_rating_summaries to anon, authenticated;

drop trigger if exists reviews_maintain_food_rating_summary on public.reviews;

insert into public.food_review_rating_summaries(
  food_item_id, rating_total, review_count, five_star_count, four_star_count,
  three_star_count, two_star_count, one_star_count
)
select r.food_item_id, sum(r.food_rating)::bigint, count(*)::bigint,
  count(*) filter (where r.food_rating = 5)::bigint,
  count(*) filter (where r.food_rating = 4)::bigint,
  count(*) filter (where r.food_rating = 3)::bigint,
  count(*) filter (where r.food_rating = 2)::bigint,
  count(*) filter (where r.food_rating = 1)::bigint
from public.reviews r
where r.food_item_id is not null
group by r.food_item_id
on conflict (food_item_id) do update set
  rating_total = excluded.rating_total,
  review_count = excluded.review_count,
  five_star_count = excluded.five_star_count,
  four_star_count = excluded.four_star_count,
  three_star_count = excluded.three_star_count,
  two_star_count = excluded.two_star_count,
  one_star_count = excluded.one_star_count,
  updated_at = now();

create or replace function public.maintain_food_review_rating_summary()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op in ('UPDATE', 'DELETE') and old.food_item_id is not null then
    update public.food_review_rating_summaries
    set rating_total = rating_total - old.food_rating,
      review_count = review_count - 1,
      five_star_count = five_star_count - (case when old.food_rating = 5 then 1 else 0 end),
      four_star_count = four_star_count - (case when old.food_rating = 4 then 1 else 0 end),
      three_star_count = three_star_count - (case when old.food_rating = 3 then 1 else 0 end),
      two_star_count = two_star_count - (case when old.food_rating = 2 then 1 else 0 end),
      one_star_count = one_star_count - (case when old.food_rating = 1 then 1 else 0 end),
      updated_at = now()
    where food_item_id = old.food_item_id;
    delete from public.food_review_rating_summaries where food_item_id = old.food_item_id and review_count <= 0;
  end if;

  if tg_op in ('INSERT', 'UPDATE') and new.food_item_id is not null then
    insert into public.food_review_rating_summaries as current_summary(
      food_item_id, rating_total, review_count, five_star_count, four_star_count,
      three_star_count, two_star_count, one_star_count, updated_at
    ) values (
      new.food_item_id, new.food_rating, 1,
      case when new.food_rating = 5 then 1 else 0 end,
      case when new.food_rating = 4 then 1 else 0 end,
      case when new.food_rating = 3 then 1 else 0 end,
      case when new.food_rating = 2 then 1 else 0 end,
      case when new.food_rating = 1 then 1 else 0 end,
      now()
    ) on conflict (food_item_id) do update set
      rating_total = current_summary.rating_total + excluded.rating_total,
      review_count = current_summary.review_count + excluded.review_count,
      five_star_count = current_summary.five_star_count + excluded.five_star_count,
      four_star_count = current_summary.four_star_count + excluded.four_star_count,
      three_star_count = current_summary.three_star_count + excluded.three_star_count,
      two_star_count = current_summary.two_star_count + excluded.two_star_count,
      one_star_count = current_summary.one_star_count + excluded.one_star_count,
      updated_at = now();
  end if;

  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

revoke all on function public.maintain_food_review_rating_summary() from public, anon, authenticated;
drop trigger if exists reviews_maintain_food_rating_summary on public.reviews;
create trigger reviews_maintain_food_rating_summary
after insert or update or delete on public.reviews
for each row execute function public.maintain_food_review_rating_summary();

create or replace function public.get_food_rating_summaries(p_food_ids uuid[])
returns table(food_item_id uuid, average_rating numeric, review_count bigint)
language sql
stable
security definer
set search_path = public
as $$
  select s.food_item_id,
    round(s.rating_total::numeric / nullif(s.review_count, 0), 1) as average_rating,
    s.review_count
  from public.food_review_rating_summaries s
  where s.food_item_id = any(coalesce(p_food_ids, array[]::uuid[]));
$$;

revoke all on function public.get_food_rating_summaries(uuid[]) from public;
grant execute on function public.get_food_rating_summaries(uuid[]) to anon, authenticated;

create or replace function public.get_admin_food_review_summaries()
returns table(
  food_item_id uuid,
  average_rating numeric,
  review_count bigint,
  five_star_count bigint,
  four_star_count bigint,
  three_star_count bigint,
  two_star_count bigint,
  one_star_count bigint
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Owner/Admin access is required to view review details.';
  end if;

  return query
  select f.id,
    coalesce(round(s.rating_total::numeric / nullif(s.review_count, 0), 1), 0::numeric),
    coalesce(s.review_count, 0)::bigint,
    coalesce(s.five_star_count, 0)::bigint,
    coalesce(s.four_star_count, 0)::bigint,
    coalesce(s.three_star_count, 0)::bigint,
    coalesce(s.two_star_count, 0)::bigint,
    coalesce(s.one_star_count, 0)::bigint
  from public.food_items f
  left join public.food_review_rating_summaries s on s.food_item_id = f.id
  order by f.name;
end;
$$;

revoke all on function public.get_admin_food_review_summaries() from public, anon;
grant execute on function public.get_admin_food_review_summaries() to authenticated;

-- Realtime publishes only non-identifying rating aggregates to customer clients.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
    and not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'food_review_rating_summaries'
    ) then
    execute 'alter publication supabase_realtime add table public.food_review_rating_summaries';
  end if;
end;
$$;


-- ============================================================================
-- Migration: 202610070002_public_food_reviews.sql
-- ============================================================================

-- Make only the customer-facing parts of reviews public.
-- Row visibility is public, while column grants keep user IDs, order IDs and review IDs private.
drop policy if exists "reviews owner or admin read" on public.reviews;
drop policy if exists "reviews public food detail read" on public.reviews;
create policy "reviews public food detail read" on public.reviews
  for select using (true);

revoke select on public.reviews from public, anon, authenticated;
grant select (food_item_id, food_rating, comment, created_at)
  on public.reviews to anon, authenticated;

create or replace function public.get_admin_food_reviews(p_food_id uuid)
returns table(
  id uuid,
  order_id uuid,
  food_rating integer,
  comment text,
  created_at timestamptz,
  customer_name text
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Owner/Admin access is required to view customer reviews.';
  end if;

  return query
  select r.id, r.order_id, r.food_rating, r.comment, r.created_at,
    case
      when nullif(trim(p.full_name), '') is null then 'Customer'
      else left(trim(p.full_name), 1) || repeat('*', greatest(char_length(trim(p.full_name)) - 1, 1))
    end
  from public.reviews r
  left join public.profiles p on p.id = r.user_id
  where r.food_item_id = p_food_id
  order by r.created_at desc
  limit 500;
end;
$$;

revoke all on function public.get_admin_food_reviews(uuid) from public, anon;
grant execute on function public.get_admin_food_reviews(uuid) to authenticated;

create or replace function public.delete_admin_food_review(p_review_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Owner/Admin access is required to delete a customer review.';
  end if;

  delete from public.reviews where id = p_review_id;
  return found;
end;
$$;

revoke all on function public.delete_admin_food_review(uuid) from public, anon;
grant execute on function public.delete_admin_food_review(uuid) to authenticated;


-- ============================================================================
-- Migration: 202610070003_verified_review_badge.sql
-- ============================================================================

alter table public.reviews
  add column if not exists is_verified_purchase boolean not null default false;

create or replace function public.set_verified_review_purchase()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.is_verified_purchase := exists (
    select 1
    from public.orders o
    join public.order_items oi on oi.order_id = o.id
    where o.id = new.order_id
      and o.user_id = new.user_id
      and o.status = 'delivered'
      and oi.food_item_id = new.food_item_id
  );
  return new;
end;
$$;

revoke all on function public.set_verified_review_purchase() from public, anon, authenticated;
drop trigger if exists reviews_set_verified_purchase on public.reviews;
create trigger reviews_set_verified_purchase
before insert or update on public.reviews
for each row execute function public.set_verified_review_purchase();

grant select (is_verified_purchase) on public.reviews to anon, authenticated;


-- ============================================================================
-- Migration: 202610070004_review_helpful_votes.sql
-- ============================================================================

create table if not exists public.review_helpful_votes (
  review_id uuid not null references public.reviews(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (review_id, user_id)
);

alter table public.review_helpful_votes enable row level security;
revoke all on public.review_helpful_votes from public, anon, authenticated;

create or replace function public.get_public_food_reviews(p_food_id uuid)
returns table(
  id uuid,
  food_item_id uuid,
  food_rating integer,
  comment text,
  created_at timestamptz,
  is_verified_purchase boolean,
  helpful_count bigint,
  viewer_marked_helpful boolean
)
language sql
stable
security definer
set search_path = public
as $$
  select r.id, r.food_item_id, r.food_rating, r.comment, r.created_at,
    r.is_verified_purchase,
    coalesce(v.helpful_count, 0)::bigint,
    coalesce(v.viewer_marked_helpful, false)
  from public.reviews r
  left join lateral (
    select count(*)::bigint as helpful_count,
      coalesce(bool_or(vote.user_id = auth.uid()), false) as viewer_marked_helpful
    from public.review_helpful_votes vote
    where vote.review_id = r.id
  ) v on true
  where r.food_item_id = p_food_id
  order by r.created_at desc
  limit 50;
$$;

revoke all on function public.get_public_food_reviews(uuid) from public;
grant execute on function public.get_public_food_reviews(uuid) to anon, authenticated;

create or replace function public.toggle_food_review_helpful(p_review_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception 'Sign in to mark a review helpful.';
  end if;
  if not exists (select 1 from public.reviews where id = p_review_id) then
    raise exception 'This review is no longer available.';
  end if;

  delete from public.review_helpful_votes
  where review_id = p_review_id and user_id = v_user_id;
  if found then return false; end if;

  insert into public.review_helpful_votes(review_id, user_id)
  values (p_review_id, v_user_id)
  on conflict (review_id, user_id) do nothing;
  return true;
end;
$$;

revoke all on function public.toggle_food_review_helpful(uuid) from public, anon;
grant execute on function public.toggle_food_review_helpful(uuid) to authenticated;


-- ============================================================================
-- Migration: 202610070005_home_special_offers.sql
-- ============================================================================

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


-- ============================================================================
-- Migration: 202610080001_offer_discount_pricing.sql
-- ============================================================================

alter table public.home_special_offers
  add column if not exists discount_percentage numeric(5,2) not null default 0
  check (discount_percentage between 0 and 100);

-- Preserve existing percentage-only offer setup when upgrading from the text badge field.
update public.home_special_offers
set discount_percentage = substring(discount_text from '([0-9]+(\.[0-9]+)?)')::numeric
where discount_percentage = 0
  and discount_text ~ '[0-9]'
  and substring(discount_text from '([0-9]+(\.[0-9]+)?)')::numeric between 0 and 100;

alter table public.order_items
  add column if not exists offer_id uuid references public.home_special_offers(id) on delete set null,
  add column if not exists original_unit_price numeric(10,2),
  add column if not exists discount_percentage numeric(5,2) not null default 0;

create or replace function public.place_cod_order(p_address jsonb, p_items jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_user_id uuid := auth.uid();
  v_address_id uuid;
  v_address jsonb;
  v_order_id uuid;
  v_subtotal numeric(10,2) := 0;
  v_delivery_fee numeric(10,2) := 39;
  v_free_threshold numeric(10,2) := 499;
  v_minimum numeric(10,2) := 0;
  v_item jsonb;
  v_food public.food_items%rowtype;
  v_qty integer;
  v_size text;
  v_extras jsonb;
  v_original_price numeric(10,2);
  v_regular_price numeric(10,2);
  v_variant_price numeric(10,2);
  v_unit numeric(10,2);
  v_offer_id uuid;
  v_offer_percent numeric(5,2);
  v_now timestamptz := now();
  v_order_item_id uuid;
begin
  if v_user_id is null then raise exception 'Sign in before placing your order.'; end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then raise exception 'Your cart is empty.'; end if;
  if coalesce(p_address->>'full_name','') = '' or coalesce(p_address->>'phone','') = '' or coalesce(p_address->>'house','') = '' or coalesce(p_address->>'street','') = '' or coalesce(p_address->>'area','') = '' or coalesce(p_address->>'city','') = '' or coalesce(p_address->>'pincode','') = '' then raise exception 'Complete all required delivery address fields.'; end if;

  select id into v_address_id from public.addresses where user_id = v_user_id and is_default = true order by created_at desc, id desc limit 1 for update;
  if v_address_id is null then
    insert into public.addresses(user_id, full_name, phone, house, street, area, city, pincode, landmark, is_default)
    values(v_user_id,p_address->>'full_name',p_address->>'phone',p_address->>'house',p_address->>'street',p_address->>'area',p_address->>'city',p_address->>'pincode',nullif(p_address->>'landmark',''),true) returning id into v_address_id;
  else
    update public.addresses set full_name=p_address->>'full_name', phone=p_address->>'phone', house=p_address->>'house', street=p_address->>'street', area=p_address->>'area', city=p_address->>'city', pincode=p_address->>'pincode', landmark=nullif(p_address->>'landmark',''), is_default=true where id=v_address_id and user_id=v_user_id;
  end if;
  v_address := jsonb_build_object('full_name',p_address->>'full_name','phone',p_address->>'phone','house',p_address->>'house','street',p_address->>'street','area',p_address->>'area','city',p_address->>'city','pincode',p_address->>'pincode','landmark',p_address->>'landmark');

  select coalesce(delivery_fee,39),coalesce(free_delivery_threshold,499),coalesce(minimum_order,0) into v_delivery_fee,v_free_threshold,v_minimum from public.restaurant_settings where id=1;
  if not found then v_delivery_fee:=39; v_free_threshold:=499; v_minimum:=0; end if;

  for v_item in select value from jsonb_array_elements(p_items) loop
    select * into v_food from public.food_items where id=(v_item->>'food_item_id')::uuid and is_active=true and is_available=true for update;
    if not found then raise exception 'One of the selected dishes is unavailable.'; end if;
    if not (v_item ? 'client_price') then raise exception 'Refresh your cart and review current food prices before ordering.'; end if;
    v_size := coalesce(v_item->>'size','Regular');
    if v_food.regular_price is not null or v_food.large_price is not null then
      if v_size='Regular' then v_original_price:=coalesce(v_food.regular_price,v_food.price);
      elsif v_size='Large' and v_food.large_price is not null then v_original_price:=v_food.large_price;
      else raise exception 'The selected size is unavailable for %.',v_food.name; end if;
    else
      if v_size not in ('Regular','Large') then raise exception 'Invalid size.'; end if;
      v_original_price:=v_food.price;
    end if;
    v_variant_price:=v_original_price;
    if v_food.is_today_special and (v_food.special_starts_at is null or v_food.special_starts_at<=v_now) and (v_food.special_ends_at is null or v_food.special_ends_at>v_now) then
      v_regular_price:=coalesce(v_food.regular_price,v_food.price);
      if v_food.special_price is not null and v_regular_price>0 then v_variant_price:=round(v_original_price*v_food.special_price/v_regular_price,2);
      elsif v_food.special_discount_percent>0 then v_variant_price:=round(v_original_price*(1-v_food.special_discount_percent/100),2); end if;
    end if;
    v_offer_id:=nullif(v_item->>'offer_id','')::uuid;
    v_offer_percent:=0;
    if v_offer_id is not null then
      select o.discount_percentage into v_offer_percent from public.home_special_offers o
      where o.id=v_offer_id and o.is_active and (o.start_date is null or o.start_date<=v_now) and (o.end_date is null or o.end_date>v_now)
        and exists(select 1 from public.home_special_offer_food_items link where link.offer_id=o.id and link.food_item_id=v_food.id);
      if not found then raise exception 'This offer is no longer active for %.',v_food.name; end if;
      if v_offer_percent>0 then v_variant_price:=round(v_original_price*(1-v_offer_percent/100),2); end if;
    end if;
    if (v_item->>'client_price')::numeric<>v_variant_price then raise exception 'The price for % changed. Review the updated cart and place your order again.',v_food.name; end if;
    v_qty:=(v_item->>'quantity')::integer;
    if v_qty<1 or v_qty>50 then raise exception 'Invalid item quantity.'; end if;
    v_extras:=coalesce(v_item->'extras','[]'::jsonb);
    if jsonb_typeof(v_extras)<>'array' or jsonb_array_length(v_extras)>10 then raise exception 'Invalid customizations.'; end if;
    v_unit:=v_variant_price+(jsonb_array_length(v_extras)*30);
    v_subtotal:=v_subtotal+(v_unit*v_qty);
  end loop;
  if v_subtotal<v_minimum then raise exception 'Order does not meet the minimum order value.'; end if;
  if v_subtotal>=v_free_threshold then v_delivery_fee:=0; end if;
  insert into public.orders(user_id,address_id,status,payment_method,payment_status,subtotal,delivery_fee,discount,total,address_snapshot)
  values(v_user_id,v_address_id,'pending','cod','pending',v_subtotal,v_delivery_fee,0,v_subtotal+v_delivery_fee,v_address) returning id into v_order_id;

  for v_item in select value from jsonb_array_elements(p_items) loop
    select * into v_food from public.food_items where id=(v_item->>'food_item_id')::uuid;
    v_qty:=(v_item->>'quantity')::integer; v_size:=coalesce(v_item->>'size','Regular'); v_extras:=coalesce(v_item->'extras','[]'::jsonb);
    if v_food.regular_price is not null or v_food.large_price is not null then
      if v_size='Large' then v_original_price:=v_food.large_price; else v_original_price:=coalesce(v_food.regular_price,v_food.price); end if;
    else v_original_price:=v_food.price; end if;
    v_variant_price:=v_original_price;
    if v_food.is_today_special and (v_food.special_starts_at is null or v_food.special_starts_at<=v_now) and (v_food.special_ends_at is null or v_food.special_ends_at>v_now) then
      v_regular_price:=coalesce(v_food.regular_price,v_food.price);
      if v_food.special_price is not null and v_regular_price>0 then v_variant_price:=round(v_original_price*v_food.special_price/v_regular_price,2);
      elsif v_food.special_discount_percent>0 then v_variant_price:=round(v_original_price*(1-v_food.special_discount_percent/100),2); end if;
    end if;
    v_offer_id:=nullif(v_item->>'offer_id','')::uuid; v_offer_percent:=0;
    if v_offer_id is not null then
      select o.discount_percentage into v_offer_percent from public.home_special_offers o
      where o.id=v_offer_id and o.is_active and (o.start_date is null or o.start_date<=v_now) and (o.end_date is null or o.end_date>v_now)
        and exists(select 1 from public.home_special_offer_food_items link where link.offer_id=o.id and link.food_item_id=v_food.id);
      if not found then raise exception 'This offer is no longer active for %.',v_food.name; end if;
      if v_offer_percent>0 then v_variant_price:=round(v_original_price*(1-v_offer_percent/100),2); end if;
    end if;
    v_unit:=v_variant_price+(jsonb_array_length(v_extras)*30);
    insert into public.order_items(order_id,food_item_id,name_snapshot,unit_price,quantity,size,special_instructions,offer_id,original_unit_price,discount_percentage)
    values(v_order_id,v_food.id,v_food.name,v_unit,v_qty,v_size,nullif(v_item->>'note',''),v_offer_id,v_original_price,v_offer_percent) returning id into v_order_item_id;
    insert into public.order_item_customizations(order_item_id,option_name_snapshot,additional_price) select v_order_item_id,value #>> '{}',30 from jsonb_array_elements(v_extras);
  end loop;
  return jsonb_build_object('id',v_order_id,'total',v_subtotal+v_delivery_fee,'subtotal',v_subtotal,'delivery_fee',v_delivery_fee,'address',v_address);
end;
$$;

revoke all on function public.place_cod_order(jsonb,jsonb) from public,anon;
grant execute on function public.place_cod_order(jsonb,jsonb) to authenticated;


-- ============================================================================
-- Migration: 202610080002_global_customer_data_sync.sql
-- ============================================================================

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


-- ============================================================================
-- Migration: 202610080003_strict_customer_data_isolation.sql
-- ============================================================================

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


-- ============================================================================
-- Migration: 202610080004_admin_customer_insights_access.sql
-- ============================================================================

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


-- ============================================================================
-- Migration: 202610090001_restaurant_settings_sync.sql
-- ============================================================================

-- Reuse the existing singleton restaurant_settings row. Private notification
-- preferences and payment controls stay out of the customer-facing projection.
alter table public.restaurant_settings
  add column if not exists cash_on_delivery_enabled boolean not null default true,
  add column if not exists notify_new_orders_enabled boolean not null default true;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'restaurant_settings_delivery_fee_nonnegative') then
    alter table public.restaurant_settings add constraint restaurant_settings_delivery_fee_nonnegative check (delivery_fee >= 0);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'restaurant_settings_minimum_order_nonnegative') then
    alter table public.restaurant_settings add constraint restaurant_settings_minimum_order_nonnegative check (minimum_order >= 0);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'restaurant_settings_free_threshold_nonnegative') then
    alter table public.restaurant_settings add constraint restaurant_settings_free_threshold_nonnegative check (free_delivery_threshold >= 0);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'restaurant_settings_estimated_minutes_valid') then
    alter table public.restaurant_settings add constraint restaurant_settings_estimated_minutes_valid check (estimated_delivery_minutes between 1 and 720);
  end if;
end;
$$;

alter table public.restaurant_settings enable row level security;
drop policy if exists "settings public read" on public.restaurant_settings;
drop policy if exists "settings admin manage" on public.restaurant_settings;
create policy "settings admin manage" on public.restaurant_settings
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());
revoke all on public.restaurant_settings from anon;
grant select, update on public.restaurant_settings to authenticated;

create or replace view public.customer_restaurant_settings as
select restaurant_name, logo_url, phone, email, address,
       opening_time, closing_time, is_open, delivery_fee,
       free_delivery_threshold, minimum_order,
       estimated_delivery_minutes, cash_on_delivery_enabled
from public.restaurant_settings
where id = 1;
revoke all on public.customer_restaurant_settings from public, anon, authenticated;
grant select on public.customer_restaurant_settings to anon, authenticated;
create or replace function public.place_cod_order(p_address jsonb, p_items jsonb, p_expected_delivery_fee numeric)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_user_id uuid := auth.uid();
  v_address_id uuid;
  v_address jsonb;
  v_order_id uuid;
  v_subtotal numeric(10,2) := 0;
  v_delivery_fee numeric(10,2) := 39;
  v_free_threshold numeric(10,2) := 499;
  v_minimum numeric(10,2) := 0;
  v_is_open boolean;
  v_cod_enabled boolean;
  v_item jsonb;
  v_food public.food_items%rowtype;
  v_qty integer;
  v_size text;
  v_extras jsonb;
  v_original_price numeric(10,2);
  v_regular_price numeric(10,2);
  v_variant_price numeric(10,2);
  v_unit numeric(10,2);
  v_offer_id uuid;
  v_offer_percent numeric(5,2);
  v_now timestamptz := now();
  v_order_item_id uuid;
begin
  if v_user_id is null then raise exception 'Sign in before placing your order.'; end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then raise exception 'Your cart is empty.'; end if;
  if coalesce(p_address->>'full_name','') = '' or coalesce(p_address->>'phone','') = '' or coalesce(p_address->>'house','') = '' or coalesce(p_address->>'street','') = '' or coalesce(p_address->>'area','') = '' or coalesce(p_address->>'city','') = '' or coalesce(p_address->>'pincode','') = '' then raise exception 'Complete all required delivery address fields.'; end if;

  select id into v_address_id from public.addresses where user_id = v_user_id and is_default = true order by created_at desc, id desc limit 1 for update;
  if v_address_id is null then
    insert into public.addresses(user_id, full_name, phone, house, street, area, city, pincode, landmark, is_default)
    values(v_user_id,p_address->>'full_name',p_address->>'phone',p_address->>'house',p_address->>'street',p_address->>'area',p_address->>'city',p_address->>'pincode',nullif(p_address->>'landmark',''),true) returning id into v_address_id;
  else
    update public.addresses set full_name=p_address->>'full_name', phone=p_address->>'phone', house=p_address->>'house', street=p_address->>'street', area=p_address->>'area', city=p_address->>'city', pincode=p_address->>'pincode', landmark=nullif(p_address->>'landmark',''), is_default=true where id=v_address_id and user_id=v_user_id;
  end if;
  v_address := jsonb_build_object('full_name',p_address->>'full_name','phone',p_address->>'phone','house',p_address->>'house','street',p_address->>'street','area',p_address->>'area','city',p_address->>'city','pincode',p_address->>'pincode','landmark',p_address->>'landmark');

  select delivery_fee, free_delivery_threshold, minimum_order, is_open, cash_on_delivery_enabled
  into v_delivery_fee, v_free_threshold, v_minimum, v_is_open, v_cod_enabled
  from public.restaurant_settings where id = 1;
  if not found then raise exception 'Restaurant settings are unavailable.'; end if;
  if not v_is_open then raise exception 'The restaurant is currently closed.'; end if;
  if not v_cod_enabled then raise exception 'Cash on Delivery is currently unavailable.'; end if;

  for v_item in select value from jsonb_array_elements(p_items) loop
    select * into v_food from public.food_items where id=(v_item->>'food_item_id')::uuid and is_active=true and is_available=true for update;
    if not found then raise exception 'One of the selected dishes is unavailable.'; end if;
    if not (v_item ? 'client_price') then raise exception 'Refresh your cart and review current food prices before ordering.'; end if;
    v_size := coalesce(v_item->>'size','Regular');
    if v_food.regular_price is not null or v_food.large_price is not null then
      if v_size='Regular' then v_original_price:=coalesce(v_food.regular_price,v_food.price);
      elsif v_size='Large' and v_food.large_price is not null then v_original_price:=v_food.large_price;
      else raise exception 'The selected size is unavailable for %.',v_food.name; end if;
    else
      if v_size not in ('Regular','Large') then raise exception 'Invalid size.'; end if;
      v_original_price:=v_food.price;
    end if;
    v_variant_price:=v_original_price;
    if v_food.is_today_special and (v_food.special_starts_at is null or v_food.special_starts_at<=v_now) and (v_food.special_ends_at is null or v_food.special_ends_at>v_now) then
      v_regular_price:=coalesce(v_food.regular_price,v_food.price);
      if v_food.special_price is not null and v_regular_price>0 then v_variant_price:=round(v_original_price*v_food.special_price/v_regular_price,2);
      elsif v_food.special_discount_percent>0 then v_variant_price:=round(v_original_price*(1-v_food.special_discount_percent/100),2); end if;
    end if;
    v_offer_id:=nullif(v_item->>'offer_id','')::uuid;
    v_offer_percent:=0;
    if v_offer_id is not null then
      select o.discount_percentage into v_offer_percent from public.home_special_offers o
      where o.id=v_offer_id and o.is_active and (o.start_date is null or o.start_date<=v_now) and (o.end_date is null or o.end_date>v_now)
        and exists(select 1 from public.home_special_offer_food_items link where link.offer_id=o.id and link.food_item_id=v_food.id);
      if not found then raise exception 'This offer is no longer active for %.',v_food.name; end if;
      if v_offer_percent>0 then v_variant_price:=round(v_original_price*(1-v_offer_percent/100),2); end if;
    end if;
    if (v_item->>'client_price')::numeric<>v_variant_price then raise exception 'The price for % changed. Review the updated cart and place your order again.',v_food.name; end if;
    v_qty:=(v_item->>'quantity')::integer;
    if v_qty<1 or v_qty>50 then raise exception 'Invalid item quantity.'; end if;
    v_extras:=coalesce(v_item->'extras','[]'::jsonb);
    if jsonb_typeof(v_extras)<>'array' or jsonb_array_length(v_extras)>10 then raise exception 'Invalid customizations.'; end if;
    v_unit:=v_variant_price+(jsonb_array_length(v_extras)*30);
    v_subtotal:=v_subtotal+(v_unit*v_qty);
  end loop;
  if v_subtotal < v_minimum then raise exception 'Order does not meet the minimum order value.'; end if;
  if p_expected_delivery_fee is null or round(p_expected_delivery_fee, 2) <> round(case when v_subtotal >= v_free_threshold then 0 else v_delivery_fee end, 2) then
    raise exception 'Delivery settings changed. Refresh the checkout total and try again.';
  end if;
  if v_subtotal >= v_free_threshold then v_delivery_fee := 0; end if;
  insert into public.orders(user_id,address_id,status,payment_method,payment_status,subtotal,delivery_fee,discount,total,address_snapshot)
  values(v_user_id,v_address_id,'pending','cod','pending',v_subtotal,v_delivery_fee,0,v_subtotal+v_delivery_fee,v_address) returning id into v_order_id;

  for v_item in select value from jsonb_array_elements(p_items) loop
    select * into v_food from public.food_items where id=(v_item->>'food_item_id')::uuid;
    v_qty:=(v_item->>'quantity')::integer; v_size:=coalesce(v_item->>'size','Regular'); v_extras:=coalesce(v_item->'extras','[]'::jsonb);
    if v_food.regular_price is not null or v_food.large_price is not null then
      if v_size='Large' then v_original_price:=v_food.large_price; else v_original_price:=coalesce(v_food.regular_price,v_food.price); end if;
    else v_original_price:=v_food.price; end if;
    v_variant_price:=v_original_price;
    if v_food.is_today_special and (v_food.special_starts_at is null or v_food.special_starts_at<=v_now) and (v_food.special_ends_at is null or v_food.special_ends_at>v_now) then
      v_regular_price:=coalesce(v_food.regular_price,v_food.price);
      if v_food.special_price is not null and v_regular_price>0 then v_variant_price:=round(v_original_price*v_food.special_price/v_regular_price,2);
      elsif v_food.special_discount_percent>0 then v_variant_price:=round(v_original_price*(1-v_food.special_discount_percent/100),2); end if;
    end if;
    v_offer_id:=nullif(v_item->>'offer_id','')::uuid; v_offer_percent:=0;
    if v_offer_id is not null then
      select o.discount_percentage into v_offer_percent from public.home_special_offers o
      where o.id=v_offer_id and o.is_active and (o.start_date is null or o.start_date<=v_now) and (o.end_date is null or o.end_date>v_now)
        and exists(select 1 from public.home_special_offer_food_items link where link.offer_id=o.id and link.food_item_id=v_food.id);
      if not found then raise exception 'This offer is no longer active for %.',v_food.name; end if;
      if v_offer_percent>0 then v_variant_price:=round(v_original_price*(1-v_offer_percent/100),2); end if;
    end if;
    v_unit:=v_variant_price+(jsonb_array_length(v_extras)*30);
    insert into public.order_items(order_id,food_item_id,name_snapshot,unit_price,quantity,size,special_instructions,offer_id,original_unit_price,discount_percentage)
    values(v_order_id,v_food.id,v_food.name,v_unit,v_qty,v_size,nullif(v_item->>'note',''),v_offer_id,v_original_price,v_offer_percent) returning id into v_order_item_id;
    insert into public.order_item_customizations(order_item_id,option_name_snapshot,additional_price) select v_order_item_id,value #>> '{}',30 from jsonb_array_elements(v_extras);
  end loop;
  return jsonb_build_object('id',v_order_id,'total',v_subtotal+v_delivery_fee,'subtotal',v_subtotal,'delivery_fee',v_delivery_fee,'address',v_address);
end;
$$;
revoke all on function public.place_cod_order(jsonb, jsonb, numeric) from public, anon;
grant execute on function public.place_cod_order(jsonb, jsonb, numeric) to authenticated;
drop function if exists public.place_cod_order(jsonb, jsonb);


-- ============================================================================
-- Migration: 202610090002_fix_customer_restaurant_settings_view_access.sql
-- ============================================================================

-- Keep the underlying settings table private while allowing customers to read
-- only the columns exposed by the projection view.
alter view public.customer_restaurant_settings
  set (security_invoker = false);

revoke all on public.customer_restaurant_settings from public, anon, authenticated;
grant select on public.customer_restaurant_settings to anon, authenticated;
notify pgrst, 'reload schema';


-- ============================================================================
-- Migration: 202610090003_customer_order_review_lookup.sql
-- ============================================================================

-- Customer order history cannot embed reviews directly because the review
-- table intentionally withholds order_id from client SELECT grants. Resolve
-- review state through an ownership-checked RPC instead.
create or replace function public.get_customer_order_food_reviews(p_order_ids uuid[])
returns table(
  order_id uuid,
  food_item_id uuid,
  food_rating integer,
  comment text,
  created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception 'Sign in to view your order reviews.';
  end if;
  if p_order_ids is null or cardinality(p_order_ids) > 500 then
    raise exception 'Invalid order review lookup.';
  end if;

  return query
  select r.order_id, r.food_item_id, r.food_rating, r.comment, r.created_at
  from public.reviews r
  where r.order_id = any(p_order_ids)
    and exists (
      select 1
      from public.orders o
      where o.id = r.order_id and o.user_id = v_user_id
    )
  order by r.created_at;
end;
$$;

revoke all on function public.get_customer_order_food_reviews(uuid[]) from public, anon;
grant execute on function public.get_customer_order_food_reviews(uuid[]) to authenticated;
