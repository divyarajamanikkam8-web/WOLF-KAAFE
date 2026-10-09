import { supabase } from '../lib/supabase';

async function verifyFavoriteOwner(userId: string) {
  if (!supabase) throw new Error('Supabase is not configured.');
  const { data, error } = await supabase.auth.getUser();
  if (error) throw error;
  if (!data.user || data.user.id !== userId) throw new Error('Please sign in again to access your favourites.');
  return supabase;
}

export async function getCustomerFavoriteIds(userId: string): Promise<string[]> {
  const client = await verifyFavoriteOwner(userId);
  const { data, error } = await client
    .from('favorites')
    .select('food_item_id')
    .eq('user_id', userId);
  if (error) throw error;
  return (data ?? []).map(favorite => favorite.food_item_id);
}

export async function setCustomerFavorite(userId: string, foodItemId: string, isFavorite: boolean) {
  const client = await verifyFavoriteOwner(userId);
  if (isFavorite) {
    const { error } = await client
      .from('favorites')
      .upsert({ user_id: userId, food_item_id: foodItemId }, { onConflict: 'user_id,food_item_id', ignoreDuplicates: true });
    if (error) throw error;
    return;
  }

  const { error } = await client
    .from('favorites')
    .delete()
    .eq('user_id', userId)
    .eq('food_item_id', foodItemId);
  if (error) throw error;
}
