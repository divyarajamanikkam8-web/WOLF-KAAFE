import { Suspense, lazy, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Activity, CircleAlert, IndianRupee, PackageCheck, ShoppingBag, TrendingUp, Users } from 'lucide-react';
import { getAdminAnalytics } from '../../services/adminAnalyticsService';
import { supabase } from '../../lib/supabase';

const RevenueChart = lazy(() => import('./RevenueChart'));
const ranges = [7, 30, 90] as const;
const labels: Record<string, string> = { pending: 'Pending', accepted: 'Accepted', preparing: 'Preparing', ready: 'Ready', out_for_delivery: 'Out for delivery', delivered: 'Delivered', cancelled: 'Cancelled' };

export function AdminAnalyticsPage() {
  const [days, setDays] = useState<number>(7);
  const analytics = useQuery({ queryKey: ['admin-analytics', days], queryFn: () => getAdminAnalytics(days), enabled: Boolean(supabase), staleTime: 30_000 });
  if (!supabase) return <AnalyticsState title="Supabase is not connected" message="Add the public Supabase URL and anon key to load restaurant analytics."/>;
  if (analytics.isLoading) return <div className="mx-auto max-w-[1440px] animate-pulse space-y-5"><div className="h-20 rounded-2xl bg-white"/><div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{ranges.map(day => <div key={day} className="h-28 rounded-2xl bg-white"/> )}</div><div className="h-80 rounded-2xl bg-white"/></div>;
  if (analytics.isError || !analytics.data) return <AnalyticsState title="Analytics could not be loaded" message="Check Owner/Admin permissions and the Supabase order tables, then retry." action={() => void analytics.refetch()}/>;

  const data = analytics.data;
  const maxFoodQuantity = Math.max(1, ...data.popularFoods.map(food => food.quantity));
  const cards = [
    { title: 'Revenue', value: `₹${data.revenue.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`, detail: `Last ${days} days · excludes cancelled`, Icon: IndianRupee },
    { title: 'Orders', value: data.totalOrders.toLocaleString('en-IN'), detail: `${data.deliveredOrders} delivered`, Icon: ShoppingBag },
    { title: 'Average order value', value: `₹${Math.round(data.averageOrderValue).toLocaleString('en-IN')}`, detail: 'Cancelled orders excluded', Icon: TrendingUp },
    { title: 'Cancelled orders', value: data.cancelledOrders.toLocaleString('en-IN'), detail: 'In selected date range', Icon: CircleAlert },
  ];

  return <div className="mx-auto max-w-[1440px] space-y-5">
    <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><p className="text-xs font-extrabold uppercase tracking-[.18em] text-brand-burnt">Restaurant performance</p><h1 className="mt-2 text-2xl font-black sm:text-3xl">Analytics</h1><p className="mt-1 text-sm text-stone-500">Order and sales data from Supabase updates as orders change.</p></div><label className="text-xs font-bold text-stone-500">Date range<select value={days} onChange={event => setDays(Number(event.target.value))} className="ml-2 min-h-10 rounded-xl border border-stone-200 bg-white px-3 text-sm font-bold text-stone-800">{ranges.map(range => <option key={range} value={range}>Last {range} days</option>)}</select></label></header>

    <section className="grid grid-cols-2 gap-3 xl:grid-cols-4">{cards.map(({ title, value, detail, Icon }) => <article key={title} className="min-w-0 rounded-2xl border border-stone-200 bg-white p-4 shadow-sm sm:p-5"><div className="flex items-start justify-between gap-2"><p className="text-xs font-bold text-stone-500 sm:text-sm">{title}</p><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-pale text-brand-burnt"><Icon size={18}/></span></div><b className="mt-2 block truncate text-2xl font-black tracking-tight sm:text-3xl">{value}</b><p className="mt-1 text-[11px] text-stone-500 sm:text-xs">{detail}</p></article>)}</section>

    <section className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm sm:p-5"><div className="flex items-start justify-between gap-3"><div><h2 className="text-base font-extrabold">Sales trend</h2><p className="mt-1 text-xs text-stone-500">Daily sales, excluding cancelled orders.</p></div><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-pale text-brand-burnt"><Activity size={18}/></span></div>{data.revenue > 0 ? <div className="mt-4 h-64 min-w-0 sm:h-80"><Suspense fallback={<div className="h-full animate-pulse rounded-xl bg-stone-50"/>}><RevenueChart data={data.daily}/></Suspense></div> : <div className="mt-4 flex h-64 flex-col items-center justify-center rounded-xl bg-stone-50 text-center"><Activity size={24} className="text-stone-400"/><p className="mt-2 text-sm font-bold">No sales in this period</p><p className="mt-1 text-xs text-stone-500">Sales will appear after customers place orders.</p></div>}</section>

    <section className="grid gap-4 xl:grid-cols-2">
      <div className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm sm:p-5"><div className="flex items-center gap-2"><PackageCheck size={18} className="text-brand-burnt"/><h2 className="text-base font-extrabold">Order status</h2></div><p className="mt-1 text-xs text-stone-500">Order count for the selected period.</p><div className="mt-3 divide-y divide-stone-100">{Object.entries(labels).map(([status, label]) => <div key={status} className="flex items-center justify-between py-2.5 text-sm"><span className="font-medium text-stone-700">{label}</span><b className="tabular-nums">{data.statusCounts[status as keyof typeof data.statusCounts]}</b></div>)}</div></div>
      <div className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm sm:p-5"><div className="flex items-center gap-2"><Users size={18} className="text-brand-burnt"/><h2 className="text-base font-extrabold">Popular foods</h2></div><p className="mt-1 text-xs text-stone-500">Items ordered in the selected period.</p>{data.popularFoods.length ? <ol className="mt-3 divide-y divide-stone-100">{data.popularFoods.map((food, index) => <li key={food.name} className="py-3"><div className="flex items-center justify-between gap-3 text-sm"><span className="min-w-0 truncate font-semibold">{index + 1}. {food.name}</span><b className="shrink-0">{food.quantity} sold</b></div><div className="mt-2 h-2 overflow-hidden rounded-full bg-stone-100"><div className="h-full rounded-full bg-brand-orange" style={{ width: `${Math.max(6, food.quantity / maxFoodQuantity * 100)}%` }}/></div><p className="mt-1 text-right text-[11px] text-stone-500">₹{food.revenue.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</p></li>)}</ol> : <div className="mt-4 rounded-xl bg-stone-50 px-4 py-8 text-center"><p className="text-sm font-bold">No food orders yet</p><p className="mt-1 text-xs text-stone-500">Ordered dishes will appear here.</p></div>}</div>
    </section>
  </div>;
}

function AnalyticsState({ title, message, action }: { title: string; message: string; action?: () => void }) {
  return <div role={action ? 'alert' : undefined} className="mx-auto max-w-2xl rounded-2xl border border-stone-200 bg-white p-6 text-center shadow-sm"><span className="mx-auto flex h-11 w-11 items-center justify-center rounded-xl bg-brand-pale text-brand-burnt"><Activity size={20}/></span><h1 className="mt-3 font-extrabold">{title}</h1><p className="mt-1 text-sm text-stone-500">{message}</p>{action && <button type="button" onClick={action} className="mt-4 rounded-lg bg-brand-orange px-4 py-2.5 text-sm font-bold text-white">Retry</button>}</div>;
}
