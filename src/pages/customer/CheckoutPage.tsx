import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { MapPin, Banknote, ChevronRight, LoaderCircle, Pencil, X } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { useStore } from '../../store/useStore';
import { createCodOrder, type DeliveryAddressInput } from '../../services/orderService';
import { getCustomerDefaultAddress } from '../../services/customerAddressService';
import { useCartMenuSync } from '../../hooks/useCartMenuSync';
import { useCustomerProfile } from '../../hooks/useCustomerProfile';
import { supabase } from '../../lib/supabase';
import { getCartLineUnitPrice, getFoodBasePrice, getOriginalFoodBasePrice, hasFoodSizeVariants } from '../../utils/foodPricing';
import { getActiveHomeOfferDiscounts } from '../../services/homeOfferService';
import { useRestaurantSettings } from '../../hooks/useRestaurantSettings';

const initialAddress: DeliveryAddressInput = { full_name: '', phone: '', house: '', street: '', area: '', city: '', pincode: '', landmark: '' };
const fields: { key: keyof DeliveryAddressInput; label: string; required?: boolean }[] = [
  { key: 'full_name', label: 'Full name', required: true }, { key: 'phone', label: 'Phone number', required: true },
  { key: 'house', label: 'House / Flat', required: true }, { key: 'street', label: 'Street', required: true },
  { key: 'area', label: 'Area', required: true }, { key: 'city', label: 'City', required: true },
  { key: 'pincode', label: 'Pincode', required: true }, { key: 'landmark', label: 'Landmark' },
];

export function CheckoutPage() {
  const cart = useStore(s => s.cart), clear = useStore(s => s.clear);
  const navigate = useNavigate();
  const { user, authReady } = useCustomerProfile();
  const settingsQuery = useRestaurantSettings();
  const settings = settingsQuery.data;
  const { foods, isMenuLoading, isMenuError, refetchMenu, cartNotice } = useCartMenuSync();
  const offerIds = [...new Set(cart.map(item => item.offerId).filter((id): id is string => Boolean(id)))].sort();
  const offerDiscounts = useQuery({ queryKey: ['cart-offer-discounts', offerIds], queryFn: () => getActiveHomeOfferDiscounts(offerIds), enabled: offerIds.length > 0, staleTime: 0, refetchOnWindowFocus: true });
  const lineTotal = (item: typeof cart[number]) => getCartLineUnitPrice(item, Date.now(), item.offerId ? offerDiscounts.data?.[item.offerId] ?? (offerDiscounts.isSuccess ? 0 : undefined) : undefined);
  const savedAddressQuery = useQuery({
    queryKey: ['customer-default-address', user?.id],
    queryFn: () => getCustomerDefaultAddress(user!.id),
    enabled: authReady && Boolean(user) && Boolean(supabase),
    staleTime: 0,
    refetchOnMount: 'always',
  });
  const [address, setAddress] = useState(initialAddress);
  const [addressOwnerId, setAddressOwnerId] = useState<string | null>(null);
  const [editingAddress, setEditingAddress] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    setAddress(initialAddress);
    setAddressOwnerId(user?.id ?? null);
    setEditingAddress(true);
    setError('');
  }, [user?.id]);
  useEffect(() => {
    if (!savedAddressQuery.isSuccess) return;
    const saved = savedAddressQuery.data;
    setAddress(saved ? {
      full_name: saved.full_name,
      phone: saved.phone,
      house: saved.house,
      street: saved.street,
      area: saved.area,
      city: saved.city,
      pincode: saved.pincode,
      landmark: saved.landmark ?? '',
    } : initialAddress);
    setEditingAddress(!saved);
  }, [savedAddressQuery.data, savedAddressQuery.isSuccess]);
  const subtotal = cart.reduce((n, i) => n + lineTotal(i) * i.quantity, 0);
  const fee = settings ? subtotal >= settings.free_delivery_threshold ? 0 : settings.delivery_fee : undefined;
  const belowMinimum = Boolean(settings && subtotal < settings.minimum_order);
  const ready = fields.filter(f => f.required).every(f => address[f.key]?.trim()) && address.phone.replace(/\D/g, '').length >= 10 && /^\d{6}$/.test(address.pincode);
  const unavailable = !settings || !settings.is_open || !settings.cash_on_delivery_enabled || cart.some(item => !item.food.active || !item.food.available) || cart.some(item => item.offerId && offerDiscounts.isSuccess && !Object.prototype.hasOwnProperty.call(offerDiscounts.data ?? {}, item.offerId));
  const update = (key: keyof DeliveryAddressInput, value: string) => setAddress(current => ({ ...current, [key]: value }));
  const savedAddress = savedAddressQuery.data;
  const cancelAddressEdit = () => {
    if (!savedAddress) return;
    setAddress({
      full_name: savedAddress.full_name,
      phone: savedAddress.phone,
      house: savedAddress.house,
      street: savedAddress.street,
      area: savedAddress.area,
      city: savedAddress.city,
      pincode: savedAddress.pincode,
      landmark: savedAddress.landmark ?? '',
    });
    setEditingAddress(false);
  };

  async function placeOrder() {
    if (isMenuLoading || isMenuError || !foods) { setError('Could not verify current menu prices. Please retry before placing your order.'); return; }
    setBusy(true); setError('');
    try {
      const latestSettings = await settingsQuery.refetch();
      if (latestSettings.isError || !latestSettings.data) {
        setError('Could not verify current restaurant and delivery settings. Retry before placing your order.');
        return;
      }
      if (!latestSettings.data.is_open) { setError('The restaurant is currently closed.'); return; }
      if (!latestSettings.data.cash_on_delivery_enabled) { setError('Cash on Delivery is currently unavailable.'); return; }
      if (subtotal < latestSettings.data.minimum_order) { setError(`The minimum order is ₹${latestSettings.data.minimum_order.toFixed(2)}.`); return; }
      const expectedDeliveryFee = subtotal >= latestSettings.data.free_delivery_threshold ? 0 : latestSettings.data.delivery_fee;
      if (fee === undefined || expectedDeliveryFee !== fee) {
        setError('Delivery settings changed. Review the updated checkout total and try again.');
        return;
      }
      const latestOffers = offerIds.length ? await offerDiscounts.refetch() : null;
      if (latestOffers?.isError || (latestOffers?.data && cart.some(item => item.offerId && !Object.prototype.hasOwnProperty.call(latestOffers.data, item.offerId)))) {
        setError('An offer in your cart has ended or is unavailable. Return to the cart and add an active offer again.');
        return;
      }
      const activeDiscounts = latestOffers?.data ?? offerDiscounts.data ?? {};
      const currentLinePrice = (item: typeof cart[number]) => getCartLineUnitPrice(item, Date.now(), item.offerId ? activeDiscounts[item.offerId] : undefined);
      if (cart.some(item => item.offerId && activeDiscounts[item.offerId] !== undefined && activeDiscounts[item.offerId] !== item.offerDiscountPercent)) {
        setError('An offer discount changed. Review the updated total and place your order again.');
        return;
      }
      // Checkout must use the latest database state, even if the cached menu is
      // still inside its normal stale-time window.
      const latestMenu = await refetchMenu();
      if (latestMenu.isError || !latestMenu.data) {
        setError('Could not verify current food availability. Retry before placing your order.');
        return;
      }
      const currentFoods = new Map(latestMenu.data.map(food => [food.id, food]));
      const unavailableItem = cart.some(item => {
        const current = currentFoods.get(item.food.id);
        return !current || !current.active || !current.available;
      });
      if (unavailableItem) {
        setError('The latest menu shows one or more cart items as unavailable. Remove them or choose another food.');
        return;
      }
      const changedPrice = cart.some(item => {
        const current = currentFoods.get(item.food.id);
        return !current || getFoodBasePrice(current, item.size) !== getFoodBasePrice(item.food, item.size);
      });
      if (changedPrice) {
        setError('A food price changed. Your cart has been refreshed; review the new total and place your order again.');
        return;
      }
      const submittedAddress: DeliveryAddressInput = {
        full_name: address.full_name.trim(),
        phone: address.phone.trim(),
        house: address.house.trim(),
        street: address.street.trim(),
        area: address.area.trim(),
        city: address.city.trim(),
        pincode: address.pincode.trim(),
        landmark: address.landmark?.trim() ?? '',
      };
      const order = await createCodOrder(submittedAddress, cart.map(item => ({
        food_item_id: item.food.id,
        quantity: item.quantity,
        client_price: currentLinePrice(item),
        offer_id: item.offerId ?? null,
        size: item.size,
        extras: item.extras,
        note: item.note,
      })), expectedDeliveryFee);
      if (!user) throw new Error('Your session changed. Sign in again before continuing.');
      sessionStorage.setItem(`wolf-last-order-${user.id}`, JSON.stringify({ ...order, address: `${submittedAddress.house}, ${submittedAddress.street}, ${submittedAddress.area}, ${submittedAddress.city} ${submittedAddress.pincode}` }));
      clear();
      navigate('/order-success', { state: { orderId: order.id } });
    } catch (err) {
      const message = err instanceof Error ? err.message : typeof err === 'object' && err && 'message' in err ? String(err.message) : 'Unable to place order. Please try again.';
      if (message.toLowerCase().includes('sign in')) navigate('/login', { state: { from: '/checkout' } });
      if (message.toLowerCase().includes('price') && message.toLowerCase().includes('changed')) {
        await refetchMenu();
        setError('A food price changed. Your cart has been refreshed; review the new total and place your order again.');
      } else if (message.toLowerCase().includes('unavailable')) {
        const refreshedMenu = await refetchMenu();
        if (!refreshedMenu.data) {
          setError('Supabase rejected the order, and the latest menu could not be loaded. Check your connection and retry.');
        } else {
          const latestFoods = new Map(refreshedMenu.data.map(food => [food.id, food]));
          const unavailableNames = cart
            .filter(item => {
              const current = latestFoods.get(item.food.id);
              return !current || !current.active || !current.available;
            })
            .map(item => item.food.name);

          if (unavailableNames.length) {
            setError(`${unavailableNames.join(', ')} ${unavailableNames.length === 1 ? 'is' : 'are'} unavailable in the current Supabase menu. Remove ${unavailableNames.length === 1 ? 'this item' : 'these items'} or ask the owner to mark ${unavailableNames.length === 1 ? 'it' : 'them'} available.`);
          } else {
            const names = cart.map(item => item.food.name).join(', ');
            setError(`The customer menu shows ${names} as available, but Supabase rejected the order. Check that this food has is_active=true and is_available=true, and that the latest 202610020004_cod_price_guard.sql function is installed in Supabase.`);
          }
        }
      } else setError(message);
    } finally { setBusy(false); }
  }

  if (!authReady) return <p role="status" className="rounded-2xl bg-white p-6 text-sm text-stone-500">Checking your account…</p>;
  if (!user) return <div className="mx-auto max-w-xl rounded-3xl bg-white p-8 text-center shadow-sm"><h1 className="text-xl font-black">Sign in to checkout</h1><p className="mt-2 text-sm text-stone-500">Your orders and saved address are kept with your account.</p><Link to="/login" state={{ from: '/checkout' }} className="mt-5 inline-flex min-h-11 items-center rounded-xl bg-brand-orange px-5 text-sm font-bold text-white">Sign in</Link></div>;
  if (addressOwnerId !== user.id) return <p role="status" className="rounded-2xl bg-white p-6 text-sm text-stone-500">Loading your checkout…</p>;
  if (savedAddressQuery.isLoading) return <p role="status" className="rounded-2xl bg-white p-6 text-sm text-stone-500">Loading your checkout…</p>;
  if (settingsQuery.isLoading) return <p role="status" className="rounded-2xl bg-white p-6 text-sm text-stone-500">Loading current restaurant settings…</p>;
  if (settingsQuery.isError || !settings) return <div role="alert" className="rounded-2xl bg-red-50 p-5 text-sm text-red-700">Could not load current restaurant and delivery settings. <button type="button" onClick={() => void settingsQuery.refetch()} className="font-bold underline">Retry</button></div>;
  if (!cart.length) return <div className="rounded-3xl bg-white p-10 text-center">Your cart is empty. <Link className="text-brand-orange" to="/menu">Browse menu</Link></div>;
  return <div className="mx-auto max-w-3xl">
    <p className="text-xs font-bold uppercase tracking-widest text-brand-orange">Almost there</p><h1 className="mt-1 text-3xl font-black">Checkout</h1>
    <div className="mt-6 space-y-4">
      <section className="rounded-2xl bg-white p-5 shadow-sm"><h2 className="flex items-center gap-2 font-extrabold"><MapPin className="text-brand-orange" size={19}/> Delivery address</h2>
        {authReady && user && savedAddressQuery.isLoading ? <p role="status" className="mt-4 flex items-center gap-2 text-sm text-stone-500"><LoaderCircle size={16} className="animate-spin"/>Loading your saved address…</p> : savedAddress && !editingAddress ? <div className="mt-4 rounded-xl border border-stone-200 bg-stone-50 p-4">
          <div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="font-bold">{savedAddress.full_name}</p><p className="mt-1 text-sm text-stone-600">{savedAddress.phone}</p><p className="mt-2 text-sm leading-5 text-stone-600">{[savedAddress.house, savedAddress.street, savedAddress.area, savedAddress.city, savedAddress.pincode, savedAddress.landmark].filter(Boolean).join(', ')}</p></div><button type="button" onClick={() => setEditingAddress(true)} className="inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-lg border border-stone-200 bg-white px-3 text-xs font-bold text-stone-700 hover:bg-stone-100"><Pencil size={14}/>Edit address</button></div>
          <p className="mt-3 text-[11px] text-stone-500">This saved address will be used for your order.</p>
        </div> : <>
          {savedAddress && <button type="button" onClick={cancelAddressEdit} className="mt-3 inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-stone-200 px-3 text-xs font-bold text-stone-600 hover:bg-stone-50"><X size={14}/>Keep saved address</button>}
          {savedAddressQuery.isError && <p role="alert" className="mt-3 rounded-xl bg-amber-50 p-3 text-xs text-amber-800">We couldn’t load your saved address. Enter it below; your order will save it for next time.</p>}
          <div className="mt-4 grid gap-3 sm:grid-cols-2">{fields.map(field=><input key={field.key} value={address[field.key] ?? ''} onChange={e=>update(field.key,e.target.value)} placeholder={`${field.label}${field.required?' *':''}`} aria-label={field.label} className="min-h-11 rounded-xl border border-stone-200 p-3 text-sm focus:border-brand-orange focus:outline-none"/> )}</div>
          {!savedAddress && <p className="mt-3 text-[11px] text-stone-500">Your address will be saved to your account after your first order.</p>}
        </>}
      </section>
      {cartNotice && <p role="status" className="rounded-xl border border-orange-200 bg-brand-pale p-3 text-sm text-brand-burnt">{cartNotice}</p>}
      {isMenuError && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">Could not verify current menu prices. <button type="button" onClick={() => void refetchMenu()} className="font-bold underline">Retry</button></p>}
      <section className="rounded-2xl bg-white p-5 shadow-sm"><h2 className="font-extrabold">Order summary <span className="font-normal text-stone-400">({cart.reduce((n,i)=>n+i.quantity,0)} items)</span></h2>{cart.map(i=><div key={i.key} className="mt-3 flex justify-between gap-3 text-sm"><span>{i.quantity} × {i.food.name}{hasFoodSizeVariants(i.food) ? ` · ${i.size}` : ''}{i.extras.length ? ` · ${i.extras.join(', ')}` : ''}{i.offerId && i.offerDiscountPercent ? <small className="block text-green-700">Menu ₹{getOriginalFoodBasePrice(i.food,i.size).toFixed(2)} · {offerDiscounts.data?.[i.offerId] ?? i.offerDiscountPercent}% OFF</small> : null}{(!i.food.active || !i.food.available) && <b className="ml-2 text-xs text-red-700">Unavailable</b>}</span><span>₹{(lineTotal(i)*i.quantity).toFixed(2)}</span></div>)}</section>
      <section className="rounded-2xl bg-white p-5 shadow-sm"><h2 className="font-extrabold">Payment method</h2>{settings.cash_on_delivery_enabled ? <div className="mt-3 flex items-center gap-3 rounded-xl border border-brand-orange bg-brand-pale p-4"><Banknote className="text-brand-burnt"/><span className="flex-1"><b className="block text-sm">Cash on Delivery</b><small className="text-stone-500">Pay in cash when your order arrives</small></span><span className="h-4 w-4 rounded-full border-[5px] border-brand-orange"/></div> : <p className="mt-3 rounded-xl bg-amber-50 p-4 text-sm text-amber-900">Cash on Delivery is currently unavailable. Online payment is not configured.</p>}</section>
      <section className="rounded-2xl bg-white p-5 shadow-sm"><h2 className="font-extrabold">Price summary</h2><div className="mt-3 space-y-2 text-sm"><div className="flex justify-between"><span className="text-stone-500">Subtotal</span><span>₹{subtotal.toFixed(2)}</span></div><div className="flex justify-between"><span className="text-stone-500">Delivery fee</span><span>{fee === undefined ? '—' : fee ? `₹${fee.toFixed(2)}` : 'Free'}</span></div>{belowMinimum && <p className="text-xs text-brand-burnt">Minimum order value is ₹{settings.minimum_order.toFixed(2)}.</p>}<p className="text-xs text-stone-500">Estimated delivery: {settings.estimated_delivery_minutes} minutes</p><div className="flex justify-between border-t pt-3 text-base font-black"><span>Total</span><span>{fee === undefined ? '—' : `₹${(subtotal + fee).toFixed(2)}`}</span></div></div></section>
      {error&&<p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      <button disabled={!ready||busy||belowMinimum||fee === undefined||isMenuLoading||isMenuError||unavailable||offerDiscounts.isLoading||offerDiscounts.isError} onClick={()=>void placeOrder()} className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-brand-orange py-4 font-extrabold text-white disabled:cursor-not-allowed disabled:opacity-50">{busy?'Placing order…':belowMinimum?'Minimum order not met':!settings.is_open?'Restaurant is closed':!settings.cash_on_delivery_enabled?'Cash on Delivery unavailable':isMenuLoading||offerDiscounts.isLoading?'Checking current prices…':unavailable?'Remove unavailable or expired offers':offerDiscounts.isError?'Could not verify offer prices':fee === undefined?'Delivery settings unavailable':`Place order · ₹${(subtotal + fee).toFixed(2)}`} <ChevronRight size={18}/></button>
      <p className="text-center text-xs text-stone-400">By placing your order, you agree to our terms.</p>
    </div>
  </div>;
}
