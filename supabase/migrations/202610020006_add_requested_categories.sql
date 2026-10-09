-- Add the requested food and drink categories to the database-backed menu.
-- Names stay plain text; each category uses a real food/drink image URL.
insert into public.categories (name, image_url, sort_order, is_active)
values
  ('Pizza', 'https://images.unsplash.com/photo-1574071318508-1cdbab80d002?auto=format&fit=crop&w=400&q=80', 1, true),
  ('Burgers', 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=400&q=80', 2, true),
  ('Sandwiches', 'https://images.unsplash.com/photo-1553909489-cd47e0ef937f?auto=format&fit=crop&w=400&q=80', 3, true),
  ('Pasta', 'https://images.unsplash.com/photo-1473093295043-cdd812d0e601?auto=format&fit=crop&w=400&q=80', 4, true),
  ('Appetizers', 'https://images.unsplash.com/photo-1547592180-85f173990554?auto=format&fit=crop&w=400&q=80', 5, true),
  ('Fruit Juices', 'https://images.unsplash.com/photo-1600271886742-f049cd451bba?auto=format&fit=crop&w=400&q=80', 6, true),
  ('Iced Coffee', 'https://images.unsplash.com/photo-1461023058943-07fcbe16d735?auto=format&fit=crop&w=400&q=80', 7, true),
  ('Milkshakes', 'https://images.unsplash.com/photo-1572490122747-3968b75cc699?auto=format&fit=crop&w=400&q=80', 8, true),
  ('Smoothies', 'https://images.unsplash.com/photo-1505252585461-04db1a846145?auto=format&fit=crop&w=400&q=80', 9, true),
  ('Mocktails', 'https://images.unsplash.com/photo-1513558161293-cdaf765edfd47?auto=format&fit=crop&w=400&q=80', 10, true),
  ('Mojitos', 'https://images.unsplash.com/photo-1514362545857-3bc16c4c7d1b?auto=format&fit=crop&w=400&q=80', 11, true),
  ('Lassi', 'https://images.unsplash.com/photo-1553530666-ba11a7da3888?auto=format&fit=crop&w=400&q=80', 12, true),
  ('Shots', 'https://images.unsplash.com/photo-1514362545857-3bc16c4c7d1b?auto=format&fit=crop&w=400&q=80', 13, true),
  ('Sprout / Chaat', 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&fit=crop&w=400&q=80', 14, true),
  ('Tea', 'https://images.unsplash.com/photo-1544787219-7f47ccb76574?auto=format&fit=crop&w=400&q=80', 15, true)
on conflict (name) do update
set image_url = excluded.image_url,
    sort_order = excluded.sort_order,
    is_active = true;
