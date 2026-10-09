import { supabase } from '../lib/supabase';

export type RestaurantOrderStatus = 'pending' | 'accepted' | 'preparing' | 'ready' | 'out_for_delivery' | 'delivered' | 'cancelled';
export type RestaurantPaymentStatus = 'pending' | 'paid';

export type AdminOrder = {
  id: string;
  user_id: string;
  status: RestaurantOrderStatus;
  payment_status: RestaurantPaymentStatus;
  payment_method: string;
  subtotal: number;
  delivery_fee: number;
  discount: number;
  total: number;
  created_at: string;
  address_snapshot: { full_name?: string; phone?: string; house?: string; street?: string; area?: string; city?: string; pincode?: string; landmark?: string } | null;
  order_items: { id: string; name_snapshot: string; unit_price: number; quantity: number; size: string | null; special_instructions: string | null; food: { image_url: string | null } | { image_url: string | null }[] | null; order_item_customizations: { option_name_snapshot: string; additional_price: number }[] }[];
};

export type AdminOrderUpdate = Partial<Pick<AdminOrder, 'status' | 'payment_status'>>;
export type AdminOrderCounts = Record<RestaurantOrderStatus, number>;

export async function getAdminOrders(): Promise<AdminOrder[]> {
  if (!supabase) throw new Error('Supabase is not configured.');
  const { data, error } = await supabase.from('orders')
    .select('id,user_id,status,payment_status,payment_method,subtotal,delivery_fee,discount,total,created_at,address_snapshot,order_items(id,name_snapshot,unit_price,quantity,size,special_instructions,food:food_items(image_url),order_item_customizations(option_name_snapshot,additional_price))')
    .order('created_at', { ascending: false })
    .limit(250);
  if (error) throw error;
  return (data ?? []) as AdminOrder[];
}

export async function getAdminPendingOrderCount(): Promise<number> {
  if (!supabase) throw new Error('Supabase is not configured.');
  const { count, error } = await supabase.from('orders').select('id', { count: 'exact', head: true }).eq('status', 'pending');
  if (error) throw error;
  return count ?? 0;
}

export async function getAdminOrderCounts(): Promise<AdminOrderCounts> {
  if (!supabase) throw new Error('Supabase is not configured.');
  const statuses: RestaurantOrderStatus[] = ['pending', 'accepted', 'preparing', 'ready', 'out_for_delivery', 'delivered', 'cancelled'];
  const results = await Promise.all(statuses.map(status => supabase!.from('orders').select('id', { count: 'exact', head: true }).eq('status', status)));
  const failed = results.find(result => result.error);
  if (failed?.error) throw failed.error;
  return Object.fromEntries(statuses.map((status, index) => [status, results[index].count ?? 0])) as AdminOrderCounts;
}

export async function updateAdminOrder(id: string, update: AdminOrderUpdate) {
  if (!supabase) throw new Error('Supabase is not configured.');
  const { error } = await supabase.from('orders').update(update).eq('id', id).select('id').single();
  if (error) throw error;
}
