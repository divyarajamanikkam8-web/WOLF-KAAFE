-- Ensure the standard Wolf Kaafe categories exist for the Add Food form.
-- Existing categories and their active/inactive state are preserved.
insert into public.categories (name, image_url, sort_order, is_active)
values
  ('Burgers', 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=400&q=80', 1, true),
  ('Pizza', 'https://images.unsplash.com/photo-1574071318508-1cdbab80d002?auto=format&fit=crop&w=400&q=80', 2, true),
  ('Biriyani', 'https://images.unsplash.com/photo-1563379091339-03246963d96c?auto=format&fit=crop&w=400&q=80', 3, true),
  ('Shawarma', 'https://images.unsplash.com/photo-1529006557810-274b9b2fc783?auto=format&fit=crop&w=400&q=80', 4, true),
  ('Fried Chicken', 'https://images.unsplash.com/photo-1626082927389-6cd097cdc6ec?auto=format&fit=crop&w=400&q=80', 5, true),
  ('Sandwiches', 'https://images.unsplash.com/photo-1553909489-cd47e0ef937f?auto=format&fit=crop&w=400&q=80', 6, true),
  ('Desserts', 'https://images.unsplash.com/photo-1606313564200-e75d5e30476c?auto=format&fit=crop&w=400&q=80', 7, true),
  ('Beverages', 'https://images.unsplash.com/photo-1461023058943-07fcbe16d735?auto=format&fit=crop&w=400&q=80', 8, true)
on conflict (name) do nothing;
