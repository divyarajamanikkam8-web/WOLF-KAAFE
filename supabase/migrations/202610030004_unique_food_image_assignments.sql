begin;

-- Store a content digest with each uploaded menu image. This makes it possible
-- to reject assigning the same photo bytes to more than one food item.
alter table public.food_items
  add column if not exists image_sha256 text;

alter table public.food_items
  drop constraint if exists food_items_image_sha256_check;
alter table public.food_items
  add constraint food_items_image_sha256_check
  check (image_sha256 is null or image_sha256 ~ '^[0-9a-f]{64}$');

update public.food_items
set image_url = null,
    image_sha256 = null,
    updated_at = now()
where image_url is not null and btrim(image_url) = '';

-- Keep one existing record when older data already reuses the same URL.
-- The remaining rows are marked missing so the Admin page can assign an
-- item-specific image instead of silently showing another food's photo.
with ranked_images as (
  select id,
         row_number() over (
           partition by btrim(image_url)
           order by updated_at desc nulls last, created_at desc nulls last, id
         ) as position
  from public.food_items
  where image_url is not null and btrim(image_url) <> ''
)
update public.food_items as food
set image_url = null,
    image_sha256 = null,
    updated_at = now()
from ranked_images
where food.id = ranked_images.id
  and ranked_images.position > 1;

-- Also clear previously recorded duplicate file digests, if this migration is
-- being applied after an earlier manual rollout of the digest column.
with ranked_digests as (
  select id,
         row_number() over (
           partition by image_sha256
           order by updated_at desc nulls last, created_at desc nulls last, id
         ) as position
  from public.food_items
  where image_sha256 is not null
)
update public.food_items as food
set image_url = null,
    image_sha256 = null,
    updated_at = now()
from ranked_digests
where food.id = ranked_digests.id
  and ranked_digests.position > 1;

-- Reject both reusing an image URL and uploading the same image file under a
-- different URL. Null values remain allowed while existing records are being
-- assigned their item-specific photos.
create unique index if not exists food_items_image_url_unique
  on public.food_items (image_url)
  where image_url is not null;

create unique index if not exists food_items_image_sha256_unique
  on public.food_items (image_sha256)
  where image_sha256 is not null;

commit;
