import { supabase } from '../lib/supabase';
import type { Category, FoodItem, FoodType } from '../types';

type CategoryRow = { id: string; name: string; image_url?: string | null };
type MenuRow = {
  id: string;
  name: string;
  description: string;
  price: number | string;
  regular_price: number | string | null;
  large_price: number | string | null;
  image_url: string | null;
  is_veg: boolean;
  food_type: FoodType | null;
  display_order: number;
  prep_minutes: number;
  is_featured: boolean;
  is_today_special?: boolean;
  special_price?: number | string | null;
  special_discount_percent?: number | string;
  special_starts_at?: string | null;
  special_ends_at?: string | null;
  is_available: boolean;
  is_active: boolean;
  category_id: string | null;
};

function requireSupabase() {
  if (!supabase) throw new Error('Supabase is not configured. Connect the restaurant database to load the menu.');
  return supabase;
}

export async function getCategories(): Promise<Category[]> {
  const client = requireSupabase();
  const { data, error } = await client.from('categories')
    .select('id,name,image_url')
    .eq('is_active', true)
    .order('sort_order')
    .order('name');
  if (error) throw error;
  return (data ?? []).map((row: CategoryRow) => ({ id: row.id, name: row.name, image: row.image_url ?? '' }));
}

export async function getMenu(): Promise<FoodItem[]> {
  const client = requireSupabase();
  const [menuResult, { data: categoryRows, error: categoryError }] = await Promise.all([
    client.from('food_items')
      .select('id,name,description,price,regular_price,large_price,image_url,is_veg,food_type,display_order,prep_minutes,is_featured,is_today_special,special_price,special_discount_percent,special_starts_at,special_ends_at,is_available,is_active,category_id')
      .eq('is_active', true).order('is_featured', { ascending: false }).order('display_order').order('name'),
    client.from('categories').select('id,name').eq('is_active', true),
  ]);
  let data = menuResult.data as MenuRow[] | null;
  let error = menuResult.error;
  if (error && isTodaySpecialSchemaMissing(error)) {
    const fallback = await client.from('food_items')
      .select('id,name,description,price,regular_price,large_price,image_url,is_veg,food_type,display_order,prep_minutes,is_featured,is_available,is_active,category_id')
      .eq('is_active', true).order('is_featured', { ascending: false }).order('display_order').order('name');
    data = fallback.data as MenuRow[] | null;
    error = fallback.error;
  }
  if (error) throw error;
  if (categoryError) throw categoryError;

  const ratings = await getFoodRatings((data ?? []).map(row => row.id));
  const categories = new Map<string, CategoryRow>((categoryRows ?? []).map((category: CategoryRow) => [category.id, category]));
  return (data ?? []).map((row: MenuRow) => ({
    id: row.id,
    name: row.name,
    description: row.description,
    category: row.category_id ? categories.get(row.category_id)?.name ?? 'Menu' : 'Menu',
    categoryId: row.category_id,
    foodType: row.food_type,
    price: Number(row.price),
    regularPrice: row.regular_price === null ? null : Number(row.regular_price),
    largePrice: row.large_price === null ? null : Number(row.large_price),
    displayOrder: Number(row.display_order ?? 0),
    rating: ratings[row.id]?.rating ?? 0,
    reviews: ratings[row.id]?.reviews ?? 0,
    time: `${row.prep_minutes} min`,
    image: row.image_url ?? '',
    veg: row.is_veg,
    available: row.is_available,
    active: row.is_active,
    isTodaySpecial: row.is_today_special ?? false,
    specialPrice: row.special_price === null ? null : Number(row.special_price),
    specialDiscountPercent: Number(row.special_discount_percent ?? 0),
    specialStartsAt: row.special_starts_at ?? null,
    specialEndsAt: row.special_ends_at ?? null,
    badge: row.is_featured ? 'Popular' : undefined,
  }));
}

export function isTodaySpecialSchemaMissing(error: { code?: string; message?: string }) {
  const details = `${error.code ?? ''} ${error.message ?? ''}`;
  return /is_today_special|special_price|special_discount_percent|special_starts_at|special_ends_at/i.test(details)
    && /column|schema cache|does not exist|PGRST204|42703/i.test(details);
}

export async function getFoodRatings(foodIds: string[]) {
  if (!foodIds.length) return {} as Record<string, { rating: number; reviews: number }>;
  const client = requireSupabase();
  const { data, error } = await client.rpc('get_food_rating_summaries', { p_food_ids: foodIds });
  if (error) {
    const details = `${error.code ?? ''} ${error.message ?? ''}`;
    if (!/PGRST202|42883|function.*not found|schema cache/i.test(details)) throw error;
    // Keep the current menu usable before the new migration is applied.
    const legacy = await client.from('reviews').select('food_item_id,food_rating').in('food_item_id', foodIds);
    if (legacy.error) throw legacy.error;
    const totals = new Map<string, { sum: number; count: number }>();
    for (const review of legacy.data ?? []) {
      if (!review.food_item_id) continue;
      const current = totals.get(review.food_item_id) ?? { sum: 0, count: 0 };
      current.sum += Number(review.food_rating);
      current.count += 1;
      totals.set(review.food_item_id, current);
    }
    return Object.fromEntries([...totals].map(([foodId, total]) => [foodId, {
      rating: Math.round(total.sum / total.count * 10) / 10,
      reviews: total.count,
    }]));
  }
  return Object.fromEntries((data ?? []).map((row: { food_item_id: string; average_rating: number | string; review_count: number | string }) => [row.food_item_id, {
    rating: Number(row.average_rating),
    reviews: Number(row.review_count),
  }]));
}
