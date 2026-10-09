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
