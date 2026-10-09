-- Keep restaurant_settings private while allowing the customer projection
-- view to be read through Supabase REST by anon and authenticated customers.
-- Without security_invoker=false, REST can require the caller to have direct
-- SELECT permission on the private base table.
alter view public.customer_restaurant_settings
  set (security_invoker = false);

revoke all on public.customer_restaurant_settings from public, anon, authenticated;
grant select on public.customer_restaurant_settings to anon, authenticated;

notify pgrst, 'reload schema';
