import { supabase } from '../lib/supabase';
import type { FoodType } from '../types';
import { isTodaySpecialSchemaMissing } from './menuService';

export type AdminMenuItem = {
  id: string;
  name: string;
  description: string;
  category_id: string | null;
  category_name: string;
  food_type: FoodType | null;
  price: number;
  regular_price: number | null;
  large_price: number | null;
  discount_percent: number;
  image_url: string | null;
  image_sha256: string | null;
  prep_minutes: number;
  is_veg: boolean;
  is_available: boolean;
  is_active: boolean;
  is_featured: boolean;
  is_today_special: boolean;
  special_price: number | null;
  special_discount_percent: number;
  special_starts_at: string | null;
  special_ends_at: string | null;
  display_order: number;
};

export type AdminCategory = { id: string; name: string; image_url: string | null; is_active: boolean };
export type FoodInput = Omit<AdminMenuItem, 'id' | 'category_name'>;
export type AdminMenuData = { foods: AdminMenuItem[]; todaySpecialAvailable: boolean };
type AdminMenuRow = Omit<AdminMenuItem, 'category_name' | 'is_today_special' | 'special_price' | 'special_discount_percent' | 'special_starts_at' | 'special_ends_at'>
  & Partial<Pick<AdminMenuItem, 'is_today_special' | 'special_price' | 'special_discount_percent' | 'special_starts_at' | 'special_ends_at'>>;

function client() {
  if (!supabase) throw new Error('Supabase is not configured. Connect the database to manage menu items.');
  return supabase;
}

export async function getAdminCategories(): Promise<AdminCategory[]> {
  const { data, error } = await client().from('categories').select('id,name,image_url,is_active').eq('is_active', true).order('sort_order').order('name');
  if (error) throw error;
  return data ?? [];
}

export async function getAdminMenu(): Promise<AdminMenuData> {
  const db = client();
  const [menuResult, categories] = await Promise.all([
    db.from('food_items').select('id,name,description,category_id,food_type,price,regular_price,large_price,discount_percent,image_url,image_sha256,prep_minutes,is_veg,is_available,is_active,is_featured,is_today_special,special_price,special_discount_percent,special_starts_at,special_ends_at,display_order').order('display_order').order('name'),
    getAdminCategories(),
  ]);
  let data: AdminMenuRow[] | null = menuResult.data;
  let error = menuResult.error;
  let todaySpecialAvailable = true;
  if (error && isTodaySpecialSchemaMissing(error)) {
    const fallback = await db.from('food_items').select('id,name,description,category_id,food_type,price,regular_price,large_price,discount_percent,image_url,image_sha256,prep_minutes,is_veg,is_available,is_active,is_featured,display_order').order('display_order').order('name');
    data = fallback.data;
    error = fallback.error;
    todaySpecialAvailable = false;
  }
  if (error) throw error;
  const categoryNames = new Map(categories.map(category => [category.id, category.name]));
  const foods = (data ?? []).map(item => ({
    ...item,
    price: Number(item.price),
    discount_percent: Number(item.discount_percent ?? 0),
    is_today_special: item.is_today_special ?? false,
    special_price: item.special_price == null ? null : Number(item.special_price),
    special_discount_percent: Number(item.special_discount_percent ?? 0),
    special_starts_at: item.special_starts_at ?? null,
    special_ends_at: item.special_ends_at ?? null,
    category_name: item.category_id ? categoryNames.get(item.category_id) ?? 'Uncategorized' : 'Uncategorized',
  }));
  return { foods, todaySpecialAvailable };
}

export async function foodImageSha256(file: File) {
  const digest = await crypto.subtle.digest('SHA-256', await file.arrayBuffer());
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
}

export async function uploadFoodImage(file: File, sha256: string, excludeFoodId?: string) {
  const db = client();
  if (!file.type.startsWith('image/')) throw new Error('Choose an image file.');
  if (file.size > 8 * 1024 * 1024) throw new Error('Choose an image smaller than 8 MB.');
  const extension = file.name.split('.').pop()?.toLowerCase() ?? 'jpg';
  if (!['jpg', 'jpeg', 'png', 'webp', 'avif'].includes(extension)) throw new Error('Use a JPG, PNG, WebP, or AVIF image.');
  // Check the persisted session before calling Storage so an expired or
  // missing Admin login gets a useful recovery message instead of the raw
  // Storage error: "Auth session missing!".
  const { data: sessionData, error: sessionError } = await db.auth.getSession();
  if (sessionError) throw new Error('Could not verify your Owner/Admin login. Sign in again, then retry the upload.');
  if (!sessionData.session) throw new Error('Your Owner/Admin login session is missing or expired. Sign in again, then retry saving the food.');

  const { data: authData, error: authError } = await db.auth.getUser();
  if (authError) {
    if (/session missing|session not found|jwt expired/i.test(authError.message)) {
      throw new Error('Your Owner/Admin login session is missing or expired. Sign in again, then retry saving the food.');
    }
    throw authError;
  }
  if (!authData.user) throw new Error('Your Owner/Admin login session is missing or expired. Sign in again, then retry saving the food.');

  let duplicateQuery = db.from('food_items').select('id,name').eq('image_sha256', sha256);
  if (excludeFoodId) duplicateQuery = duplicateQuery.neq('id', excludeFoodId);
  const { data: duplicate, error: duplicateError } = await duplicateQuery.maybeSingle();
  if (duplicateError) throw duplicateError;
  if (duplicate) throw new Error(`This exact image is already assigned to “${duplicate.name}”. Choose a different food image.`);

  const path = `${authData.user.id}/${sha256}.${extension}`;
  const { error } = await db.storage.from('food-images').upload(path, file, { contentType: file.type, cacheControl: '3600', upsert: false });
  if (error) throw error;
  return { path, url: db.storage.from('food-images').getPublicUrl(path).data.publicUrl, sha256 };
}

export async function removeFoodImage(path: string) {
  const { error } = await client().storage.from('food-images').remove([path]);
  if (error) throw error;
}

function getStoredFoodImagePath(url: string | null) {
  if (!url) return null;
  const marker = '/storage/v1/object/public/food-images/';
  const markerIndex = url.indexOf(marker);
  return markerIndex < 0 ? null : decodeURIComponent(url.slice(markerIndex + marker.length).split('?')[0]);
}

export async function createFood(input: FoodInput) {
  const db = client();
  let { error } = await db.from('food_items').insert({ ...input, is_active: true }).select('id').single();
  if (error && isTodaySpecialSchemaMissing(error)) {
    if (hasTodaySpecialSettings(input)) throw new Error('Apply migration 202610050003_today_special_menu.sql before saving Today’s Special settings.');
    const fallback = await db.from('food_items').insert({ ...withoutTodaySpecialSettings(input), is_active: true }).select('id').single();
    error = fallback.error;
  }
  if (error) throw error;
}

export async function updateFood(id: string, input: FoodInput) {
  const db = client();
  const { data: current, error: readError } = await db.from('food_items').select('image_url').eq('id', id).single();
  if (readError) throw readError;
  let { error } = await db.from('food_items').update(input).eq('id', id).select('id').single();
  if (error && isTodaySpecialSchemaMissing(error)) {
    if (hasTodaySpecialSettings(input)) throw new Error('Apply migration 202610050003_today_special_menu.sql before saving Today’s Special settings.');
    const fallback = await db.from('food_items').update(withoutTodaySpecialSettings(input)).eq('id', id).select('id').single();
    error = fallback.error;
  }
  if (error) throw error;
  if (current.image_url !== input.image_url) {
    const oldPath = getStoredFoodImagePath(current.image_url);
    if (oldPath) await db.storage.from('food-images').remove([oldPath]);
  }
}

export async function setFoodAvailability(id: string, isAvailable: boolean) {
  const { error } = await client().from('food_items').update({ is_available: isAvailable }).eq('id', id).select('id').single();
  if (error) throw error;
}

export async function setFoodTodaySpecial(id: string, isTodaySpecial: boolean) {
  const { error } = await client().from('food_items').update({
    is_today_special: isTodaySpecial,
    special_price: null,
    special_discount_percent: 0,
    special_starts_at: null,
    special_ends_at: null,
  }).eq('id', id).select('id').single();
  if (error && isTodaySpecialSchemaMissing(error)) throw new Error('Apply migration 202610050003_today_special_menu.sql before using Today’s Special.');
  if (error) throw error;
}

const todaySpecialFieldNames = ['is_today_special', 'special_price', 'special_discount_percent', 'special_starts_at', 'special_ends_at'] as const;

function hasTodaySpecialSettings(input: FoodInput) {
  return input.is_today_special || input.special_price !== null || input.special_discount_percent > 0 || input.special_starts_at !== null || input.special_ends_at !== null;
}

function withoutTodaySpecialSettings(input: FoodInput): FoodInput {
  return Object.fromEntries(Object.entries(input).filter(([key]) => !todaySpecialFieldNames.includes(key as typeof todaySpecialFieldNames[number]))) as FoodInput;
}

export async function softDeleteFood(id: string) {
  const { error } = await client().from('food_items').update({ is_active: false, is_available: false }).eq('id', id).select('id').single();
  if (error) throw error;
}

export async function restoreFood(id: string) {
  const { error } = await client().from('food_items').update({ is_active: true, is_available: false }).eq('id', id).select('id').single();
  if (error) throw error;
}

