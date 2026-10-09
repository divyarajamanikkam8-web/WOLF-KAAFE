import { supabase } from '../lib/supabase';

export type CustomerProfile = {
  id: string;
  full_name: string;
  phone: string | null;
  role: 'customer' | 'admin';
  email: string;
};

export type CustomerProfileUpdate = {
  full_name: string;
  phone: string;
};

export async function getCustomerProfile(userId: string): Promise<CustomerProfile> {
  if (!supabase) throw new Error('Profile service is unavailable. Supabase is not configured.');

  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError) throw authError;
  if (!authData.user || authData.user.id !== userId) throw new Error('Please sign in again to view your profile.');

  const { data, error } = await supabase
    .from('profiles')
    .select('id,full_name,phone,role')
    .eq('id', userId)
    .maybeSingle();

  if (error) throw error;
  if (!data) throw new Error('Your profile could not be found. Please contact support.');

  return { ...data, role: data.role === 'admin' ? 'admin' : 'customer', email: authData.user.email ?? '' };
}

export async function updateCustomerProfile(userId: string, changes: CustomerProfileUpdate): Promise<CustomerProfile> {
  if (!supabase) throw new Error('Profile service is unavailable. Supabase is not configured.');

  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError) throw authError;
  if (!authData.user || authData.user.id !== userId) throw new Error('Your session expired. Please sign in again.');

  const { error } = await supabase
    .from('profiles')
    .update({ full_name: changes.full_name.trim(), phone: changes.phone.trim() })
    .eq('id', userId);

  if (error) throw error;
  return getCustomerProfile(userId);
}
