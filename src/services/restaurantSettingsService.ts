import { supabase } from '../lib/supabase';

export type RestaurantSettings = {
  restaurant_name: string;
  logo_url: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  opening_time: string | null;
  closing_time: string | null;
  is_open: boolean;
  delivery_fee: number;
  free_delivery_threshold: number;
  minimum_order: number;
  estimated_delivery_minutes: number;
  cash_on_delivery_enabled: boolean;
};

export type AdminRestaurantSettings = RestaurantSettings & {
  id: 1;
  delivery_radius_km: number;
  notify_new_orders_enabled: boolean;
};

function requireClient() {
  if (!supabase) throw new Error('Supabase is not configured.');
  return supabase;
}

async function requireAdmin() {
  const client = requireClient();
  const { data: { user }, error: authError } = await client.auth.getUser();
  if (authError) throw authError;
  if (!user) throw new Error('Sign in with an admin account to manage restaurant settings.');
  const { data, error } = await client.from('profiles').select('role').eq('id', user.id).single();
  if (error) throw error;
  if (data.role !== 'admin') throw new Error('Admin access is required to manage restaurant settings.');
  return client;
}

export async function getCustomerRestaurantSettings(): Promise<RestaurantSettings> {
  const client = requireClient();
  const { data, error } = await client.from('customer_restaurant_settings').select('*').maybeSingle();
  if (error) throw error;
  if (!data) throw new Error('Restaurant settings are unavailable.');
  return data as RestaurantSettings;
}

export async function getAdminRestaurantSettings(): Promise<AdminRestaurantSettings> {
  const client = await requireAdmin();
  const { data, error } = await client.from('restaurant_settings').select('*').eq('id', 1).single();
  if (error) throw error;
  return data as AdminRestaurantSettings;
}

export async function saveAdminRestaurantSettings(settings: Omit<AdminRestaurantSettings, 'id' | 'logo_url'>) {
  const client = await requireAdmin();
  const { data, error } = await client.from('restaurant_settings')
    .update(settings)
    .eq('id', 1)
    .select('*')
    .single();
  if (error) throw error;
  return data as AdminRestaurantSettings;
}

export async function uploadRestaurantLogo(file: File) {
  const client = await requireAdmin();
  if (!file.type.startsWith('image/')) throw new Error('Choose an image file for the restaurant logo.');
  if (file.size > 5 * 1024 * 1024) throw new Error('The logo image must be 5 MB or smaller.');
  const extension = file.name.split('.').pop()?.toLowerCase().replace(/[^a-z0-9]/g, '') || 'png';
  const path = `restaurant/logo-${Date.now()}.${extension}`;
  const { error } = await client.storage.from('restaurant-assets').upload(path, file, { upsert: false, contentType: file.type });
  if (error) throw error;
  const { data } = client.storage.from('restaurant-assets').getPublicUrl(path);
  const { data: saved, error: saveError } = await client.from('restaurant_settings')
    .update({ logo_url: data.publicUrl })
    .eq('id', 1)
    .select('*')
    .single();
  if (saveError) throw saveError;
  return saved as AdminRestaurantSettings;
}
