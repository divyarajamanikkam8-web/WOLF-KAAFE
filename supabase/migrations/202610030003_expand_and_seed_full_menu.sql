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
