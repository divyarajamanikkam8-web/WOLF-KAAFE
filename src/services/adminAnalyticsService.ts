import { format } from 'date-fns';
import { supabase } from '../lib/supabase';
import type { RestaurantOrderStatus } from './adminOrderService';

export type AnalyticsPoint = { date: string; label: string; revenue: number; orders: number };
export type AdminAnalyticsData = {
  days: number;
  totalOrders: number;
  revenue: number;
  averageOrderValue: number;
  deliveredOrders: number;
  cancelledOrders: number;
  statusCounts: Record<RestaurantOrderStatus, number>;
  daily: AnalyticsPoint[];
  popularFoods: { name: string; quantity: number; revenue: number }[];
};

type AnalyticsOrder = {
  id: string;
  status: RestaurantOrderStatus;
  total: number;
  created_at: string;
  order_items: { name_snapshot: string; quantity: number; unit_price: number }[];
};

const orderStatuses: RestaurantOrderStatus[] = ['pending', 'accepted', 'preparing', 'ready', 'out_for_delivery', 'delivered', 'cancelled'];
const pageSize = 500;

function dayKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export async function getAdminAnalytics(days: number): Promise<AdminAnalyticsData> {
  if (!supabase) throw new Error('Supabase is not configured.');
  const rangeDays = [7, 30, 90].includes(days) ? days : 7;
  const end = new Date();
  const start = new Date(end);
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - (rangeDays - 1));

  const orders: AnalyticsOrder[] = [];
  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await supabase.from('orders')
      .select('id,status,total,created_at,order_items(name_snapshot,quantity,unit_price)')
      .gte('created_at', start.toISOString())
      .lte('created_at', end.toISOString())
      .order('created_at', { ascending: true })
      .range(offset, offset + pageSize - 1);
    if (error) throw error;
    const page = (data ?? []) as AnalyticsOrder[];
    orders.push(...page);
    if (page.length < pageSize) break;
  }

  const statusCounts = Object.fromEntries(orderStatuses.map(status => [status, 0])) as Record<RestaurantOrderStatus, number>;
  const dailyByKey = new Map<string, AnalyticsPoint>();
  for (let offset = 0; offset < rangeDays; offset += 1) {
    const date = new Date(start);
    date.setDate(start.getDate() + offset);
    const key = dayKey(date);
    dailyByKey.set(key, { date: key, label: format(date, rangeDays > 30 ? 'MMM d' : 'EEE d'), revenue: 0, orders: 0 });
  }

  const foodTotals = new Map<string, { quantity: number; revenue: number }>();
  let revenue = 0;
  let deliveredOrders = 0;
  let cancelledOrders = 0;
  for (const order of orders) {
    statusCounts[order.status] += 1;
    if (order.status === 'delivered') deliveredOrders += 1;
    if (order.status === 'cancelled') { cancelledOrders += 1; continue; }
    const total = Number(order.total);
    revenue += total;
    const dateKey = dayKey(new Date(order.created_at));
    const daily = dailyByKey.get(dateKey);
    if (daily) { daily.revenue += total; daily.orders += 1; }
    for (const item of order.order_items ?? []) {
      const quantity = Number(item.quantity);
      const itemRevenue = Number(item.unit_price) * quantity;
      const current = foodTotals.get(item.name_snapshot) ?? { quantity: 0, revenue: 0 };
      current.quantity += quantity;
      current.revenue += itemRevenue;
      foodTotals.set(item.name_snapshot, current);
    }
  }
  const countForAverage = orders.length - cancelledOrders;

  return {
    days: rangeDays,
    totalOrders: orders.length,
    revenue,
    averageOrderValue: countForAverage ? revenue / countForAverage : 0,
    deliveredOrders,
    cancelledOrders,
    statusCounts,
    daily: [...dailyByKey.values()],
    popularFoods: [...foodTotals].map(([name, values]) => ({ name, ...values })).sort((a, b) => b.quantity - a.quantity).slice(0, 8),
  };
}
