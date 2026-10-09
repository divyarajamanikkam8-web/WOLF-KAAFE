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
