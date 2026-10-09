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
