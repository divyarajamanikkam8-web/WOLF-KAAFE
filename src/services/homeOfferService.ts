import { supabase } from '../lib/supabase';
import { getFoodRatings } from './menuService';
import type { FoodItem, FoodType } from '../types';

export type HomeSpecialOffer = {
  id: string;
  title: string;
  heading: string;
  description: string;
  discount_text: string;
  discount_percentage: number;
  button_text: string;
  image_url: string | null;
  video_url: string | null;
  is_active: boolean;
  start_date: string | null;
  end_date: string | null;
  display_order: number;
  created_at: string;
  updated_at: string;
  food_item_ids: string[];
};

export type HomeSpecialOfferInput = Omit<HomeSpecialOffer, 'id' | 'created_at' | 'updated_at' | 'food_item_ids'> & { food_item_ids: string[] };

function client() {
  if (!supabase) throw new Error('Supabase is not configured. Connect the database to manage home offers.');
  return supabase;
}

function mapOffer(row: Record<string, unknown>): HomeSpecialOffer {
  const linked = row.home_special_offer_food_items as { food_item_id: string }[] | null;
  return {
    id: String(row.id),
    title: String(row.title ?? ''),
    heading: String(row.heading ?? ''),
    description: String(row.description ?? ''),
    discount_text: String(row.discount_text ?? ''),
    discount_percentage: Number(row.discount_percentage ?? 0),
    button_text: String(row.button_text ?? ''),
    image_url: row.image_url ? String(row.image_url) : null,
    video_url: row.video_url ? String(row.video_url) : null,
    is_active: Boolean(row.is_active),
    start_date: row.start_date ? String(row.start_date) : null,
    end_date: row.end_date ? String(row.end_date) : null,
    display_order: Number(row.display_order ?? 0),
    created_at: String(row.created_at ?? ''),
    updated_at: String(row.updated_at ?? ''),
    food_item_ids: (linked ?? []).map(item => item.food_item_id),
  };
}

const offerSelect = 'id,title,heading,description,discount_text,discount_percentage,button_text,image_url,video_url,is_active,start_date,end_date,display_order,created_at,updated_at,home_special_offer_food_items(food_item_id)';

function isOfferWithinSchedule(offer: Pick<HomeSpecialOffer, 'start_date' | 'end_date'>, now = Date.now()) {
  const start = offer.start_date ? new Date(offer.start_date).getTime() : null;
  const end = offer.end_date ? new Date(offer.end_date).getTime() : null;
  return (start === null || now >= start) && (end === null || now < end);
}

export async function getActiveHomeSpecialOffer(): Promise<HomeSpecialOffer | null> {
  const { data, error } = await client().from('home_special_offers').select(offerSelect)
    .eq('is_active', true).order('display_order').order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).map(row => mapOffer(row as unknown as Record<string, unknown>)).find(offer => isOfferWithinSchedule(offer)) ?? null;
}

export async function getActiveHomeSpecialOfferById(offerId: string): Promise<HomeSpecialOffer | null> {
  const { data, error } = await client().from('home_special_offers').select(offerSelect)
    .eq('id', offerId).eq('is_active', true).maybeSingle();
  if (error) throw error;
  const offer = data ? mapOffer(data as unknown as Record<string, unknown>) : null;
  return offer && isOfferWithinSchedule(offer) ? offer : null;
}

export async function getActiveHomeOfferDiscounts(offerIds: string[]): Promise<Record<string, number>> {
  if (!offerIds.length) return {};
  const { data, error } = await client().from('home_special_offers').select('id,discount_percentage,start_date,end_date')
    .in('id', offerIds).eq('is_active', true);
  if (error) throw error;
  return Object.fromEntries((data ?? []).filter(row => isOfferWithinSchedule(row)).map(row => [row.id, Number(row.discount_percentage ?? 0)]));
}

export async function getHomeOfferFoods(foodIds: string[]): Promise<FoodItem[]> {
  if (!foodIds.length) return [];
  const db = client();
  const { data, error } = await db.from('food_items')
    .select('id,name,description,price,regular_price,large_price,image_url,is_veg,food_type,display_order,prep_minutes,is_featured,is_today_special,special_price,special_discount_percent,special_starts_at,special_ends_at,is_available,is_active,category_id')
    .in('id', foodIds).eq('is_active', true).eq('is_available', true)
    .order('display_order').order('name');
  if (error) throw error;
  const rows = data ?? [];
  if (!rows.length) return [];
  const categoryIds = [...new Set(rows.map(row => row.category_id).filter((id): id is string => Boolean(id)))];
  const [{ data: categories, error: categoryError }, ratings] = await Promise.all([
    categoryIds.length ? db.from('categories').select('id,name').in('id', categoryIds).eq('is_active', true) : Promise.resolve({ data: [], error: null }),
    getFoodRatings(rows.map(row => row.id)),
  ]);
  if (categoryError) throw categoryError;
  const categoryNames = new Map((categories ?? []).map(category => [category.id, category.name]));
  return rows.map(row => ({
    id: row.id,
    name: row.name,
    description: row.description,
    category: row.category_id ? categoryNames.get(row.category_id) ?? 'Menu' : 'Menu',
    categoryId: row.category_id,
    foodType: row.food_type as FoodType | null,
    price: Number(row.price),
    regularPrice: row.regular_price == null ? null : Number(row.regular_price),
    largePrice: row.large_price == null ? null : Number(row.large_price),
    displayOrder: Number(row.display_order ?? 0),
    rating: ratings[row.id]?.rating ?? 0,
    reviews: ratings[row.id]?.reviews ?? 0,
    time: `${row.prep_minutes} min`,
    image: row.image_url ?? '',
    veg: Boolean(row.is_veg),
    available: Boolean(row.is_available),
    active: Boolean(row.is_active),
    isTodaySpecial: row.is_today_special ?? false,
    specialPrice: row.special_price == null ? null : Number(row.special_price),
    specialDiscountPercent: Number(row.special_discount_percent ?? 0),
    specialStartsAt: row.special_starts_at ?? null,
    specialEndsAt: row.special_ends_at ?? null,
    badge: row.is_featured ? 'Popular' : undefined,
  }));
}

export async function getAdminHomeSpecialOffers(): Promise<HomeSpecialOffer[]> {
  const { data, error } = await client().from('home_special_offers').select(offerSelect)
    .order('display_order').order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).map(row => mapOffer(row as unknown as Record<string, unknown>));
}

export async function saveHomeSpecialOffer(input: HomeSpecialOfferInput, id?: string) {
  const db = client();
  const { food_item_ids, ...fields } = input;
  const saved = id
    ? await db.from('home_special_offers').update(fields).eq('id', id).select('id').single()
    : await db.from('home_special_offers').insert(fields).select('id').single();
  if (saved.error) throw saved.error;
  const offerId = saved.data.id;
  const { error: deleteError } = await db.from('home_special_offer_food_items').delete().eq('offer_id', offerId);
  if (deleteError) throw deleteError;
  const links = food_item_ids.map(food_item_id => ({ offer_id: offerId, food_item_id }));
  if (links.length) {
    const { error } = await db.from('home_special_offer_food_items').insert(links);
    if (error) throw error;
  }
}

export async function deleteHomeSpecialOffer(id: string) {
  const { error } = await client().from('home_special_offers').delete().eq('id', id);
  if (error) throw error;
}

export async function uploadHomeOfferMedia(file: File) {
  const db = client();
  const isImage = ['image/jpeg', 'image/png', 'image/webp', 'image/avif'].includes(file.type);
  const isVideo = ['video/mp4', 'video/webm'].includes(file.type);
  if (!isImage && !isVideo) throw new Error('Choose a JPG, PNG, WebP, AVIF, MP4, or WebM file.');
  if (file.size > 50 * 1024 * 1024) throw new Error('Promotional media must be smaller than 50 MB.');
  const { data: auth, error: authError } = await db.auth.getUser();
  if (authError) throw authError;
  if (!auth.user) throw new Error('Sign in as an admin to upload promotional media.');
  const extension = file.name.split('.').pop()?.toLowerCase() || (isVideo ? 'mp4' : 'jpg');
  const path = `${auth.user.id}/${crypto.randomUUID()}.${extension}`;
  const { error } = await db.storage.from('home-offer-media').upload(path, file, { contentType: file.type, cacheControl: '3600', upsert: false });
  if (error) throw error;
  return { path, url: db.storage.from('home-offer-media').getPublicUrl(path).data.publicUrl, kind: isVideo ? 'video' as const : 'image' as const };
}

export async function removeHomeOfferMedia(path: string) {
  const { error } = await client().storage.from('home-offer-media').remove([path]);
  if (error) throw error;
}

export function getHomeOfferMediaPath(url: string | null) {
  const marker = '/storage/v1/object/public/home-offer-media/';
  const index = url?.indexOf(marker) ?? -1;
  return index < 0 ? null : decodeURIComponent(url!.slice(index + marker.length).split('?')[0]);
}
