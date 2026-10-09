begin;

-- The menu now uses its primary category only. Remove the old catalog identity
-- index before dropping the column it depends on, then keep a lookup index
-- that supports category/name queries without making menu rows unique.
drop index if exists public.food_items_catalog_identity_unique;

alter table public.food_items
  drop column if exists subcategory;

create index if not exists food_items_catalog_identity_idx
  on public.food_items (category_id, lower(name), coalesce(food_type, ''))
  where is_active = true;

commit;
