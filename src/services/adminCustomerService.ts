import { supabase } from '../lib/supabase';

const PAGE_SIZE = 1000;

export type AdminCustomer = {
  id: string;
  full_name: string;
  email_id: string | null;
  phone: string | null;
  created_at: string;
  order_count: number;
  total_spend: number;
  last_order_at: string | null;
};

export type CustomerMonth = {
  key: string;
  label: string;
  new_customers: number;
  ordering_customers: number;
};

export type AdminCustomerData = {
  customers: AdminCustomer[];
  total_customers: number;
  ordering_customers: number;
  repeat_customers: number;
  active_customers_30d: number;
  completed_order_count: number;
  customer_revenue: number;
  average_order_value: number;
  monthly_activity: CustomerMonth[];
};

type ProfileRow = Pick<AdminCustomer, 'id' | 'full_name' | 'email_id' | 'phone' | 'created_at'>;
type OrderRow = { user_id: string; total: number | string; status: string; created_at: string };

async function getAllCustomerProfiles(client: NonNullable<typeof supabase>) {
  const rows: ProfileRow[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await client
      .from('profiles')
      .select('id,full_name,email_id,phone,created_at')
      .eq('role', 'customer')
      .order('created_at', { ascending: false })
      .range(from, from + PAGE_SIZE - 1);
    if (error) throw error;
    const page = (data ?? []) as ProfileRow[];
    rows.push(...page);
    if (page.length < PAGE_SIZE) return rows;
  }
}

async function getAllCustomerOrders(client: NonNullable<typeof supabase>) {
  const rows: OrderRow[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await client
      .from('orders')
      .select('user_id,total,status,created_at')
      .order('created_at', { ascending: false })
      .range(from, from + PAGE_SIZE - 1);
    if (error) throw error;
    const page = (data ?? []) as OrderRow[];
    rows.push(...page);
    if (page.length < PAGE_SIZE) return rows;
  }
}

function getMonthKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

export async function getAdminCustomerData(): Promise<AdminCustomerData> {
  if (!supabase) throw new Error('Supabase is not configured.');
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError) throw authError;
  if (!authData.user) throw new Error('Sign in with an admin account to view customer insights.');
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', authData.user.id)
    .single();
  if (profileError) throw profileError;
  if (profile.role !== 'admin') throw new Error('Admin access is required to view customer insights.');

  const [profiles, orders] = await Promise.all([
    getAllCustomerProfiles(supabase),
    getAllCustomerOrders(supabase),
  ]);

  const ordersByCustomer = new Map<string, OrderRow[]>();
  const customerIds = new Set(profiles.map(profile => profile.id));
  for (const order of orders) {
    if (!customerIds.has(order.user_id) || order.status === 'cancelled') continue;
    const customerOrders = ordersByCustomer.get(order.user_id) ?? [];
    customerOrders.push(order);
    ordersByCustomer.set(order.user_id, customerOrders);
  }

  const customers = profiles.map(profile => {
    const allOrders = ordersByCustomer.get(profile.id) ?? [];
    const eligibleOrders = allOrders;
    const totalSpend = eligibleOrders.reduce((sum, order) => sum + Number(order.total || 0), 0);
    const lastOrderAt = eligibleOrders[0]?.created_at ?? null;
    return {
      ...profile,
      order_count: eligibleOrders.length,
      total_spend: totalSpend,
      last_order_at: lastOrderAt,
    };
  });

  const now = new Date();
  const activeSince = new Date(now);
  activeSince.setDate(activeSince.getDate() - 30);
  const activeCustomerIds = new Set<string>();
  const customersByMonth = new Map<string, number>();
  const orderingCustomersByMonth = new Map<string, Set<string>>();
  const monthStarts = Array.from({ length: 6 }, (_, index) => new Date(now.getFullYear(), now.getMonth() - 5 + index, 1));
  const visibleMonthKeys = new Set(monthStarts.map(getMonthKey));

  for (const customer of customers) {
    const month = getMonthKey(new Date(customer.created_at));
    if (visibleMonthKeys.has(month)) customersByMonth.set(month, (customersByMonth.get(month) ?? 0) + 1);
  }

  for (const order of orders) {
    if (order.status === 'cancelled' || !customerIds.has(order.user_id)) continue;
    const orderDate = new Date(order.created_at);
    if (orderDate >= activeSince && orderDate <= now) activeCustomerIds.add(order.user_id);
    const month = getMonthKey(orderDate);
    if (visibleMonthKeys.has(month)) {
      const ids = orderingCustomersByMonth.get(month) ?? new Set<string>();
      ids.add(order.user_id);
      orderingCustomersByMonth.set(month, ids);
    }
  }

  const eligibleOrders = orders.filter(order => order.status !== 'cancelled');
  const customerRevenue = eligibleOrders.reduce((sum, order) => {
    const total = Number(order.total);
    return sum + (Number.isFinite(total) && total > 0 ? total : 0);
  }, 0);
  const orderingCustomerCount = customers.filter(customer => customer.order_count > 0).length;
  const repeatCustomerCount = customers.filter(customer => customer.order_count > 1).length;

  return {
    customers,
    total_customers: customers.length,
    ordering_customers: orderingCustomerCount,
    repeat_customers: repeatCustomerCount,
    active_customers_30d: activeCustomerIds.size,
    completed_order_count: eligibleOrders.length,
    customer_revenue: customerRevenue,
    average_order_value: eligibleOrders.length ? customerRevenue / eligibleOrders.length : 0,
    monthly_activity: monthStarts.map(date => {
      const key = getMonthKey(date);
      return {
        key,
        label: new Intl.DateTimeFormat('en-IN', { month: 'short' }).format(date),
        new_customers: customersByMonth.get(key) ?? 0,
        ordering_customers: orderingCustomersByMonth.get(key)?.size ?? 0,
      };
    }),
  };
}
