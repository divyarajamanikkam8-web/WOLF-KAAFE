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
