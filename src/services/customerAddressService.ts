import { supabase } from '../lib/supabase';
import type { DeliveryAddressInput } from './orderService';

export type SavedCustomerAddress = Omit<DeliveryAddressInput, 'landmark'> & {
  id: string;
  user_id: string;
  landmark: string | null;
  is_default: boolean;
  created_at: string;
};

const addressFields = 'id,user_id,full_name,phone,house,street,area,city,pincode,landmark,is_default,created_at';

async function verifyCurrentUser(userId: string) {
  const client = supabase;
  if (!client) throw new Error('Address service is unavailable because Supabase is not configured.');
  const { data, error } = await client.auth.getUser();
  if (error) throw error;
  if (!data.user || data.user.id !== userId) throw new Error('Please sign in again to manage your saved address.');
  return client;
}

export async function getCustomerDefaultAddress(userId: string): Promise<SavedCustomerAddress | null> {
  const client = await verifyCurrentUser(userId);
  const { data, error } = await client.from('addresses')
    .select(addressFields)
    .eq('user_id', userId)
    .eq('is_default', true)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data as SavedCustomerAddress | null;
}

export async function saveCustomerDefaultAddress(userId: string, address: DeliveryAddressInput): Promise<SavedCustomerAddress> {
  const client = await verifyCurrentUser(userId);
  const payload = {
    full_name: address.full_name.trim(),
    phone: address.phone.trim(),
    house: address.house.trim(),
    street: address.street.trim(),
    area: address.area.trim(),
    city: address.city.trim(),
    pincode: address.pincode.trim(),
    landmark: address.landmark?.trim() || null,
    is_default: true,
  };
  const { data: current, error: readError } = await client.from('addresses')
    .select('id')
    .eq('user_id', userId)
    .eq('is_default', true)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (readError) throw readError;

  const result = current
    ? await client.from('addresses').update(payload).eq('id', current.id).eq('user_id', userId).select(addressFields).single()
    : await client.from('addresses').insert({ user_id: userId, ...payload }).select(addressFields).single();
  if (result.error) throw result.error;
  return result.data as SavedCustomerAddress;
}
