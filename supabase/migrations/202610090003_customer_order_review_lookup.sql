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
