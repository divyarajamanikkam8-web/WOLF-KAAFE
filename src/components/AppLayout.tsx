import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { Home, Search, ClipboardList, ShoppingBag, UserRound, MapPin, ChevronDown, Menu as MenuIcon, X } from 'lucide-react';
import { useState } from 'react';
import { useStore } from '../store/useStore';
import { useRestaurantSettings } from '../hooks/useRestaurantSettings';

const nav = [{ to: '/home', label: 'Home', Icon: Home }, { to: '/search', label: 'Search', Icon: Search }, { to: '/orders', label: 'Orders', Icon: ClipboardList }, { to: '/cart', label: 'Cart', Icon: ShoppingBag }, { to: '/profile', label: 'Profile', Icon: UserRound }];
const entryRoutes = ['/', '/onboarding', '/login', '/register', '/forgot-password', '/reset-password'];

export function AppLayout() {
  const { pathname } = useLocation();
  const isEntryScreen = entryRoutes.includes(pathname);
  const isFocusedSearch = pathname === '/search';
  const count = useStore(state => state.cart.reduce((total, item) => total + item.quantity, 0));
  const settingsQuery = useRestaurantSettings();
  const settings = settingsQuery.data;
  const [open, setOpen] = useState(false);

  return <div className={`min-h-screen w-full min-w-0 overflow-x-clip bg-stone-50 text-stone-900 ${isFocusedSearch ? '' : 'pb-20 md:pb-0'}`}>
    {pathname !== '/' && !isFocusedSearch && <header className="sticky top-0 z-30 w-full border-b border-stone-100 bg-white/95 pt-[env(safe-area-inset-top)] backdrop-blur"><div className="mx-auto flex min-h-16 w-full max-w-7xl min-w-0 items-center justify-between gap-2 px-3 py-2 sm:px-4 md:px-8">
      <NavLink to="/" aria-label={`${settings?.restaurant_name ?? 'The Wolf Kaafe'} home`} className="flex min-w-0 flex-1 items-center sm:flex-none"><img src={settings?.logo_url || '/images/wolf-kaafe-logo.png'} alt={settings?.restaurant_name ?? 'The Wolf Kaafe'} className="h-12 w-14 shrink-0 object-contain sm:h-14 sm:w-[4.5rem]"/><span className="ml-1 min-w-0 leading-tight"><b className="block truncate text-[12px] tracking-[.035em] min-[375px]:text-sm sm:tracking-wide">{settings?.restaurant_name ?? 'THE WOLF KAAFE'}</b><small className="block break-words text-[8px] uppercase tracking-[.12em] text-stone-500 min-[375px]:text-[9px] sm:text-[10px] sm:tracking-[.22em]">{settings ? settings.is_open ? `Open · ${formatTime(settings.opening_time)}–${formatTime(settings.closing_time)}` : 'Currently closed' : settingsQuery.isError ? 'Restaurant information unavailable' : 'Good food. Good mood.'}</small></span></NavLink>
      {!isEntryScreen && !isFocusedSearch && <nav className="hidden items-center gap-7 md:flex">{nav.slice(0,3).map(({to,label})=><NavLink key={to} to={to} className={({isActive})=>`text-sm font-semibold ${isActive?'text-brand-orange':'text-stone-600 hover:text-stone-950'}`}>{label}</NavLink>)}</nav>}
      {!isEntryScreen && <div className="flex shrink-0 items-center gap-1 sm:gap-2"><button className="hidden items-center gap-2 rounded-xl bg-stone-50 px-3 py-2 text-left text-xs sm:flex"><MapPin size={16} className="text-brand-orange"/><span><small className="block text-stone-400">Deliver to</small><b>Home</b></span><ChevronDown size={14}/></button><NavLink to="/cart" aria-label={`Cart${count ? `, ${count} items` : ''}`} className="relative flex items-center justify-center rounded-xl bg-brand-pale p-2.5 text-brand-burnt sm:p-3"><ShoppingBag size={19}/>{count>0&&<span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-brand-orange px-1 text-[10px] font-bold text-white">{count}</span>}</NavLink><button aria-label={open?'Close menu':'Open menu'} onClick={()=>setOpen(!open)} className="rounded-xl border p-2.5 md:hidden">{open?<X size={18}/>:<MenuIcon size={18}/>}</button></div>}
    </div>{open&&<div className="grid grid-cols-2 gap-2 border-t p-4 md:hidden">{nav.map(({to,label,Icon})=><NavLink onClick={()=>setOpen(false)} key={to} to={to} className="flex items-center gap-2 rounded-xl p-3 text-sm"><Icon size={17}/>{label}</NavLink>)}</div>}</header>}
    <main className={`mx-auto min-w-0 max-w-7xl overflow-x-clip ${isFocusedSearch ? 'px-4 py-0' : 'px-4 py-5 md:px-8 md:py-8'}`}><Outlet/></main>
    {!isEntryScreen && !isFocusedSearch && <nav className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t border-stone-200 bg-white px-2 pb-[max(.4rem,env(safe-area-inset-bottom))] pt-2 md:hidden">{nav.map(({to,label,Icon})=><NavLink key={to} to={to} className={({isActive})=>`relative flex flex-col items-center gap-1 py-1 text-[10px] font-semibold ${isActive?'text-brand-orange':'text-stone-400'}`}><Icon size={20} strokeWidth={2.1}/>{label}{to==='/cart'&&count>0&&<span className="absolute right-5 top-0 h-2 w-2 rounded-full bg-brand-orange"/>}</NavLink>)}</nav>}
    {!isEntryScreen && !isFocusedSearch && <footer className="hidden border-t border-stone-200 bg-white md:block"><div className="mx-auto flex max-w-7xl flex-wrap justify-between gap-3 px-8 py-6 text-xs text-stone-500"><span>© 2026 {settings?.restaurant_name ?? 'THE WOLF KAAFE'} · Fresh food, made with care.</span><span className="flex flex-wrap gap-x-4 gap-y-1">{settings?.phone && <a href={`tel:${settings.phone}`}>{settings.phone}</a>}{settings?.email && <a href={`mailto:${settings.email}`}>{settings.email}</a>}{settings?.address && <span>{settings.address}</span>}{settings && <span>{settings.cash_on_delivery_enabled ? 'Cash on Delivery available' : 'Ordering currently unavailable'}</span>}</span></div></footer>}
  </div>;
}

function formatTime(time: string | null) {
  if (!time) return 'hours not set';
  const [hourText, minuteText] = time.split(':');
  const date = new Date();
  date.setHours(Number(hourText), Number(minuteText), 0, 0);
  return new Intl.DateTimeFormat('en-IN', { hour: 'numeric', minute: '2-digit' }).format(date);
}
