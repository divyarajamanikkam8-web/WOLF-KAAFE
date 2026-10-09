-- Customers can read available food rows, but they do not have an UPDATE
-- policy on food_items. PostgreSQL applies UPDATE policies to SELECT FOR
-- UPDATE, so an invoker function could mistake a readable food for a missing
-- one. This RPC validates auth.uid(), availability, price, and quantity itself
-- and uses only schema-qualified database objects, so run it as its owner.
alter function public.place_cod_order(jsonb, jsonb) security definer;
alter function public.place_cod_order(jsonb, jsonb) set search_path = '';

revoke all on function public.place_cod_order(jsonb, jsonb) from public, anon;
grant execute on function public.place_cod_order(jsonb, jsonb) to authenticated;
