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
