import { supabase } from '../lib/supabase';

export type DeliveryAddressInput = {
  full_name: string; phone: string; house: string; street: string;
  area: string; city: string; pincode: string; landmark?: string;
};
export type OrderItemInput = {
  food_item_id: string; client_price: number; quantity: number; size: 'Regular' | 'Large';
  extras: string[]; note?: string; offer_id?: string | null;
};
export type CreatedOrder = {
  id: string; total: number; subtotal: number; delivery_fee: number;
  address: DeliveryAddressInput;
};
export type OrderReview = { food_item_id: string | null; food_rating: number; comment: string; created_at?: string };
export type CustomerOrderItem = {
  id: string;
  food_item_id: string | null;
  name_snapshot: string;
  quantity: number;
  unit_price: number;
  offer_id?: string | null;
  original_unit_price?: number | string | null;
  discount_percentage?: number | string | null;
  size: string | null;
  food: { image_url: string | null } | null;
};
export type CustomerOrder = {
  id: string;
  status: string;
  payment_status: string;
  subtotal: number | string;
  delivery_fee: number | string;
  total: number | string;
  created_at: string;
  address_snapshot: Record<string, unknown>;
  order_items: CustomerOrderItem[];
  reviews: OrderReview[];
};

export async function createCodOrder(address: DeliveryAddressInput, items: OrderItemInput[], expectedDeliveryFee: number) {
  if (!supabase) throw new Error('Supabase is not configured. Add the public project URL and anon key first.');
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError) throw authError;
  if (!user) throw new Error('Please sign in before placing an order.');
  const { data, error } = await supabase.rpc('place_cod_order', {
    p_address: address,
    p_items: items,
    p_expected_delivery_fee: expectedDeliveryFee,
  });
  if (error) throw error;
  return data as CreatedOrder;
}

export async function getMyOrders(userId: string): Promise<CustomerOrder[]> {
  if (!supabase) return [];
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError) throw authError;
  if (!authData.user || authData.user.id !== userId) throw new Error('Please sign in again to view your orders.');
  const { data, error } = await supabase.from('orders')
    .select('id,status,payment_status,subtotal,delivery_fee,total,created_at,address_snapshot,order_items(id,food_item_id,name_snapshot,quantity,unit_price,size,offer_id,original_unit_price,discount_percentage,food:food_items(image_url))')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  const orders = (data ?? []) as unknown as Omit<CustomerOrder, 'reviews'>[];
  if (!orders.length) return [];

  const { data: reviews, error: reviewsError } = await supabase.rpc('get_customer_order_food_reviews', {
    p_order_ids: orders.map(order => order.id),
  });
  if (reviewsError) throw reviewsError;

  const reviewsByOrder = new Map<string, OrderReview[]>();
  for (const review of reviews ?? []) {
    const orderReviews = reviewsByOrder.get(review.order_id) ?? [];
    orderReviews.push({
      food_item_id: review.food_item_id,
      food_rating: review.food_rating,
      comment: review.comment,
      created_at: review.created_at,
    });
    reviewsByOrder.set(review.order_id, orderReviews);
  }

  return orders.map(order => ({ ...order, reviews: reviewsByOrder.get(order.id) ?? [] }));
}

export function subscribeToOrder(orderId: string, onUpdate: (row: unknown) => void) {
  if (!supabase) return () => {};
  const channel = supabase.channel(`order-${orderId}`)
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'orders', filter: `id=eq.${orderId}` }, payload => onUpdate(payload.new))
    .subscribe();
  return () => { void supabase!.removeChannel(channel); };
}
