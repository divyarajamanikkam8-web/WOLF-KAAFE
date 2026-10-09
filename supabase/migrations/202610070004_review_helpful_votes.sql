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
