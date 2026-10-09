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
