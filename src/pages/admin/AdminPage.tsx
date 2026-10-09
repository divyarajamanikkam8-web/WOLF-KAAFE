import { Suspense, lazy, useState } from 'react';
import { Navigate, NavLink, Route, Routes, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { Activity, ArrowDownRight, ArrowRight, Check, CircleAlert, Clock3, LayoutDashboard, LoaderCircle, LogOut, Menu as MenuIcon, Plus, Settings, ShoppingBag, Tags, UtensilsCrossed, Users, X, ChartNoAxesColumn, Star } from 'lucide-react';
import { getAdminDashboardData } from '../../services/adminDashboardService';
import type { DashboardOrder } from '../../services/adminDashboardService';
import { getAdminPendingOrderCount } from '../../services/adminOrderService';
import { getProfileRole, signOut } from '../../services/authService';
import { supabase } from '../../lib/supabase';
import { AdminMenuPage } from './AdminMenuPage';
import { AdminOrdersPage } from './AdminOrdersPage';
import { AdminAnalyticsPage } from './AdminAnalyticsPage';
import { AdminCustomersPage } from './AdminCustomersPage';
import { AdminReviewsPage } from './AdminReviewsPage';
import { AdminOffersPage } from './AdminOffersPage';
import { AdminSettingsPage } from './AdminSettingsPage';
import { useAdminRealtime } from '../../hooks/useAdminRealtime';
import { getAdminRestaurantSettings } from '../../services/restaurantSettingsService';
import { RestaurantLogo } from '../../components/RestaurantLogo';

const RevenueChart = lazy(() => import('./RevenueChart'));

const links = [
  ['Dashboard', '/admin/dashboard', LayoutDashboard],
  ['Orders', '/admin/orders', ShoppingBag],
  ['Menu', '/admin/menu', UtensilsCrossed],
  ['Customers', '/admin/customers', Users],
  ['Offers', '/admin/offers', Tags],
  ['Analytics', '/admin/analytics', ChartNoAxesColumn],
  ['Reviews', '/admin/reviews', Star],
  ['Settings', '/admin/settings', Settings],
] as const;

function getGreeting() {
  const hour = new Date().getHours();
  return hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
}

export function AdminPage() {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [logoutError, setLogoutError] = useState('');
  const [realtimeStatus, setRealtimeStatus] = useState<'connecting' | 'connected' | 'disconnected'>('connecting');
  const [newOrderNotifications, setNewOrderNotifications] = useState(0);
  const navigate = useNavigate();
  const adminAccess = useQuery({
    queryKey: ['admin-route-access'],
    enabled: Boolean(supabase),
    retry: false,
    staleTime: 0,
    refetchOnMount: 'always',
    queryFn: async () => {
      if (!supabase) return 'signed-out' as const;
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      if (sessionError) throw sessionError;
      if (!sessionData.session) return 'signed-out' as const;

      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError) {
        if (/session missing|session not found|jwt expired/i.test(userError.message)) return 'signed-out' as const;
        throw userError;
      }
      if (!userData.user) return 'signed-out' as const;
      return await getProfileRole(userData.user.id) === 'admin' ? 'admin' as const : 'not-admin' as const;
    },
  });
  const restaurantSettings = useQuery({
    queryKey: ['admin-restaurant-settings'],
    queryFn: getAdminRestaurantSettings,
    enabled: Boolean(supabase) && adminAccess.data === 'admin',
    staleTime: 30_000,
  });
  useAdminRealtime({
    onConnectionChange: setRealtimeStatus,
    notifyNewOrders: restaurantSettings.data?.notify_new_orders_enabled ?? false,
    onNewOrder: () => setNewOrderNotifications(count => count + 1),
  });
  const pendingOrderCount = useQuery({ queryKey: ['admin-order-pending-count'], queryFn: getAdminPendingOrderCount, enabled: Boolean(supabase) && adminAccess.data === 'admin', staleTime: 15_000 });
  const orderNavCount = pendingOrderCount.data ?? newOrderNotifications;

  const logout = async () => {
    if (!supabase || loggingOut) return;
    setLoggingOut(true);
    setLogoutError('');
    const result = await signOut();
    if (!result || result.error) {
      setLogoutError('Could not log out. Please try again.');
      setLoggingOut(false);
      return;
    }
    navigate('/admin/login', { replace: true });
  };

  if (supabase && adminAccess.isLoading) return <div className="flex min-h-screen items-center justify-center bg-stone-100 p-5 text-sm font-semibold text-stone-600">Checking Owner/Admin login…</div>;
  if (supabase && (adminAccess.data === 'signed-out' || adminAccess.data === 'not-admin')) return <Navigate to="/admin/login" replace state={{ reason: adminAccess.data === 'not-admin' ? 'admin-role-required' : 'session-required' }}/>;
  if (supabase && adminAccess.isError) return <div className="flex min-h-screen items-center justify-center bg-stone-100 p-5"><section className="w-full max-w-md rounded-2xl border border-stone-200 bg-white p-6 text-center shadow-sm"><h1 className="text-lg font-black">Could not verify Owner/Admin access</h1><p className="mt-2 text-sm text-stone-500">Your login may have expired. Sign in again to continue managing the menu.</p><button type="button" onClick={() => void adminAccess.refetch()} className="mt-4 min-h-11 rounded-xl border border-stone-200 px-4 text-sm font-bold">Retry</button><NavLink to="/admin/login" className="ml-2 inline-flex min-h-11 items-center rounded-xl bg-brand-orange px-4 text-sm font-bold text-white">Admin login</NavLink></section></div>;

  return <div className="flex min-h-screen min-w-0 bg-stone-100 text-brand-ink">
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-[76px] flex-col bg-brand-ink text-white md:flex lg:w-60">
      <AdminBrand compact/>
      <AdminNavigation compact notificationCount={orderNavCount} onOrdersOpen={() => setNewOrderNotifications(0)}/>
      <button type="button" onClick={() => void logout()} disabled={loggingOut} aria-label="Log out" title="Log out" className="mx-2 mb-4 mt-auto flex min-h-11 items-center justify-center rounded-xl text-white/70 hover:bg-white/10 hover:text-white disabled:opacity-50 lg:mx-3 lg:justify-start lg:gap-3 lg:px-3">
        {loggingOut ? <LoaderCircle size={18} className="animate-spin"/> : <LogOut size={18}/>}<span className="hidden text-sm font-semibold lg:inline">{loggingOut ? 'Logging out…' : 'Log out'}</span>
      </button>
    </aside>

    {drawerOpen && <div className="fixed inset-0 z-50 md:hidden">
      <button type="button" aria-label="Close navigation menu" onClick={() => setDrawerOpen(false)} className="absolute inset-0 bg-brand-ink/50"/>
      <aside className="relative flex h-full w-[min(18rem,86vw)] flex-col bg-brand-ink text-white shadow-2xl">
        <div className="flex items-center justify-between"><AdminBrand/><button type="button" onClick={() => setDrawerOpen(false)} aria-label="Close menu" className="mr-3 flex h-10 w-10 items-center justify-center rounded-xl text-white/75 hover:bg-white/10"><X size={20}/></button></div>
        <AdminNavigation onNavigate={() => setDrawerOpen(false)} notificationCount={orderNavCount} onOrdersOpen={() => setNewOrderNotifications(0)}/>
        <button type="button" onClick={() => void logout()} disabled={loggingOut} className="mx-3 mb-4 mt-auto flex min-h-12 items-center gap-3 rounded-xl px-3 text-left text-sm font-semibold text-white/75 hover:bg-white/10 disabled:opacity-50">{loggingOut ? <LoaderCircle size={18} className="animate-spin"/> : <LogOut size={18}/>}<span>{loggingOut ? 'Logging out…' : 'Log out'}</span></button>
      </aside>
    </div>}

    <div className="flex min-h-screen min-w-0 flex-1 flex-col md:ml-[76px] lg:ml-60">
      <header className="sticky top-0 z-20 flex min-h-[68px] items-center justify-between gap-3 border-b border-stone-200 bg-white px-4 sm:px-6 lg:px-8">
        <div className="flex min-w-0 items-center gap-3">
          <button type="button" onClick={() => setDrawerOpen(true)} aria-label="Open navigation menu" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-stone-200 text-stone-700 hover:bg-stone-50 md:hidden"><MenuIcon size={20}/></button>
          <div className="min-w-0"><p className="truncate text-sm font-extrabold sm:text-base">The Wolf Kaafe <span className="hidden text-stone-400 sm:inline">/ Owner Panel</span></p><p className="mt-0.5 text-xs text-stone-500">{format(new Date(), 'EEEE, MMMM d')}</p></div>
        </div>
        <div className="flex shrink-0 items-center gap-2 sm:gap-3">
          <span className="hidden items-center gap-2 rounded-full border border-stone-200 px-3 py-2 text-xs font-semibold text-stone-600 sm:flex"><span className="h-2 w-2 rounded-full bg-brand-orange"/>Owner workspace</span>
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-pale text-brand-burnt" aria-label="Owner"><Users size={18}/></span>
        </div>
      </header>
      {logoutError && <p role="alert" className="mx-4 mt-3 rounded-xl bg-red-50 p-3 text-sm text-red-700 sm:mx-6 lg:mx-8">{logoutError}</p>}
      <main className="min-w-0 flex-1 px-4 py-5 sm:px-6 sm:py-6 lg:px-8 lg:py-8">
        <Routes>
          <Route path="/" element={<AdminDashboard/>}/>
          {links.map(([label, to]) => <Route key={to} path={to.split('/').pop()} element={label === 'Dashboard' ? <AdminDashboard/> : label === 'Menu' ? <AdminMenuPage/> : label === 'Orders' ? <AdminOrdersPage realtimeStatus={realtimeStatus} newOrderNotifications={newOrderNotifications} onClearNotifications={() => setNewOrderNotifications(0)}/> : label === 'Customers' ? <AdminCustomersPage realtimeStatus={realtimeStatus}/> : label === 'Analytics' ? <AdminAnalyticsPage/> : label === 'Reviews' ? <AdminReviewsPage/> : label === 'Offers' ? <AdminOffersPage/> : label === 'Settings' ? <AdminSettingsPage/> : <AdminHome/>}/>) }
        </Routes>
      </main>
    </div>
  </div>;
}

function AdminBrand({ compact = false }: { compact?: boolean }) {
  return <div className={`flex min-h-[84px] shrink-0 items-center gap-2 border-b border-white/10 px-3 py-3 ${compact ? 'justify-center lg:justify-start lg:px-4' : 'px-4'}`}>
    <RestaurantLogo className="h-12 w-12 shrink-0 rounded-xl bg-white object-contain"/>
    <span className={`${compact ? 'hidden lg:block' : 'block'} min-w-0 text-xs font-black leading-tight tracking-wide`}>THE WOLF KAAFE<span className="mt-1 block text-[10px] font-semibold uppercase tracking-[.18em] text-brand-warm">Owner Panel</span></span>
  </div>;
}

function AdminNavigation({ compact = false, onNavigate, notificationCount = 0, onOrdersOpen }: { compact?: boolean; onNavigate?: () => void; notificationCount?: number; onOrdersOpen?: () => void }) {
  return <nav aria-label="Admin navigation" className="flex flex-col gap-1 px-2 py-4 lg:px-3">
    {links.map(([label, to, Icon]) => <NavLink key={to} to={to} end={label === 'Dashboard'} onClick={() => { onNavigate?.(); if (label === 'Orders') onOrdersOpen?.(); }} title={compact ? label : undefined} className={({ isActive }) => `relative flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm transition-colors ${compact ? 'justify-center lg:justify-start' : ''} ${isActive ? 'bg-brand-orange font-bold text-white shadow-sm' : 'text-white/70 hover:bg-white/10 hover:text-white'}`}>
      <Icon size={18} className="shrink-0"/><span className={`${compact ? 'hidden lg:inline' : ''} ${compact ? 'lg:flex-1' : 'flex-1'}`}>{label}</span>
      {label === 'Orders' && notificationCount > 0 && <span aria-label={`${notificationCount} new order${notificationCount === 1 ? '' : 's'}`} className={`${compact ? 'absolute right-1 top-1 min-w-4 px-1 text-[9px] lg:static lg:text-[10px]' : 'ml-auto px-1.5 text-[10px]'} rounded-full bg-white font-extrabold leading-4 text-brand-burnt`}>{notificationCount > 99 ? '99+' : notificationCount}</span>}
    </NavLink>)}
  </nav>;
}

function AdminDashboard() {
  const dashboard = useQuery({ queryKey: ['admin-dashboard'], queryFn: getAdminDashboardData, enabled: Boolean(supabase), staleTime: 30_000 });
  if (!supabase) return <BackendSetupCard/>;
  if (dashboard.isLoading) return <DashboardLoading/>;
  if (dashboard.isError || !dashboard.data) return <div className="mx-auto max-w-7xl"><div className="rounded-2xl border border-red-100 bg-white p-5 sm:p-6"><p className="font-bold text-brand-ink">Dashboard data could not be loaded</p><p className="mt-1 text-sm text-stone-500">Check the admin account’s Supabase permissions and try again.</p><button type="button" onClick={() => void dashboard.refetch()} className="mt-4 min-h-10 rounded-lg bg-brand-orange px-4 text-sm font-bold text-white">Retry</button></div></div>;

  const data = dashboard.data;
  const activeStatusCount = data.statuses.pending + data.statuses.accepted + data.statuses.preparing + data.statuses.ready + data.statuses.out_for_delivery;
  const actions = [
    ['Manage Menu', '/admin/menu', UtensilsCrossed],
    ['View Orders', '/admin/orders', ShoppingBag],
    ['Create Offer', '/admin/offers', Tags],
    ['View Analytics', '/admin/analytics', ChartNoAxesColumn],
  ] as const;

  return <div className="mx-auto max-w-[1440px] space-y-6">
    <section className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
      <div><p className="text-xs font-extrabold uppercase tracking-[.18em] text-brand-burnt">Restaurant overview</p><h1 className="mt-2 text-2xl font-black tracking-tight sm:text-3xl">{getGreeting()}, Wolf Kaafe</h1><p className="mt-1 text-sm text-stone-500">Here’s what’s happening with your restaurant today.</p></div>
      <span className={`inline-flex w-fit items-center gap-2 rounded-full border px-3 py-2 text-xs font-bold ${data.restaurantOpen === null ? 'border-stone-200 bg-white text-stone-600' : data.restaurantOpen ? 'border-green-200 bg-green-50 text-green-700' : 'border-red-200 bg-red-50 text-red-700'}`}><span className={`h-2 w-2 rounded-full ${data.restaurantOpen === null ? 'bg-stone-400' : data.restaurantOpen ? 'bg-green-600' : 'bg-red-600'}`}/>{data.restaurantOpen === null ? 'Restaurant status unavailable' : data.restaurantOpen ? 'Restaurant open' : 'Restaurant closed'}</span>
    </section>

    <section aria-label="Today's key statistics" className="grid grid-cols-2 gap-3 xl:grid-cols-4 xl:gap-4">
      <StatCard title="Today's orders" value={String(data.todayOrders)} detail="Orders placed today" Icon={ShoppingBag}/>
      <StatCard title="Today's revenue" value={`₹${data.todayRevenue.toLocaleString('en-IN')}`} detail="Excludes cancelled orders" Icon={Activity}/>
      <StatCard title="Pending orders" value={String(data.statuses.pending)} detail={data.statuses.pending ? 'Waiting for confirmation' : 'No orders waiting'} Icon={Clock3} attention={data.statuses.pending > 0}/>
      <StatCard title="Customers" value={data.customers.toLocaleString('en-IN')} detail="Registered customers" Icon={Users}/>
    </section>

    <section className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm sm:p-5">
      <div className="flex items-center justify-between gap-3"><div><h2 className="text-base font-extrabold">Quick Actions</h2><p className="mt-1 text-xs text-stone-500">Jump to common restaurant tasks.</p></div><span className="hidden h-9 w-9 items-center justify-center rounded-xl bg-brand-pale text-brand-burnt sm:flex"><Plus size={18}/></span></div>
      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">{actions.map(([label, to, Icon]) => <NavLink key={label} to={to} className="group flex min-h-12 items-center gap-2 rounded-xl border border-stone-200 px-3 py-2.5 text-xs font-bold text-stone-700 hover:border-brand-soft hover:bg-brand-pale sm:gap-3 sm:px-4 sm:text-sm"><span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-stone-100 text-stone-600 group-hover:bg-white group-hover:text-brand-burnt"><Icon size={17}/></span><span className="min-w-0 flex-1">{label}</span><ArrowRight size={15} className="hidden shrink-0 text-stone-400 sm:block"/></NavLink>)}</div>
    </section>

    <section className="grid gap-4 xl:grid-cols-[.85fr_1.15fr]">
      <div className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm sm:p-5">
        <div className="flex items-start justify-between gap-2"><div><h2 className="text-base font-extrabold">Order Overview</h2><p className="mt-1 text-xs text-stone-500">Current order status across the restaurant.</p></div><span className="rounded-lg bg-brand-pale px-2.5 py-1.5 text-xs font-bold text-brand-burnt">{activeStatusCount} active</span></div>
        {Object.values(data.statuses).every(count => count === 0) ? <div className="mt-5 rounded-xl bg-stone-50 px-4 py-8 text-center"><p className="text-sm font-bold">No orders yet</p><p className="mt-1 text-xs text-stone-500">New orders will appear here.</p></div> : <div className="mt-4 divide-y divide-stone-100">{[['pending','Pending'],['accepted','Accepted'],['preparing','Preparing'],['ready','Ready'],['out_for_delivery','Out for delivery'],['delivered','Delivered'],['cancelled','Cancelled']].map(([status,label]) => <div key={status} className="flex items-center justify-between py-3"><span className="flex items-center gap-2.5 text-sm font-semibold text-stone-700"><StatusDot status={status}/>{label}</span><b className="text-sm tabular-nums">{data.statuses[status]}</b></div>)}</div>}
      </div>
      <section className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm sm:p-5">
        <div className="flex items-start justify-between gap-2"><div><h2 className="text-base font-extrabold">Revenue Overview</h2><p className="mt-1 text-xs text-stone-500">Daily revenue for the last 7 days.</p></div><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-pale text-brand-burnt"><Activity size={18}/></span></div>
        {data.hasRevenueData ? <div className="mt-4 h-56 w-full min-w-0"><Suspense fallback={<div className="h-full animate-pulse rounded-xl bg-stone-50"/>}><RevenueChart data={data.revenueByDay}/></Suspense></div> : <div className="mt-4 flex h-56 flex-col items-center justify-center rounded-xl bg-stone-50 text-center"><Activity size={23} className="text-stone-400"/><p className="mt-2 text-sm font-bold">No revenue data yet</p><p className="mt-1 text-xs text-stone-500">Completed sales will build this chart.</p></div>}
      </section>
    </section>

    <section className="grid gap-4 xl:grid-cols-[1.4fr_.6fr]">
      <div className="overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm">
        <div className="flex items-center justify-between gap-3 p-4 sm:p-5"><div><h2 className="text-base font-extrabold">Recent Orders</h2><p className="mt-1 text-xs text-stone-500">The latest customer orders.</p></div><NavLink to="/admin/orders" className="inline-flex min-h-10 items-center gap-1 rounded-lg px-2 text-xs font-bold text-brand-burnt hover:bg-brand-pale sm:px-3 sm:text-sm">View all <ArrowRight size={15}/></NavLink></div>
        {data.recentOrders.length ? <><div className="hidden grid-cols-[1.15fr_1.3fr_.8fr_1fr_auto] gap-3 border-y border-stone-100 bg-stone-50 px-5 py-3 text-[11px] font-bold uppercase tracking-wide text-stone-500 sm:grid"><span>Order</span><span>Customer</span><span>Amount</span><span>Status</span><span/></div><div className="divide-y divide-stone-100">{data.recentOrders.map(order => <RecentOrder key={order.id} order={order}/>)}</div></> : <div className="m-4 rounded-xl bg-stone-50 px-4 py-8 text-center"><p className="text-sm font-bold">No orders yet</p><p className="mt-1 text-xs text-stone-500">Customer orders will appear here.</p></div>}
      </div>
      <section className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm sm:p-5">
        <div><h2 className="text-base font-extrabold">Popular Foods</h2><p className="mt-1 text-xs text-stone-500">Most ordered dishes.</p></div>
        {data.popularFoods.length ? <ol className="mt-3 divide-y divide-stone-100">{data.popularFoods.map((food, index) => <li key={food.name} className="flex items-center gap-3 py-3"><span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-pale text-xs font-extrabold text-brand-burnt">{index + 1}</span><span className="min-w-0 flex-1"><b className="block truncate text-sm">{food.name}</b><small className="mt-0.5 block text-xs text-stone-500">{food.orders} ordered</small></span><ArrowDownRight size={16} className="text-brand-orange"/></li>)}</ol> : <div className="mt-4 rounded-xl bg-stone-50 px-4 py-7 text-center"><p className="text-sm font-bold">No food orders yet</p><p className="mt-1 text-xs text-stone-500">Popular dishes appear after orders come in.</p></div>}
      </section>
    </section>

    {(data.statuses.pending > 0 || data.outOfStock > 0 || activeStatusCount === 0) && <section aria-label="Restaurant alerts" className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm sm:p-5"><h2 className="text-base font-extrabold">Needs Attention</h2><div className="mt-3 flex flex-wrap gap-2">{data.statuses.pending > 0 && <span className="inline-flex items-center gap-2 rounded-lg bg-brand-pale px-3 py-2 text-xs font-semibold text-brand-burnt"><CircleAlert size={15}/>{data.statuses.pending} {data.statuses.pending === 1 ? 'order is' : 'orders are'} waiting for confirmation</span>}{data.outOfStock > 0 && <span className="inline-flex items-center gap-2 rounded-lg bg-red-50 px-3 py-2 text-xs font-semibold text-red-700"><CircleAlert size={15}/>{data.outOfStock} {data.outOfStock === 1 ? 'menu item is' : 'menu items are'} out of stock</span>}{data.statuses.pending === 0 && data.outOfStock === 0 && activeStatusCount === 0 && <span className="inline-flex items-center gap-2 rounded-lg bg-green-50 px-3 py-2 text-xs font-semibold text-green-700"><Check size={15}/>No active orders or stock alerts.</span>}</div></section>}
  </div>;
}

function StatCard({ title, value, detail, Icon, attention = false }: { title: string; value: string; detail: string; Icon: typeof ShoppingBag; attention?: boolean }) {
  return <article className="min-w-0 rounded-2xl border border-stone-200 bg-white p-4 shadow-sm sm:p-5"><div className="flex items-start justify-between gap-2"><p className="text-xs font-bold text-stone-500 sm:text-sm">{title}</p><span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${attention ? 'bg-brand-pale text-brand-burnt' : 'bg-stone-100 text-stone-600'}`}><Icon size={18}/></span></div><b className="mt-2 block truncate text-2xl font-black tracking-tight sm:text-3xl">{value}</b><p className={`mt-1 truncate text-[11px] sm:text-xs ${attention ? 'font-semibold text-brand-burnt' : 'text-stone-500'}`}>{detail}</p></article>;
}

function StatusDot({ status }: { status: string }) {
  const color = status === 'delivered' ? 'bg-green-600' : status === 'pending' ? 'bg-brand-orange' : status === 'cancelled' ? 'bg-red-600' : 'bg-brand-warm';
  return <span className={`h-2.5 w-2.5 rounded-full ${color}`} aria-hidden="true"/>;
}

function RecentOrder({ order }: { order: DashboardOrder }) {
  const labels: Record<string, string> = { pending: 'Pending', accepted: 'Accepted', preparing: 'Preparing', ready: 'Ready', out_for_delivery: 'Out for delivery', delivered: 'Delivered', cancelled: 'Cancelled' };
  const colors: Record<string, string> = { pending: 'bg-brand-pale text-brand-burnt', accepted: 'bg-orange-50 text-orange-800', preparing: 'bg-orange-50 text-orange-800', ready: 'bg-green-50 text-green-700', out_for_delivery: 'bg-green-50 text-green-700', delivered: 'bg-green-50 text-green-700', cancelled: 'bg-red-50 text-red-700' };
  return <NavLink to="/admin/orders" aria-label={`View order ${order.id.slice(0, 8)}`} className="grid grid-cols-1 gap-2 px-4 py-3 hover:bg-stone-50 sm:grid-cols-[1.15fr_1.3fr_.8fr_1fr_auto] sm:items-center sm:gap-3 sm:px-5">
    <span className="flex items-center justify-between gap-2 sm:block"><b className="text-xs font-extrabold">#{order.id.slice(0, 8).toUpperCase()}</b><small className="text-[11px] text-stone-500 sm:mt-1 sm:block">{format(new Date(order.created_at), 'MMM d, h:mm a')}</small></span>
    <span className="truncate text-xs text-stone-600">{order.address_snapshot?.full_name || 'Customer'}</span>
    <b className="text-sm">₹{Number(order.total).toLocaleString('en-IN')}</b>
    <span className={`w-fit rounded-full px-2.5 py-1 text-[10px] font-bold ${colors[order.status] ?? 'bg-stone-100 text-stone-600'}`}>{labels[order.status] ?? order.status}</span>
    <ArrowRight size={15} className="hidden text-stone-400 sm:block"/>
  </NavLink>;
}

function DashboardLoading() {
  return <div className="mx-auto max-w-[1440px] animate-pulse space-y-6"><div className="h-20 rounded-2xl bg-white"/><div className="grid grid-cols-2 gap-3 xl:grid-cols-4">{[0,1,2,3].map(item => <div key={item} className="h-32 rounded-2xl bg-white"/>)}</div><div className="h-64 rounded-2xl bg-white"/><div className="grid gap-4 xl:grid-cols-2"><div className="h-72 rounded-2xl bg-white"/><div className="h-72 rounded-2xl bg-white"/></div></div>;
}

function BackendSetupCard() {
  return <div className="mx-auto max-w-3xl rounded-2xl border border-stone-200 bg-white p-6 shadow-sm sm:p-9"><span className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-pale text-brand-burnt"><Activity size={22}/></span><p className="mt-5 text-xs font-extrabold uppercase tracking-[.16em] text-brand-burnt">Owner workspace setup</p><h1 className="mt-2 text-2xl font-black">Connect your restaurant backend</h1><p className="mt-2 max-w-xl text-sm leading-6 text-stone-600">Connect Supabase to see your live restaurant activity here.</p><ul className="mt-5 grid gap-3 text-sm text-stone-600 sm:grid-cols-2">{['Live orders','Revenue','Customers','Menu activity','Restaurant analytics'].map(item => <li key={item} className="flex items-center gap-2"><Check size={16} className="text-green-600"/>{item}</li>)}</ul><NavLink to="/admin/settings" className="mt-7 inline-flex min-h-11 items-center gap-2 rounded-xl bg-brand-orange px-5 py-3 text-sm font-bold text-white">Open settings <ArrowRight size={16}/></NavLink></div>;
}

function AdminHome() {
  return <div className="min-h-[65vh] rounded-3xl bg-white p-6 shadow-sm"><p className="text-xs font-bold uppercase tracking-widest text-brand-orange">Owner workspace</p><h1 className="mt-1 text-3xl font-black">Good day, Wolf Kaafe</h1><p className="mt-2 text-sm text-stone-500">Restaurant operations at a glance.</p><div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">{[['Today’s orders','0'],['Today’s revenue','₹0'],['Pending orders','0'],['Customers','0']].map(([x,y])=><div key={x} className="rounded-2xl bg-brand-pale p-4"><p className="text-xs text-stone-500">{x}</p><b className="mt-2 block text-2xl">{y}</b></div>)}</div><div className="mt-6 rounded-2xl border border-dashed border-stone-300 p-8 text-center"><p className="font-bold">Connect your Supabase project</p><p className="mt-1 text-sm text-stone-500">Live orders and analytics will appear here after backend setup.</p></div></div>;
}
