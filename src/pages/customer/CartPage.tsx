import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Minus, Plus, Trash2, ArrowRight, ShoppingBag } from 'lucide-react';
import { useStore } from '../../store/useStore';
import { useCartMenuSync } from '../../hooks/useCartMenuSync';
import { foodImageUrl, handleFoodItemImageError } from '../../utils/imageUrl';
import { getCartLineUnitPrice, getOriginalFoodBasePrice, hasFoodSizeVariants } from '../../utils/foodPricing';
import { getActiveHomeOfferDiscounts } from '../../services/homeOfferService';
import { useRestaurantSettings } from '../../hooks/useRestaurantSettings';

export function CartPage() {
  const cart = useStore(state => state.cart);
  const increment = useStore(state => state.increment);
  const remove = useStore(state => state.remove);
  const { isMenuLoading, isMenuError, refetchMenu, cartNotice } = useCartMenuSync();
  const settingsQuery = useRestaurantSettings();
  const settings = settingsQuery.data;
  const offerIds = [...new Set(cart.map(item => item.offerId).filter((id): id is string => Boolean(id)))].sort();
  const offerDiscounts = useQuery({ queryKey: ['cart-offer-discounts', offerIds], queryFn: () => getActiveHomeOfferDiscounts(offerIds), enabled: offerIds.length > 0, staleTime: 0, refetchOnWindowFocus: true });
  const lineTotal = (item: typeof cart[number]) => getCartLineUnitPrice(item, Date.now(), item.offerId ? offerDiscounts.data?.[item.offerId] ?? (offerDiscounts.isSuccess ? 0 : undefined) : undefined);
  const subtotal = cart.reduce((sum, item) => sum + lineTotal(item) * item.quantity, 0);
  const delivery = !subtotal ? 0 : settings ? subtotal >= settings.free_delivery_threshold ? 0 : settings.delivery_fee : undefined;
  const belowMinimum = Boolean(settings && subtotal > 0 && subtotal < settings.minimum_order);
  const restaurantClosed = settings ? !settings.is_open : false;
  const codUnavailable = settings ? !settings.cash_on_delivery_enabled : false;
  const unavailable = cart.some(item => !item.food.active || !item.food.available);
  const unavailableOffer = cart.some(item => item.offerId && offerDiscounts.isSuccess && !Object.prototype.hasOwnProperty.call(offerDiscounts.data ?? {}, item.offerId));
  const checkoutDisabled = settingsQuery.isLoading || settingsQuery.isError || !settings || restaurantClosed || codUnavailable || belowMinimum || isMenuLoading || isMenuError || unavailable || offerDiscounts.isLoading || offerDiscounts.isError || unavailableOffer;

  return <div className="mx-auto min-w-0 max-w-4xl"><p className="text-xs font-bold uppercase tracking-widest text-brand-orange">Your order</p><h1 className="mt-1 text-3xl font-black">My cart <span className="text-lg font-semibold text-stone-400">({cart.length} items)</span></h1>
    {!cart.length ? <div className="mt-8 rounded-3xl bg-white px-5 py-14 text-center shadow-sm"><ShoppingBag size={42} className="mx-auto text-brand-soft"/><h2 className="mt-4 text-lg font-bold">Your cart is looking a little hungry</h2><p className="mt-1 text-sm text-stone-500">Add something delicious to get started.</p><Link to="/menu" className="mt-5 inline-flex rounded-xl bg-brand-orange px-5 py-3 text-sm font-bold text-white">Browse menu</Link></div> : <div className="mt-6 grid min-w-0 gap-5 md:grid-cols-[minmax(0,1fr)_320px]">
      <div className="min-w-0 space-y-3">
        {settingsQuery.isError && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">Could not load current restaurant and delivery settings. <button type="button" onClick={() => void settingsQuery.refetch()} className="font-bold underline">Retry</button></p>}{restaurantClosed && <p role="status" className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">The restaurant is currently closed, so checkout is unavailable.</p>}{codUnavailable && <p role="status" className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">Cash on Delivery is currently unavailable.</p>}{belowMinimum && <p role="status" className="rounded-xl bg-brand-pale p-3 text-sm text-brand-burnt">Minimum order: ₹{settings?.minimum_order.toFixed(2)}.</p>}{cartNotice && <p role="status" className="rounded-xl border border-orange-200 bg-brand-pale p-3 text-sm text-brand-burnt">{cartNotice}</p>}{unavailableOffer && <p role="alert" className="rounded-xl bg-amber-50 p-3 text-sm text-amber-800">An offer in your cart has ended. Remove that item and add it again from an active offer.</p>}
        {isMenuError && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">Could not verify current food prices and availability. <button type="button" onClick={() => void refetchMenu()} className="font-bold underline">Retry</button></p>}
        {cart.map(item => <div key={item.key} className={`flex min-w-0 gap-3 rounded-2xl bg-white p-3 shadow-sm ${!item.food.available || !item.food.active ? 'ring-1 ring-red-200' : ''}`}>
          {item.food.image.trim() && <img src={foodImageUrl(item.food.image)} alt={item.food.name} onError={handleFoodItemImageError} className="h-20 w-20 shrink-0 rounded-xl bg-brand-pale object-contain object-center sm:h-24 sm:w-24"/>}
          <div className="min-w-0 flex-1"><div className="flex min-w-0 items-start justify-between gap-1"><div className="min-w-0"><b className="line-clamp-2 break-words text-sm">{item.food.name}</b>{(!item.food.active || !item.food.available) && <span className="mt-1 inline-block rounded-md bg-red-50 px-2 py-1 text-[10px] font-extrabold uppercase text-red-700">{item.food.active ? 'Out of stock' : 'No longer available'}</span>}</div><button aria-label={`Remove ${item.food.name}`} onClick={() => remove(item.key)} className="shrink-0 text-stone-400"><Trash2 size={16}/></button></div>
            {(hasFoodSizeVariants(item.food) || item.extras.length > 0) && <p className="mt-1 break-words text-xs text-stone-500">{hasFoodSizeVariants(item.food) ? item.size : ''}{item.extras.length ? `${hasFoodSizeVariants(item.food) ? ' · ' : ''}${item.extras.join(', ')}` : ''}</p>}{item.note && <p className="mt-1 break-words text-xs text-stone-500">Note: {item.note}</p>}
            {item.offerId && item.offerDiscountPercent ? <p className="mt-2 text-xs font-bold text-green-700">{offerDiscounts.data?.[item.offerId] ?? item.offerDiscountPercent}% OFF · Offer applied (menu price ₹{getOriginalFoodBasePrice(item.food,item.size).toFixed(2)})</p> : null}<div className="mt-3 flex flex-wrap items-center justify-between gap-2"><b>₹{(lineTotal(item) * item.quantity).toFixed(2)}</b><div className="flex shrink-0 items-center gap-1 rounded-lg border px-1"><button className="shrink-0" onClick={() => increment(item.key, -1)} aria-label={`Decrease ${item.food.name} quantity`}><Minus size={14}/></button><span className="min-w-5 text-center text-sm font-bold">{item.quantity}</span><button className="shrink-0 disabled:text-stone-300" disabled={!item.food.active || !item.food.available} onClick={() => increment(item.key, 1)} aria-label={`Increase ${item.food.name} quantity`}><Plus size={14}/></button></div></div>
          </div>
        </div>)}
        <Link to="/menu" className="inline-flex items-center gap-2 p-2 text-sm font-bold text-brand-burnt">+ Add more items</Link>
      </div>
      <div className="h-fit min-w-0 rounded-2xl bg-white p-5 shadow-sm"><h2 className="font-extrabold">Bill details</h2><div className="mt-4 space-y-3 text-sm"><div className="flex justify-between"><span className="text-stone-500">Item total</span><span>₹{subtotal.toFixed(2)}</span></div><div className="flex justify-between"><span className="text-stone-500">Delivery fee</span><span>{delivery === undefined ? '—' : delivery ? `₹${delivery.toFixed(2)}` : 'Free'}</span></div>{settings && subtotal < settings.free_delivery_threshold && <p className="rounded-lg bg-brand-pale p-2 text-xs text-brand-burnt">Add ₹{Math.max(0, settings.free_delivery_threshold - subtotal).toFixed(2)} more for free delivery</p>}{belowMinimum && settings && <p className="text-xs text-brand-burnt">Minimum order value is ₹{settings.minimum_order.toFixed(2)}.</p>}{settings && <p className="text-xs text-stone-500">Estimated delivery: {settings.estimated_delivery_minutes} minutes</p>}<div className="border-t pt-3"><div className="flex justify-between font-extrabold"><span>Grand total</span><span>{delivery === undefined ? '—' : `₹${(subtotal + delivery).toFixed(2)}`}</span></div></div></div>
        {checkoutDisabled ? <button type="button" disabled className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-stone-300 py-4 text-sm font-extrabold text-white">{settingsQuery.isLoading ? 'Loading restaurant settings…' : restaurantClosed ? 'Restaurant is closed' : codUnavailable ? 'Checkout unavailable' : belowMinimum ? 'Minimum order not met' : isMenuLoading || offerDiscounts.isLoading ? 'Checking current prices…' : unavailableOffer ? 'Remove expired offer items' : unavailable ? 'Remove unavailable items' : 'Price check unavailable'}</button> : <Link to="/checkout" className="mt-5 flex items-center justify-center gap-2 rounded-xl bg-brand-orange py-4 text-sm font-extrabold text-white">Proceed to checkout <ArrowRight size={17}/></Link>}
        <p className="mt-3 text-center text-[11px] text-stone-400">Secure checkout · Cash on Delivery</p>
      </div>
    </div>}
  </div>;
}
