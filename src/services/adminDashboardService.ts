import { supabase } from '../lib/supabase';

export type DashboardOrder = {
  id: string;
  total: number;
  status: string;
  created_at: string;
  address_snapshot: { full_name?: string } | null;
};

export type DashboardData = {
  todayOrders: number;
  todayRevenue: number;
  customers: number;
  restaurantOpen: boolean | null;
  outOfStock: number;
  recentOrders: DashboardOrder[];
  statuses: Record<string, number>;
  revenueByDay: { date: string; label: string; revenue: number }[];
  hasRevenueData: boolean;
  popularFoods: { name: string; orders: number }[];
};

const trackedStatuses = ['pending', 'accepted', 'preparing', 'ready', 'out_for_delivery', 'delivered', 'cancelled'] as const;

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export async function getAdminDashboardData(): Promise<DashboardData> {
  if (!supabase) throw new Error('Supabase is not configured.');

  const today = startOfDay(new Date());
  const firstDay = new Date(today);
  firstDay.setDate(firstDay.getDate() - 6);
  const [recentResult, weekResult, customerResult, settingsResult, stockResult, popularResult, ...statusResults] = await Promise.all([
    supabase.from('orders').select('id,total,status,created_at,address_snapshot').order('created_at', { ascending: false }).limit(8),
    supabase.from('orders').select('total,status,created_at').gte('created_at', firstDay.toISOString()).order('created_at', { ascending: true }).limit(1000),
    supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'customer'),
    supabase.from('restaurant_settings').select('is_open').eq('id', 1).maybeSingle(),
    supabase.from('food_items').select('id', { count: 'exact', head: true }).eq('is_active', true).eq('is_available', false),
    supabase.from('order_items').select('name_snapshot,quantity').limit(1000),
    ...trackedStatuses.map(status => supabase!.from('orders').select('id', { count: 'exact', head: true }).eq('status', status)),
  ]);

  const firstError = [recentResult, weekResult, customerResult, settingsResult, stockResult, popularResult, ...statusResults].find(result => result.error)?.error;
  if (firstError) throw firstError;

  const weeklyOrders = weekResult.data ?? [];
  const todayKey = today.toLocaleDateString('en-CA');
  const todayOrders = weeklyOrders.filter(order => new Date(order.created_at).toLocaleDateString('en-CA') === todayKey);
  const todayRevenue = todayOrders.reduce((sum, order) => order.status === 'cancelled' ? sum : sum + Number(order.total), 0);
  const revenueByDay = Array.from({ length: 7 }, (_, offset) => {
    const date = new Date(firstDay);
    date.setDate(firstDay.getDate() + offset);
    const key = date.toLocaleDateString('en-CA');
    const revenue = weeklyOrders.reduce((sum, order) => {
      if (order.status === 'cancelled' || new Date(order.created_at).toLocaleDateString('en-CA') !== key) return sum;
      return sum + Number(order.total);
    }, 0);
    return { date: key, label: new Intl.DateTimeFormat('en-IN', { weekday: 'short' }).format(date), revenue };
  });

  const popularCounts = new Map<string, number>();
  for (const item of popularResult.data ?? []) {
    popularCounts.set(item.name_snapshot, (popularCounts.get(item.name_snapshot) ?? 0) + Number(item.quantity));
  }
  const statuses = Object.fromEntries(trackedStatuses.map((status, index) => [status, statusResults[index].count ?? 0]));

  return {
    todayOrders: todayOrders.length,
    todayRevenue,
    customers: customerResult.count ?? 0,
    restaurantOpen: settingsResult.data?.is_open ?? null,
    outOfStock: stockResult.count ?? 0,
    recentOrders: (recentResult.data ?? []) as DashboardOrder[],
    statuses,
    revenueByDay,
    hasRevenueData: weeklyOrders.some(order => order.status !== 'cancelled'),
    popularFoods: [...popularCounts].map(([name, orders]) => ({ name, orders })).sort((a, b) => b.orders - a.orders).slice(0, 5),
  };
}
