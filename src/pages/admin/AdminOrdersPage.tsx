import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { format, isToday } from 'date-fns';
import { ArrowDownWideNarrow, Banknote, Bell, CalendarDays, Check, ChefHat, ChevronRight, CircleAlert, Clock3, CreditCard, Image as ImageIcon, LoaderCircle, MapPin, Package, Phone, RefreshCw, Search, ShoppingBag, Truck, UserRound, X } from 'lucide-react';
import { getAdminOrderCounts, getAdminOrders, updateAdminOrder, type AdminOrder, type AdminOrderUpdate, type RestaurantOrderStatus } from '../../services/adminOrderService';
import { supabase } from '../../lib/supabase';

const orderStates: { value: RestaurantOrderStatus; label: string }[] = [
  { value: 'pending', label: 'New' }, { value: 'accepted', label: 'Accepted' },
  { value: 'preparing', label: 'Preparing' }, { value: 'ready', label: 'Ready' },
  { value: 'out_for_delivery', label: 'Out for Delivery' }, { value: 'delivered', label: 'Delivered' },
  { value: 'cancelled', label: 'Cancelled' },
];

const statusStyles: Record<RestaurantOrderStatus, string> = {
  pending: 'bg-brand-pale text-brand-burnt', accepted: 'bg-blue-50 text-blue-700',
  preparing: 'bg-violet-50 text-violet-700', ready: 'bg-green-50 text-green-700',
  out_for_delivery: 'bg-orange-50 text-orange-800', delivered: 'bg-stone-100 text-stone-700',
  cancelled: 'bg-red-50 text-red-700',
};

const nextStatuses: Partial<Record<RestaurantOrderStatus, { value: RestaurantOrderStatus; label: string; Icon: typeof Check }>> = {
  pending: { value: 'accepted', label: 'Accept Order', Icon: Check },
  accepted: { value: 'preparing', label: 'Start Preparing', Icon: ChefHat },
  preparing: { value: 'ready', label: 'Mark as Ready', Icon: Check },
  ready: { value: 'out_for_delivery', label: 'Out for Delivery', Icon: Truck },
  out_for_delivery: { value: 'delivered', label: 'Mark as Delivered', Icon: Check },
};

const stateLabel = (status: RestaurantOrderStatus) => orderStates.find(item => item.value === status)?.label ?? status;
const formatPrice = (value: number) => `₹${Number(value || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
const getItemImage = (item: AdminOrder['order_items'][number]) => Array.isArray(item.food) ? item.food[0]?.image_url : item.food?.image_url;
const getAddress = (order: AdminOrder) => {
  const address = order.address_snapshot;
  return [address?.house, address?.street, address?.area, address?.city, address?.pincode, address?.landmark].filter(Boolean).join(', ');
};

type StatusFilter = 'all' | RestaurantOrderStatus;
type RealtimeProps = { realtimeStatus: 'connecting' | 'connected' | 'disconnected'; newOrderNotifications: number; onClearNotifications: () => void };

export function AdminOrdersPage({ realtimeStatus, newOrderNotifications, onClearNotifications }: RealtimeProps) {
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<StatusFilter>('all');
  const [search, setSearch] = useState('');
  const [dateFilter, setDateFilter] = useState<'all' | 'today'>('all');
  const [paymentFilter, setPaymentFilter] = useState<'all' | 'cod' | 'online'>('all');
  const [sort, setSort] = useState<'newest' | 'oldest' | 'highest' | 'lowest'>('newest');
  const [feedback, setFeedback] = useState('');
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const orders = useQuery({ queryKey: ['admin-orders'], queryFn: getAdminOrders, enabled: Boolean(supabase), staleTime: 15_000 });
  const orderCounts = useQuery({ queryKey: ['admin-order-counts'], queryFn: getAdminOrderCounts, enabled: Boolean(supabase), staleTime: 15_000 });
  const update = useMutation({
    mutationFn: ({ id, values }: { id: string; values: AdminOrderUpdate }) => updateAdminOrder(id, values),
    onMutate: async ({ id, values }) => {
      await queryClient.cancelQueries({ queryKey: ['admin-orders'] });
      const previous = queryClient.getQueryData<AdminOrder[]>(['admin-orders']);
      queryClient.setQueryData<AdminOrder[]>(['admin-orders'], current => current?.map(order => order.id === id ? { ...order, ...values } : order));
      setFeedback('');
      return { previous };
    },
    onSuccess: (_result, { values }) => {
      setFeedback(values.payment_status === 'paid' ? 'Payment marked as paid.' : 'Order status updated. Customer tracking will refresh automatically.');
    },
    onError: (_error, _variables, context) => {
      if (context?.previous) queryClient.setQueryData(['admin-orders'], context.previous);
      setFeedback('Could not update the order. Check Owner/Admin permissions and retry.');
    },
    onSettled: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['admin-orders'] }),
        queryClient.invalidateQueries({ queryKey: ['admin-order-counts'] }),
        queryClient.invalidateQueries({ queryKey: ['admin-order-pending-count'] }),
        queryClient.invalidateQueries({ queryKey: ['admin-dashboard'] }),
        queryClient.invalidateQueries({ queryKey: ['admin-analytics'] }),
      ]);
    },
  });

  const allOrders = orders.data ?? [];
  const loadedCounts = useMemo(() => allOrders.reduce<Record<RestaurantOrderStatus, number>>((result, order) => {
    result[order.status] += 1;
    return result;
  }, { pending: 0, accepted: 0, preparing: 0, ready: 0, out_for_delivery: 0, delivered: 0, cancelled: 0 }), [allOrders]);
  const counts = orderCounts.data ?? loadedCounts;
  const totalOrderCount = Object.values(counts).reduce((total, count) => total + count, 0);
  const visibleOrders = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    const filtered = allOrders.filter(order => {
      if (filter !== 'all' && order.status !== filter) return false;
      if (dateFilter === 'today' && !isToday(new Date(order.created_at))) return false;
      const isCod = order.payment_method.toLowerCase() === 'cod';
      if (paymentFilter === 'cod' && !isCod) return false;
      if (paymentFilter === 'online' && isCod) return false;
      if (!query) return true;
      const address = order.address_snapshot;
      return [order.id, address?.full_name, address?.phone].filter(Boolean).join(' ').toLocaleLowerCase().includes(query);
    });
    return filtered.sort((left, right) => {
      if (sort === 'oldest') return new Date(left.created_at).getTime() - new Date(right.created_at).getTime();
      if (sort === 'highest') return Number(right.total) - Number(left.total);
      if (sort === 'lowest') return Number(left.total) - Number(right.total);
      return new Date(right.created_at).getTime() - new Date(left.created_at).getTime();
    });
  }, [allOrders, dateFilter, filter, paymentFilter, search, sort]);
  const selectedOrder = allOrders.find(order => order.id === selectedOrderId) ?? null;

  if (!supabase) return <StateCard title="Supabase is not connected" body="Add the public Supabase URL and anon key to load restaurant orders."/>;

  const statusAction = (order: AdminOrder) => {
    const next = nextStatuses[order.status];
    if (!next) return;
    update.mutate({ id: order.id, values: { status: next.value } });
  };

  return <div className="mx-auto max-w-[1440px]">
    <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
      <div><p className="text-xs font-extrabold uppercase tracking-[.18em] text-brand-burnt">Restaurant operations</p><h1 className="mt-2 text-2xl font-black sm:text-3xl">Orders</h1><p className="mt-1 text-sm text-stone-500">Manage and track customer orders in real time.</p></div>
      <div className="flex flex-wrap items-center gap-2">
        <span className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-stone-200 bg-white px-3 text-xs font-bold text-stone-600" aria-live="polite"><span className={`h-2 w-2 rounded-full ${realtimeStatus === 'connected' ? 'bg-green-500' : realtimeStatus === 'connecting' ? 'animate-pulse bg-amber-400' : 'bg-red-400'}`}/>{realtimeStatus === 'connected' ? 'Live Updates' : realtimeStatus === 'connecting' ? 'Connecting…' : 'Updates offline'}</span>
        <button type="button" onClick={() => { setFilter('pending'); onClearNotifications(); }} className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-stone-200 bg-white px-3 text-xs font-bold text-stone-700 hover:bg-stone-50"><Bell size={15}/>{newOrderNotifications ? `Notifications · ${newOrderNotifications}` : 'Notifications'}</button>
        <button type="button" onClick={() => void orders.refetch()} disabled={orders.isFetching} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-stone-200 bg-white px-3 text-sm font-bold text-stone-700 disabled:opacity-50"><RefreshCw size={15} className={orders.isFetching ? 'animate-spin' : ''}/>Refresh</button>
      </div>
    </header>

    <section aria-label="Order counts" className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
      <OrderMetric label="All orders" value={totalOrderCount}/><OrderMetric label="New" value={counts.pending}/><OrderMetric label="In progress" value={counts.accepted + counts.preparing + counts.ready + counts.out_for_delivery}/><OrderMetric label="Delivered" value={counts.delivered}/>
    </section>

    <section className="mt-5 overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm">
      <div className="border-b border-stone-100 px-4 pt-4 sm:px-5 sm:pt-5">
        <div className="flex items-start justify-between gap-3"><div><h2 className="font-extrabold">Order queue</h2><p className="mt-1 text-xs text-stone-500">Showing the latest {Math.min(allOrders.length, 250)} of {totalOrderCount} orders · changes sync to customer tracking.</p></div><span className="hidden items-center gap-1.5 text-[11px] font-semibold text-stone-500 sm:flex"><Package size={14}/>{allOrders.length} loaded</span></div>
        <div role="tablist" aria-label="Filter orders by status" className="mt-4 flex gap-1 overflow-x-auto border-b border-stone-100 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {([{ value: 'all', label: 'All', count: allOrders.length }, ...orderStates.map(status => ({ value: status.value, label: status.label, count: counts[status.value] }))] as { value: StatusFilter; label: string; count: number }[]).map(tab => <button key={tab.value} type="button" role="tab" aria-selected={filter === tab.value} onClick={() => setFilter(tab.value)} className={`-mb-px inline-flex min-h-11 shrink-0 items-center gap-1.5 border-b-2 px-3 text-xs font-bold transition-colors ${filter === tab.value ? 'border-brand-orange text-brand-burnt' : 'border-transparent text-stone-500 hover:text-stone-800'}`}>{tab.label}<span className={`rounded-full px-1.5 py-0.5 text-[10px] tabular-nums ${filter === tab.value ? 'bg-brand-pale text-brand-burnt' : 'bg-stone-100 text-stone-500'}`}>{tab.count}</span></button>)}
        </div>
        <div className="grid grid-cols-2 gap-2 py-4 xl:grid-cols-[minmax(220px,1fr)_repeat(3,minmax(135px,auto))]">
          <label className="col-span-2 flex min-h-10 min-w-0 items-center gap-2 rounded-xl border border-stone-200 px-3 xl:col-span-1"><Search size={16} className="shrink-0 text-stone-400"/><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Order ID, customer or phone" aria-label="Search orders by ID, customer or phone" className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-stone-400"/></label>
          <label className="flex min-h-10 items-center gap-2 rounded-xl border border-stone-200 px-3 text-stone-500"><CalendarDays size={15} className="shrink-0"/><select value={dateFilter} onChange={event => setDateFilter(event.target.value as typeof dateFilter)} aria-label="Filter orders by date" className="min-w-0 flex-1 bg-transparent text-xs font-semibold text-stone-700 outline-none"><option value="all">All dates</option><option value="today">Today</option></select></label>
          <label className="flex min-h-10 items-center gap-2 rounded-xl border border-stone-200 px-3 text-stone-500"><Banknote size={15} className="shrink-0"/><select value={paymentFilter} onChange={event => setPaymentFilter(event.target.value as typeof paymentFilter)} aria-label="Filter orders by payment type" className="min-w-0 flex-1 bg-transparent text-xs font-semibold text-stone-700 outline-none"><option value="all">All payments</option><option value="cod">Cash on Delivery</option><option value="online">Online payment</option></select></label>
          <label className="flex min-h-10 items-center gap-2 rounded-xl border border-stone-200 px-3 text-stone-500"><ArrowDownWideNarrow size={15} className="shrink-0"/><select value={sort} onChange={event => setSort(event.target.value as typeof sort)} aria-label="Sort orders" className="min-w-0 flex-1 bg-transparent text-xs font-semibold text-stone-700 outline-none"><option value="newest">Newest first</option><option value="oldest">Oldest first</option><option value="highest">Highest amount</option><option value="lowest">Lowest amount</option></select></label>
        </div>
      </div>

      {feedback && <p role="status" className={`mx-4 mt-4 rounded-xl p-3 text-sm sm:mx-5 ${feedback.startsWith('Could') ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}>{feedback}</p>}
      {newOrderNotifications > 0 && <div role="status" className="mx-4 mt-4 flex items-center justify-between gap-3 rounded-xl border border-orange-100 bg-orange-50 px-3 py-2.5 text-xs font-semibold text-brand-burnt sm:mx-5"><span className="flex items-center gap-2"><Bell size={15}/>{newOrderNotifications === 1 ? 'A new customer order has arrived.' : `${newOrderNotifications} new customer orders have arrived.`}</span><button type="button" onClick={onClearNotifications} aria-label="Dismiss new order notification" className="rounded-lg p-1 hover:bg-orange-100"><X size={15}/></button></div>}
      {orders.isLoading ? <div aria-label="Loading orders" className="space-y-3 p-4 sm:p-5">{[0, 1, 2, 3].map(index => <div key={index} className="h-36 animate-pulse rounded-xl bg-stone-100"/>)}</div>
        : orders.isError ? <div role="alert" className="p-5 sm:p-7"><StateCard title="Unable to load orders" body="Check your Owner/Admin permissions and internet connection, then try again." action={() => void orders.refetch()}/></div>
        : visibleOrders.length ? <div className="divide-y divide-stone-100">{visibleOrders.map(order => <OrderCard key={order.id} order={order} busy={update.isPending} onOpen={() => setSelectedOrderId(order.id)} onStatus={() => statusAction(order)}/>)}</div>
        : <div className="px-4 py-14 text-center"><ShoppingBag size={28} className="mx-auto text-stone-400"/><p className="mt-3 font-bold">{allOrders.length ? 'No orders match these filters' : 'No customer orders yet'}</p><p className="mt-1 text-sm text-stone-500">{allOrders.length ? 'Adjust your search or filters to see orders.' : 'New customer orders will appear here automatically.'}</p></div>}
    </section>

    {selectedOrder && <OrderDetailsDrawer order={selectedOrder} busy={update.isPending} onClose={() => setSelectedOrderId(null)} onStatus={() => statusAction(selectedOrder)} onPaid={() => update.mutate({ id: selectedOrder.id, values: { payment_status: 'paid' } })} onCancel={() => { if (window.confirm('Cancel this order? The customer will see the updated status.')) update.mutate({ id: selectedOrder.id, values: { status: 'cancelled' } }); }}/>}
  </div>;
}

function OrderCard({ order, busy, onOpen, onStatus }: { order: AdminOrder; busy: boolean; onOpen: () => void; onStatus: () => void }) {
  const address = order.address_snapshot;
  const customer = address?.full_name || 'Customer';
  const itemCount = order.order_items.reduce((sum, item) => sum + Number(item.quantity || 0), 0);
  const next = nextStatuses[order.status];
  return <article className="flex min-w-0 flex-col sm:flex-row sm:items-stretch">
    <button type="button" onClick={onOpen} aria-label={`View details for order ${order.id.slice(0, 8)}`} className="min-w-0 flex-1 p-4 text-left transition-colors hover:bg-stone-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-orange sm:p-5">
      <div className="flex flex-wrap items-center gap-2"><b className="text-sm font-extrabold">#{order.id.slice(0, 8).toUpperCase()}</b><span className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${statusStyles[order.status]}`}>{stateLabel(order.status)}</span><span className="ml-auto inline-flex items-center gap-1 text-[11px] font-medium text-stone-500"><Clock3 size={13}/>{format(new Date(order.created_at), 'MMM d, h:mm a')}</span></div>
      <div className="mt-3 flex min-w-0 items-center gap-3 sm:gap-5">
        <div className="min-w-0 flex-1"><p className="truncate text-sm font-bold text-stone-800">{customer}</p><p className="mt-1 flex items-center gap-1.5 text-xs text-stone-500">{address?.phone ? <><Phone size={12}/>{address.phone}</> : 'Phone not provided'}</p><p className="mt-1.5 text-xs text-stone-500">{itemCount} {itemCount === 1 ? 'item' : 'items'}</p></div>
        <div className="flex shrink-0 items-center" aria-label={`Preview of ${Math.min(order.order_items.length, 3)} ordered food items`}>
          {order.order_items.slice(0, 3).map((item, index) => <FoodThumbnail key={item.id} src={getItemImage(item)} name={item.name_snapshot} className={`h-10 w-10 rounded-xl border-2 border-white bg-stone-100 ${index ? '-ml-2' : ''}`}/>) }
          {order.order_items.length > 3 && <span className="-ml-2 flex h-10 w-10 items-center justify-center rounded-xl border-2 border-white bg-stone-100 text-[10px] font-bold text-stone-600">+{order.order_items.length - 3}</span>}
          {!order.order_items.length && <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-stone-100 text-stone-400"><Package size={17}/></span>}
        </div>
      </div>
    </button>
    <div className="flex items-center justify-between gap-3 border-t border-stone-100 px-4 py-3 sm:w-60 sm:shrink-0 sm:flex-col sm:items-stretch sm:justify-center sm:border-l sm:border-t-0 sm:px-4 sm:py-4">
      <button type="button" onClick={onOpen} className="min-w-0 flex-1 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-orange sm:flex-none"><p className="text-lg font-black tabular-nums">{formatPrice(order.total)}</p><p className="mt-0.5 flex items-center gap-1.5 text-[11px] font-medium text-stone-500">{order.payment_method.toLowerCase() === 'cod' ? <Banknote size={13}/> : <CreditCard size={13}/>} {order.payment_method.toLowerCase() === 'cod' ? 'Cash on Delivery' : 'Online payment'} · {order.payment_status === 'paid' ? 'Paid' : 'Pending'}</p></button>
      <div className="flex shrink-0 items-center gap-2 sm:flex-wrap"><button type="button" onClick={onOpen} className="min-h-9 rounded-lg border border-stone-200 px-3 text-xs font-bold text-stone-700 hover:bg-stone-50">View details</button>{next && <button type="button" disabled={busy} onClick={onStatus} className="inline-flex min-h-9 items-center justify-center gap-1.5 rounded-lg bg-brand-orange px-3 text-xs font-extrabold text-white hover:brightness-95 disabled:opacity-50"><next.Icon size={14}/><span className="hidden md:inline">{next.label}</span><span className="md:hidden">{next.value === 'out_for_delivery' ? 'Dispatch' : next.value === 'delivered' ? 'Deliver' : next.value === 'preparing' ? 'Prepare' : next.value === 'ready' ? 'Ready' : 'Accept'}</span></button>}</div>
    </div>
  </article>;
}

function OrderDetailsDrawer({ order, busy, onClose, onStatus, onPaid, onCancel }: { order: AdminOrder; busy: boolean; onClose: () => void; onStatus: () => void; onPaid: () => void; onCancel: () => void }) {
  const address = getAddress(order);
  const next = nextStatuses[order.status];
  const orderDate = new Date(order.created_at);
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  return <div className="fixed inset-0 z-50 flex justify-end bg-brand-ink/40">
    <button type="button" tabIndex={-1} aria-label="Close order details" onClick={onClose} className="absolute inset-0 cursor-default"/>
    <aside role="dialog" aria-modal="true" aria-labelledby="order-details-title" className="relative z-10 flex h-full w-full max-w-none flex-col overflow-hidden bg-white shadow-2xl sm:max-w-[500px]">
      <header className="flex shrink-0 items-start justify-between gap-3 border-b border-stone-100 px-4 py-4 sm:px-6"><div className="min-w-0"><p className="text-[11px] font-extrabold uppercase tracking-[.16em] text-brand-burnt">Order details</p><h2 id="order-details-title" className="mt-1 truncate text-lg font-black">#{order.id.slice(0, 8).toUpperCase()}</h2><div className="mt-2 flex flex-wrap items-center gap-2"><span className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${statusStyles[order.status]}`}>{stateLabel(order.status)}</span><span className="text-xs text-stone-500">{format(orderDate, 'dd MMM yyyy · h:mm a')}</span></div></div><button type="button" onClick={onClose} aria-label="Close order details" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-stone-200 text-stone-600 hover:bg-stone-50"><X size={19}/></button></header>
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-6">
        <section className="rounded-xl border border-stone-100 bg-stone-50 p-4"><h3 className="flex items-center gap-2 text-sm font-extrabold"><UserRound size={16} className="text-brand-burnt"/>Customer information</h3><p className="mt-3 font-bold">{order.address_snapshot?.full_name || 'Customer'}</p>{order.address_snapshot?.phone ? <a href={`tel:${order.address_snapshot.phone}`} className="mt-2 inline-flex min-h-9 items-center gap-2 text-sm font-semibold text-brand-burnt"><Phone size={15}/>{order.address_snapshot.phone}</a> : <p className="mt-2 text-sm text-stone-500">Phone not provided</p>}<div className="mt-2 flex items-start gap-2 text-sm leading-5 text-stone-600"><MapPin size={15} className="mt-0.5 shrink-0 text-stone-400"/><span>{address || 'Delivery address not available'}</span></div>{address && <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`} target="_blank" rel="noreferrer" className="mt-3 inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-stone-200 bg-white px-3 text-xs font-bold text-stone-700 hover:bg-stone-50"><MapPin size={14}/>View on Map<ChevronRight size={14}/></a>}</section>

        <section className="mt-5"><div className="flex items-center justify-between"><h3 className="text-sm font-extrabold">Order items</h3><span className="text-xs text-stone-500">{order.order_items.reduce((sum, item) => sum + Number(item.quantity || 0), 0)} items</span></div>{order.order_items.length ? <ul className="mt-2 divide-y divide-stone-100">{order.order_items.map(item => <li key={item.id} className="flex items-start gap-3 py-3"><FoodThumbnail src={getItemImage(item)} name={item.name_snapshot} className="h-[60px] w-[60px] shrink-0 rounded-xl bg-stone-100"/><div className="min-w-0 flex-1"><p className="text-sm font-bold">{item.name_snapshot}{item.size ? <span className="ml-1 font-medium text-stone-500">· {item.size}</span> : null}</p><p className="mt-1 text-xs text-stone-500">{item.quantity} × {formatPrice(item.unit_price)} <span className="ml-1">{item.order_item_customizations?.map(customization => customization.option_name_snapshot).join(', ')}</span></p>{item.special_instructions && <p className="mt-1 text-xs text-stone-500">Note: {item.special_instructions}</p>}</div><b className="shrink-0 pt-0.5 text-sm tabular-nums">{formatPrice(Number(item.unit_price) * Number(item.quantity))}</b></li>)}</ul> : <p className="mt-2 rounded-xl bg-stone-50 p-4 text-sm text-stone-500">No item details were saved for this order.</p>}</section>

        <section className="mt-4 rounded-xl border border-stone-100 p-4"><h3 className="text-sm font-extrabold">Price summary</h3><PriceRow label="Subtotal" value={order.subtotal}/><PriceRow label="Delivery charge" value={order.delivery_fee}/>{Number(order.discount) > 0 && <PriceRow label="Discount" value={Number(order.discount)}/>}<div className="mt-3 flex items-center justify-between border-t border-stone-100 pt-3"><span className="font-extrabold">Total amount</span><b className="text-lg font-black tabular-nums">{formatPrice(order.total)}</b></div></section>

        <section className="mt-4 rounded-xl border border-stone-100 p-4"><h3 className="text-sm font-extrabold">Payment</h3><div className="mt-3 flex items-center justify-between gap-3"><span className="inline-flex items-center gap-2 text-sm text-stone-700">{order.payment_method.toLowerCase() === 'cod' ? <Banknote size={17}/> : <CreditCard size={17}/>} {order.payment_method.toLowerCase() === 'cod' ? 'Cash on Delivery' : 'Online payment'}</span><span className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${order.payment_status === 'paid' ? 'bg-green-50 text-green-700' : 'bg-orange-50 text-orange-800'}`}>{order.payment_status === 'paid' ? 'Paid' : 'Payment pending'}</span></div>{order.payment_method.toLowerCase() === 'cod' && order.payment_status === 'pending' && <button type="button" disabled={busy} onClick={onPaid} className="mt-3 min-h-10 w-full rounded-lg border border-brand-orange bg-brand-pale px-3 text-xs font-extrabold text-brand-burnt hover:bg-orange-100 disabled:opacity-50">Mark as Paid</button>}</section>

        <section className="mt-5 pb-2"><h3 className="text-sm font-extrabold">Order progress</h3>{order.status === 'cancelled' ? <p className="mt-3 rounded-xl bg-red-50 p-3 text-sm font-semibold text-red-700">This order was cancelled.</p> : <ol className="mt-3 space-y-2">{orderStates.filter(status => status.value !== 'cancelled').map((step, index, list) => { const currentIndex = list.findIndex(item => item.value === order.status); const complete = index < currentIndex; const current = index === currentIndex; return <li key={step.value} className="flex items-center gap-3"><span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-[10px] font-bold ${complete ? 'border-green-600 bg-green-600 text-white' : current ? 'border-brand-orange bg-brand-orange text-white' : 'border-stone-200 bg-white text-stone-400'}`}>{complete ? <Check size={13}/> : index + 1}</span><span className={`text-xs ${current ? 'font-extrabold text-stone-900' : complete ? 'font-semibold text-stone-600' : 'text-stone-400'}`}>{step.label}</span>{index < list.length - 1 && <span className={`ml-auto h-px flex-1 ${complete ? 'bg-green-300' : 'bg-stone-100'}`}/>}</li>; })}</ol>}</section>
      </div>
      <footer className="shrink-0 border-t border-stone-100 bg-white px-4 py-3 pb-[max(12px,env(safe-area-inset-bottom))] sm:px-6"><div className="flex gap-2">{next ? <button type="button" disabled={busy} onClick={onStatus} className="inline-flex min-h-12 flex-1 items-center justify-center gap-2 rounded-xl bg-brand-orange px-4 text-sm font-extrabold text-white hover:brightness-95 disabled:opacity-50"><next.Icon size={17}/>{next.label}</button> : <div className={`flex min-h-12 flex-1 items-center justify-center gap-2 rounded-xl px-4 text-sm font-extrabold ${order.status === 'cancelled' ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}><Check size={17}/>{order.status === 'cancelled' ? 'Order Cancelled' : 'Order Completed'}</div>}<button type="button" onClick={onClose} className="min-h-12 rounded-xl border border-stone-200 px-4 text-sm font-bold text-stone-700 hover:bg-stone-50">Close</button></div>{!['delivered', 'cancelled'].includes(order.status) && <button type="button" disabled={busy} onClick={onCancel} className="mt-2 min-h-8 w-full text-xs font-semibold text-stone-500 hover:text-red-700 disabled:opacity-50">Cancel this order</button>}</footer>
    </aside>
  </div>;
}

function FoodThumbnail({ src, name, className }: { src: string | null | undefined; name: string; className: string }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [src]);
  return <span className={`relative flex shrink-0 items-center justify-center overflow-hidden ${className}`}>{src && !failed ? <img src={src} alt={name} loading="lazy" onError={() => setFailed(true)} className="h-full w-full object-cover"/> : <ImageIcon size={19} aria-label={`${name} image unavailable`} className="text-stone-400"/>}</span>;
}

function PriceRow({ label, value }: { label: string; value: number }) {
  return <div className="mt-2 flex items-center justify-between text-xs text-stone-500"><span>{label}</span><span className="tabular-nums">{formatPrice(value)}</span></div>;
}

function OrderMetric({ label, value }: { label: string; value: number }) {
  return <div className="min-w-0 rounded-2xl border border-stone-200 bg-white p-4 shadow-sm"><p className="truncate text-xs font-bold text-stone-500">{label}</p><b className="mt-1 block text-2xl font-black tabular-nums">{value}</b></div>;
}

function StateCard({ title, body, action }: { title: string; body: string; action?: () => void }) {
  return <div className="rounded-xl bg-stone-50 p-6 text-center"><span className="mx-auto flex h-10 w-10 items-center justify-center rounded-xl bg-brand-pale text-brand-burnt"><CircleAlert size={20}/></span><p className="mt-3 text-sm font-bold">{title}</p><p className="mt-1 text-xs text-stone-500">{body}</p>{action && <button type="button" onClick={action} className="mt-3 inline-flex min-h-10 items-center gap-2 rounded-lg bg-white px-3 text-xs font-bold text-brand-burnt"><LoaderCircle size={14}/>Retry</button>}</div>;
}
