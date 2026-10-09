import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { Activity, CalendarDays, CircleAlert, RefreshCw, Repeat2, Search, ShoppingBag, Users, Wallet } from 'lucide-react';
import { getAdminCustomerData, type AdminCustomer } from '../../services/adminCustomerService';
import { supabase } from '../../lib/supabase';

type RealtimeStatus = 'connecting' | 'connected' | 'disconnected';
type CustomerFilter = 'all' | 'ordered' | 'repeat' | 'no-orders';

const formatPrice = (amount: number) => `₹${amount.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;

export function AdminCustomersPage({ realtimeStatus }: { realtimeStatus: RealtimeStatus }) {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<CustomerFilter>('all');
  const [visibleCount, setVisibleCount] = useState(50);
  const customersQuery = useQuery({
    queryKey: ['admin-customers'],
    queryFn: getAdminCustomerData,
    enabled: Boolean(supabase),
    staleTime: 15_000,
  });

  const data = customersQuery.data;
  const filteredCustomers = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    return (data?.customers ?? []).filter(customer => {
      if (filter === 'ordered' && customer.order_count === 0) return false;
      if (filter === 'repeat' && customer.order_count < 2) return false;
      if (filter === 'no-orders' && customer.order_count > 0) return false;
      if (!query) return true;
      return [customer.full_name, customer.email_id, customer.phone]
        .some(value => value?.toLocaleLowerCase().includes(query));
    });
  }, [data?.customers, filter, search]);

  const maxMonthlyValue = Math.max(1, ...(data?.monthly_activity ?? []).flatMap(month => [month.new_customers, month.ordering_customers]));
  const repeatRate = data?.ordering_customers ? Math.round(data.repeat_customers / data.ordering_customers * 100) : 0;

  if (!supabase) return <PageState title="Supabase is not connected" message="Add the public Supabase URL and anon key to load customer data."/>;

  return <div className="mx-auto max-w-[1440px] space-y-5">
    <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
      <div><p className="text-xs font-extrabold uppercase tracking-[.18em] text-brand-burnt">Customer insights</p><h1 className="mt-2 text-2xl font-black sm:text-3xl">Customers</h1><p className="mt-1 text-sm text-stone-500">Customer activity, repeat orders, and sales from live Supabase data.</p></div>
      <div className="flex flex-wrap items-center gap-2">
        <span className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-stone-200 bg-white px-3 text-xs font-bold text-stone-600" aria-live="polite"><span className={`h-2 w-2 rounded-full ${realtimeStatus === 'connected' ? 'bg-green-500' : realtimeStatus === 'connecting' ? 'animate-pulse bg-amber-400' : 'bg-red-400'}`}/>{realtimeStatus === 'connected' ? 'Live Updates' : realtimeStatus === 'connecting' ? 'Connecting…' : 'Updates offline'}</span>
        <button type="button" onClick={() => void customersQuery.refetch()} disabled={customersQuery.isFetching} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-stone-200 bg-white px-3 text-sm font-bold text-stone-700 disabled:opacity-50"><RefreshCw size={15} className={customersQuery.isFetching ? 'animate-spin' : ''}/>Refresh</button>
      </div>
    </header>

    {customersQuery.isLoading ? <CustomerLoading/> : customersQuery.isError || !data ? <PageState title="Unable to load customer analysis" message="Check the signed-in Owner/Admin account's Supabase permissions and connection, then retry." action={() => void customersQuery.refetch()}/> : <>
      <section aria-label="Customer statistics" className="grid grid-cols-2 gap-3 xl:grid-cols-4 xl:gap-4">
        <MetricCard label="Registered customers" value={data.total_customers.toLocaleString('en-IN')} note="Customer profiles" Icon={Users}/>
        <MetricCard label="Customers who ordered" value={data.ordering_customers.toLocaleString('en-IN')} note={`${data.active_customers_30d.toLocaleString('en-IN')} ordered in the last 30 days`} Icon={ShoppingBag}/>
        <MetricCard label="Repeat customers" value={data.repeat_customers.toLocaleString('en-IN')} note={`${repeatRate}% of customers with an order`} Icon={Repeat2}/>
        <MetricCard label="Sales from orders" value={formatPrice(data.customer_revenue)} note={`${data.completed_order_count.toLocaleString('en-IN')} non-cancelled orders`} Icon={Wallet}/>
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.4fr_.6fr]">
        <div className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm sm:p-5">
          <div className="flex items-start justify-between gap-3"><div><h2 className="text-base font-extrabold">Customer activity</h2><p className="mt-1 text-xs text-stone-500">New profiles and customers placing orders over the last six months.</p></div><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-pale text-brand-burnt"><Activity size={18}/></span></div>
          <div className="mt-5 flex min-h-48 items-end justify-between gap-2 border-b border-stone-100 px-1 sm:gap-4">
            {data.monthly_activity.map(month => <div key={month.key} className="flex h-44 min-w-0 flex-1 flex-col items-center justify-end gap-2">
              <div className="flex h-36 w-full max-w-14 items-end justify-center gap-1" aria-label={`${month.label}: ${month.new_customers} new customers and ${month.ordering_customers} ordering customers`}>
                <div title={`${month.new_customers} new customers`} className="w-1/2 rounded-t-md bg-brand-orange" style={{ height: `${Math.max(month.new_customers ? 8 : 0, month.new_customers / maxMonthlyValue * 100)}%` }}/>
                <div title={`${month.ordering_customers} ordering customers`} className="w-1/2 rounded-t-md bg-stone-300" style={{ height: `${Math.max(month.ordering_customers ? 8 : 0, month.ordering_customers / maxMonthlyValue * 100)}%` }}/>
              </div><span className="pb-2 text-[11px] font-semibold text-stone-500">{month.label}</span>
            </div>)}
          </div>
          <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-[11px] font-semibold text-stone-500"><span className="inline-flex items-center gap-2"><i className="h-2.5 w-2.5 rounded-sm bg-brand-orange"/>New customers</span><span className="inline-flex items-center gap-2"><i className="h-2.5 w-2.5 rounded-sm bg-stone-300"/>Customers who ordered</span></div>
        </div>
        <div className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm sm:p-5">
          <div><h2 className="text-base font-extrabold">Order value</h2><p className="mt-1 text-xs text-stone-500">Based on all non-cancelled customer orders.</p></div>
          <div className="mt-4 rounded-xl bg-brand-pale p-4"><p className="text-xs font-semibold text-stone-600">Average order value</p><p className="mt-1 text-2xl font-black text-brand-ink">{formatPrice(data.average_order_value)}</p><p className="mt-2 text-xs text-stone-500">Across {data.completed_order_count.toLocaleString('en-IN')} orders</p></div>
          <div className="mt-3 flex items-center gap-3 rounded-xl border border-stone-100 p-3"><CalendarDays size={17} className="text-brand-burnt"/><div><p className="text-xs font-bold">30-day active customers</p><p className="mt-0.5 text-xs text-stone-500">{data.active_customers_30d.toLocaleString('en-IN')} customers ordered recently</p></div></div>
        </div>
      </section>

      <section className="overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm">
        <div className="border-b border-stone-100 p-4 sm:p-5">
          <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start"><div><h2 className="font-extrabold">Customer list</h2><p className="mt-1 text-xs text-stone-500">Profile and order totals refresh when customer or order records change.</p></div><span className="text-xs font-semibold text-stone-500">{filteredCustomers.length.toLocaleString('en-IN')} shown</span></div>
          <div className="mt-4 grid gap-2 sm:grid-cols-[minmax(220px,1fr)_200px]">
            <label className="flex min-h-10 min-w-0 items-center gap-2 rounded-xl border border-stone-200 px-3"><Search size={16} className="shrink-0 text-stone-400"/><input value={search} onChange={event => { setSearch(event.target.value); setVisibleCount(50); }} placeholder="Search name, email, or phone" aria-label="Search customers" className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-stone-400"/></label>
            <select value={filter} onChange={event => { setFilter(event.target.value as CustomerFilter); setVisibleCount(50); }} aria-label="Filter customers" className="min-h-10 rounded-xl border border-stone-200 bg-white px-3 text-sm font-semibold text-stone-700 outline-none"><option value="all">All customers</option><option value="ordered">Has ordered</option><option value="repeat">Repeat customers</option><option value="no-orders">No orders yet</option></select>
          </div>
        </div>
        <div className="hidden grid-cols-[minmax(220px,1.6fr)_minmax(140px,1fr)_100px_130px_145px] gap-3 border-b border-stone-100 bg-stone-50 px-5 py-3 text-[11px] font-bold uppercase tracking-wide text-stone-500 md:grid"><span>Customer</span><span>Joined</span><span>Orders</span><span>Total spent</span><span>Last order</span></div>
        {filteredCustomers.length ? <div className="divide-y divide-stone-100">{filteredCustomers.slice(0, visibleCount).map(customer => <CustomerRow key={customer.id} customer={customer}/>)}</div> : <div className="px-4 py-14 text-center"><Users size={28} className="mx-auto text-stone-400"/><p className="mt-3 font-bold">{data.total_customers ? 'No customers match this search' : 'No customer profiles yet'}</p><p className="mt-1 text-sm text-stone-500">{data.total_customers ? 'Change the search or filter to see customers.' : 'New customer accounts will appear here.'}</p></div>}
        {filteredCustomers.length > visibleCount && <div className="border-t border-stone-100 p-4 text-center"><button type="button" onClick={() => setVisibleCount(count => count + 50)} className="min-h-10 rounded-xl border border-stone-200 px-4 text-sm font-bold text-stone-700 hover:bg-stone-50">Load 50 more customers</button></div>}
      </section>
    </>}
  </div>;
}

function MetricCard({ label, value, note, Icon }: { label: string; value: string; note: string; Icon: typeof Users }) {
  return <article className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm sm:p-5"><div className="flex items-start justify-between gap-2"><p className="text-xs font-semibold text-stone-500 sm:text-sm">{label}</p><span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-pale text-brand-burnt"><Icon size={16}/></span></div><p className="mt-2 break-words text-xl font-black tabular-nums sm:text-2xl">{value}</p><p className="mt-1 text-[11px] leading-4 text-stone-500">{note}</p></article>;
}

function CustomerRow({ customer }: { customer: AdminCustomer }) {
  const name = customer.full_name.trim() || 'Customer';
  const initials = name.split(/\s+/).slice(0, 2).map(part => part[0]).join('').toUpperCase();
  return <article className="grid min-w-0 gap-3 px-4 py-4 md:grid-cols-[minmax(220px,1.6fr)_minmax(140px,1fr)_100px_130px_145px] md:items-center md:gap-3 md:px-5">
    <div className="flex min-w-0 items-center gap-3"><span aria-hidden="true" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-pale text-xs font-black text-brand-burnt">{initials || 'C'}</span><div className="min-w-0"><p className="truncate text-sm font-bold text-stone-800">{name}</p><p className="truncate text-xs text-stone-500">{customer.email_id || customer.phone || 'No email or phone provided'}</p>{customer.email_id && customer.phone && <p className="mt-0.5 truncate text-[11px] text-stone-400">{customer.phone}</p>}</div></div>
    <div className="flex items-center justify-between gap-3 text-xs md:block"><span className="text-stone-400 md:hidden">Joined</span><span className="font-medium text-stone-600">{formatDate(customer.created_at)}</span></div>
    <div className="flex items-center justify-between gap-3 text-xs md:block"><span className="text-stone-400 md:hidden">Orders</span><span className="font-bold text-stone-700">{customer.order_count.toLocaleString('en-IN')}</span></div>
    <div className="flex items-center justify-between gap-3 text-xs md:block"><span className="text-stone-400 md:hidden">Total spent</span><span className="font-extrabold text-stone-800">{formatPrice(customer.total_spend)}</span></div>
    <div className="flex items-center justify-between gap-3 text-xs md:block"><span className="text-stone-400 md:hidden">Last order</span><span className="font-medium text-stone-600">{customer.last_order_at ? formatDate(customer.last_order_at) : 'No orders'}</span></div>
  </article>;
}

function formatDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : format(date, 'dd MMM yyyy');
}

function CustomerLoading() {
  return <div aria-label="Loading customer analysis" className="animate-pulse space-y-5"><div className="grid grid-cols-2 gap-3 xl:grid-cols-4">{[0, 1, 2, 3].map(index => <div key={index} className="h-28 rounded-2xl bg-white"/>)}</div><div className="h-72 rounded-2xl bg-white"/><div className="h-96 rounded-2xl bg-white"/></div>;
}

function PageState({ title, message, action }: { title: string; message: string; action?: () => void }) {
  return <section className="rounded-2xl border border-stone-200 bg-white p-6 text-center shadow-sm sm:p-9"><span className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-brand-pale text-brand-burnt"><CircleAlert size={22}/></span><h1 className="mt-4 text-lg font-extrabold">{title}</h1><p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-stone-500">{message}</p>{action && <button type="button" onClick={action} className="mt-4 min-h-10 rounded-xl bg-brand-orange px-4 text-sm font-bold text-white">Retry</button>}</section>;
}
