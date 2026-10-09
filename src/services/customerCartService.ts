import { supabase } from '../lib/supabase';
import { getMenu } from './menuService';
import type { CartLine } from '../types';

function requireClient() {
  if (!supabase) throw new Error('Supabase is not configured.');
  return supabase;
}

async function verifyUser(userId: string) {
  const client = requireClient();
  const { data, error } = await client.auth.getUser();
  if (error) throw error;
  if (!data.user || data.user.id !== userId) throw new Error('Your session changed. Sign in again to access this cart.');
  return client;
}

export function makeCartLineKey(line: Pick<CartLine, 'food' | 'size' | 'extras' | 'note' | 'offerId'>) {
  return `${line.food.id}-${line.size}-${line.extras.slice().sort().join('-')}-${line.note?.trim() ?? ''}-${line.offerId ?? 'menu'}`;
}

export async function getCustomerCart(userId: string): Promise<CartLine[]> {
  const client = await verifyUser(userId);
  const [{ data: rows, error }, foods] = await Promise.all([
    client.from('cart_items').select('food_item_id,quantity,size,customizations,special_instructions,offer_id,offer_discount_percentage').eq('user_id', userId),
    getMenu(),
  ]);
  if (error) throw error;
  const foodById = new Map(foods.map(food => [food.id, food]));
  return (rows ?? []).flatMap(row => {
    const food = foodById.get(row.food_item_id);
    if (!food) return [];
    const extras = Array.isArray(row.customizations) ? row.customizations.filter((value): value is string => typeof value === 'string') : [];
    const line = {
      food,
      quantity: Number(row.quantity),
      size: row.size === 'Large' ? 'Large' as const : 'Regular' as const,
      extras,
      note: row.special_instructions || undefined,
      offerId: row.offer_id || undefined,
      offerDiscountPercent: row.offer_id ? Number(row.offer_discount_percentage ?? 0) : undefined,
    };
    return [{ ...line, key: makeCartLineKey(line) }];
  });
}

export async function saveCustomerCart(userId: string, cart: CartLine[]) {
  const client = await verifyUser(userId);
  const items = cart.map(line => ({
    food_item_id: line.food.id,
    quantity: line.quantity,
    size: line.size,
    customizations: line.extras,
    special_instructions: line.note ?? null,
    offer_id: line.offerId ?? null,
    offer_discount_percentage: line.offerDiscountPercent ?? 0,
  }));
  const { error } = await client.rpc('save_customer_cart', { p_items: items });
  if (error) throw error;
}
