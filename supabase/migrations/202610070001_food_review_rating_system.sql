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
