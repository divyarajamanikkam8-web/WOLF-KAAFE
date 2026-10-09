import { ArrowRight, Search, Sparkles, Flame, Clock3 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { FoodCard } from '../../components/FoodCard';
import { useMenu } from '../../hooks/useMenu';
import { useCategories } from '../../hooks/useCategories';
import { HorizontalRail } from '../../components/HorizontalRail';
import { foodImageUrl, handleFoodImageError, handleFoodItemImageError } from '../../utils/imageUrl';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { getMyOrders } from '../../services/orderService';
import { useCustomerOrdersRealtime } from '../../hooks/useCustomerOrdersRealtime';
import { getActiveHomeSpecialOffer } from '../../services/homeOfferService';
import { useCustomerProfile } from '../../hooks/useCustomerProfile';
import { useRestaurantSettings } from '../../hooks/useRestaurantSettings';

export function HomePage() {
  const restaurantSettings = useRestaurantSettings();
  const { data: menu = [], isLoading: menuLoading, isError: menuError, refetch: retryMenu } = useMenu();
  const { data: categories = [] } = useCategories();
  const [selectedCategory, setSelectedCategory] = useState('all');
  const homeOffer = useQuery({ queryKey: ['home-special-offer'], queryFn: getActiveHomeSpecialOffer, staleTime: 0, refetchOnMount: 'always', refetchOnWindowFocus: true, refetchOnReconnect: true, refetchInterval: 60_000 });
  const navigate = useNavigate();
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const visibleFoods = selectedCategory === 'all' ? menu : menu.filter(food => food.categoryId === selectedCategory);

  return <div className="min-w-0 space-y-8 md:space-y-10">
    <HomeDeliveredReviewNotice/>
    {restaurantSettings.isError && <p role="alert" className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">Restaurant information is temporarily unavailable. Checkout will verify the latest settings before an order is placed.</p>}
    {restaurantSettings.data && <section role="status" className={`flex flex-wrap items-center justify-between gap-2 rounded-2xl px-4 py-3 text-sm ${restaurantSettings.data.is_open ? 'bg-green-50 text-green-800' : 'bg-amber-50 text-amber-900'}`}><span className="font-bold">{restaurantSettings.data.is_open ? `Open now · Estimated delivery ${restaurantSettings.data.estimated_delivery_minutes} minutes` : 'The restaurant is currently closed'}</span><span className="text-xs">{restaurantSettings.data.opening_time && restaurantSettings.data.closing_time ? `Hours ${restaurantSettings.data.opening_time.slice(0, 5)}–${restaurantSettings.data.closing_time.slice(0, 5)}` : ''}</span></section>}
    <section className="min-w-0"><p className="mb-1 text-sm font-semibold text-brand-burnt">{greeting}</p><h1 className="max-w-xl text-3xl font-black leading-tight tracking-tight sm:text-4xl md:text-5xl">What are you <span className="text-brand-orange">craving</span> today?</h1><p className="mt-3 text-sm text-stone-500">Big flavours, made fresh and delivered to your door.</p><button type="button" onClick={()=>navigate('/search')} aria-label="Search food or category" className="mt-5 flex min-h-12 w-full max-w-xl items-center gap-2 rounded-2xl border border-stone-200 bg-white p-2 text-left shadow-sm"><Search className="ml-2 shrink-0 text-stone-400" size={19}/><span className="min-w-0 flex-1 truncate px-1 py-2 text-sm text-stone-400">Search burgers, biriyani, pizza...</span><span className="rounded-xl bg-brand-orange px-4 py-2.5 text-sm font-bold text-white">Search</span></button></section>
    {homeOffer.data && <section aria-label="Featured offers" className="grid min-w-0 grid-cols-1 gap-3">
      <div className="relative isolate flex min-h-[160px] min-w-0 items-center overflow-hidden rounded-3xl bg-[linear-gradient(115deg,#1b1110_0%,#3a1b14_54%,#863411_100%)] px-3 py-3 text-white shadow-lg shadow-orange-950/15 sm:min-h-[170px] sm:px-5 sm:py-4">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_76%_50%,rgba(251,146,60,.28),transparent_43%)]"/>
        <div className="absolute right-[10%] top-[18%] h-36 w-36 rounded-full bg-orange-500/25 blur-3xl sm:h-48 sm:w-48"/>
        <div className="absolute right-5 top-5 h-24 w-24 rounded-full border border-orange-100/10 sm:right-8 sm:top-8 sm:h-36 sm:w-36"/>
        <div className="absolute right-12 top-12 h-2 w-2 rounded-full bg-orange-100/60 shadow-[0_0_14px_rgba(255,237,213,.75)] sm:right-16 sm:top-16"/>
        <div className="relative z-20 max-w-[56%] sm:max-w-[54%]">
          <span className="inline-flex items-center gap-1 rounded-full border border-amber-200/35 bg-[#5b2b18]/75 px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-[.13em] text-orange-50 shadow-sm shadow-orange-950/20 sm:text-[11px]"><Sparkles size={12}/> {homeOffer.data.title}</span>
          {(homeOffer.data.discount_percentage > 0 || homeOffer.data.discount_text) && <h2 className="mt-2 text-2xl font-black leading-none tracking-tight text-orange-200 sm:mt-2.5 sm:text-[28px]">{homeOffer.data.discount_percentage > 0 ? `${homeOffer.data.discount_percentage}% OFF` : homeOffer.data.discount_text}</h2>}
          <p className="mt-1.5 text-[11px] leading-snug text-orange-50/80 sm:mt-2 sm:text-xs">On selected favourites</p>
          <button type="button" onClick={() => navigate(`/offers/${homeOffer.data!.id}`)} className="mt-2 inline-flex min-h-9 items-center gap-1.5 rounded-[11px] border border-white/15 bg-brand-orange px-2.5 py-1.5 text-xs font-bold text-white shadow-md shadow-orange-950/30 transition duration-200 hover:-translate-y-0.5 hover:bg-orange-500 active:scale-[.98] sm:mt-2.5 sm:px-3 sm:text-[13px]">{homeOffer.data.button_text} <ArrowRight size={14}/></button>
        </div>
        {homeOffer.data.video_url ? <div className="absolute inset-y-0 right-0 z-10 w-[45%] overflow-hidden sm:w-[48%]">
          <div className="absolute right-0 top-1/2 h-4/5 w-4/5 -translate-y-1/2 rounded-full bg-orange-500/30 blur-3xl"/>
          <video src={homeOffer.data.video_url} autoPlay muted loop playsInline aria-label={homeOffer.data.heading} className="home-offer-video absolute inset-0 h-full w-full"/>
          <div aria-hidden="true" className="home-offer-video-blend absolute inset-0 z-10"/>
        </div> : homeOffer.data.image_url ? <div className="absolute inset-y-0 right-0 z-10 flex w-[36%] max-w-56 items-center justify-center py-2 sm:w-[34%] sm:py-3"><img src={homeOffer.data.image_url} alt={homeOffer.data.heading} className="relative z-10 h-full w-full object-contain object-center"/></div> : null}
      </div>
    </section>}
    <section aria-label="Today's Special" className="relative isolate flex min-h-[180px] min-w-0 items-center overflow-hidden rounded-3xl border border-white/5 bg-[linear-gradient(112deg,#1b1110_0%,#2c1915_55%,#4a2116_100%)] px-3 py-3 text-white shadow-lg shadow-orange-950/10 sm:min-h-[188px] sm:px-5 sm:py-4">
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_76%_48%,rgba(249,115,22,.3),transparent_44%)]"/>
      <div className="absolute right-[8%] top-1/2 h-36 w-36 -translate-y-1/2 rounded-full bg-orange-500/20 blur-3xl sm:h-48 sm:w-48"/>
      <div className="absolute right-8 top-5 h-24 w-24 rounded-full border border-orange-100/10 sm:right-12 sm:top-6 sm:h-36 sm:w-36"/>
      <div className="absolute right-16 top-8 h-1.5 w-1.5 rounded-full bg-orange-100/70 shadow-[0_0_12px_rgba(255,237,213,.8)] sm:right-24 sm:top-10"/>
      <div className="absolute right-10 bottom-8 h-1 w-1 rounded-full bg-amber-100/50 shadow-[0_0_10px_rgba(255,237,213,.65)]"/>
      <div className="relative z-20 max-w-[62%] sm:max-w-[55%]">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-orange-200/25 bg-orange-400/20 px-3 py-1.5 text-[9px] font-extrabold uppercase tracking-[.16em] text-orange-100 shadow-sm shadow-orange-950/25 sm:text-[10px]"><Sparkles size={13}/> Today’s Special</span>
        <p className="mt-1.5 text-[1.2rem] font-black leading-[1.04] tracking-tight sm:mt-2 sm:text-2xl">Delicious dishes<span className="mt-0.5 block">at <span className="text-orange-300">special prices</span></span></p>
        <p className="mt-1 max-w-[19rem] text-[11px] leading-snug text-orange-50/70 sm:mt-1.5 sm:text-xs">Fresh, flavourful and available today only!</p>
        <button type="button" onClick={() => navigate('/todays-special')} className="mt-3 inline-flex min-h-10 items-center gap-2 rounded-xl border border-white/15 bg-white px-3.5 py-2.5 text-xs font-extrabold text-brand-burnt shadow-lg shadow-black/20 transition hover:bg-orange-50 sm:mt-4 sm:px-4 sm:text-sm">View Today’s Special <ArrowRight size={16}/></button>
      </div>
      <div className="absolute inset-y-0 right-0 z-10 flex w-[42%] items-center justify-center overflow-hidden sm:w-[48%]">
        <img src="/images/todays-special-promo.png" alt="" aria-hidden="true" loading="lazy" decoding="async" onError={handleFoodItemImageError} className="today-special-image-backdrop absolute inset-0 h-full w-full object-cover object-center"/>
        <div className="absolute right-0 top-1/2 h-4/5 w-4/5 -translate-y-1/2 rounded-full bg-orange-400/15 blur-2xl"/>
        <img src="/images/todays-special-promo.png" alt="A warm spread of varied restaurant dishes" loading="lazy" decoding="async" onError={handleFoodItemImageError} className="today-special-image relative z-10 h-full w-full object-contain object-center"/>
      </div>
    </section>
      <section className="min-w-0"><div className="mb-4"><p className="text-xs font-bold uppercase tracking-[.18em] text-brand-orange">Find your favourite</p><h2 className="mt-1 text-xl font-extrabold">What sounds good?</h2></div><HorizontalRail>{categories.map(category=><button type="button" key={category.id} onClick={()=>setSelectedCategory(current=>current===category.id?'all':category.id)} aria-pressed={selectedCategory===category.id} className={`flex w-[92px] min-w-[92px] shrink-0 snap-start flex-col items-center gap-2 py-1 ${selectedCategory===category.id?'text-brand-burnt':'text-stone-900'}`}><span className={`relative flex h-[68px] w-[68px] shrink-0 items-center justify-center overflow-hidden rounded-full bg-brand-pale md:h-20 md:w-20 ${selectedCategory===category.id?'ring-2 ring-brand-orange ring-offset-2':''}`}><img src={foodImageUrl(category.image)} alt={`${category.name} food`} loading="lazy" decoding="async" onError={handleFoodImageError} className="h-full w-full rounded-full object-cover object-center"/></span><span className="line-clamp-2 min-h-8 w-full break-words text-center text-[11px] font-bold leading-4">{category.name}</span></button>)}</HorizontalRail></section>
    <section id="food-list" className="min-w-0 scroll-mt-24"><div className="mb-4"><p className="flex items-center gap-1 text-xs font-bold uppercase tracking-[.18em] text-brand-orange"><Flame size={14}/> Crowd favourites</p><h2 className="mt-1 text-xl font-extrabold">Popular near you</h2></div>{menuLoading?<div className="grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-4">{Array.from({length:4},(_,index)=><div key={index} className="food-image-container animate-pulse rounded-2xl bg-stone-200"/>)}</div>:menuError?<div role="alert" className="rounded-2xl bg-red-50 p-5 text-sm text-red-700">Could not load the menu. <button type="button" onClick={()=>void retryMenu()} className="ml-2 font-bold underline">Retry</button></div>:visibleFoods.length?<div className="grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-4">{visibleFoods.map(food=><FoodCard key={food.id} food={food} popular/>)}</div>:<div className="rounded-2xl border border-dashed border-stone-300 bg-white py-10 text-center text-sm text-stone-500">No food is available in this category right now.</div>}</section>
    <p className="flex items-center justify-center gap-2 pb-2 text-xs text-stone-400"><Clock3 size={13}/> Open daily · Cash on Delivery</p>
  </div>;
}

function HomeDeliveredReviewNotice() {
  const { user, authReady } = useCustomerProfile();
  const orders = useQuery({ queryKey: ['my-orders', user?.id], queryFn: () => getMyOrders(user!.id), enabled: authReady && Boolean(user), staleTime: 0, refetchOnMount: 'always', refetchOnWindowFocus: true });
  useCustomerOrdersRealtime(authReady && Boolean(user));
  const pendingReview = (orders.data ?? []).find(order => {
    if (order.status !== 'delivered') return false;
    const foodIds = new Set(order.order_items.map(item => item.food_item_id).filter((foodId): foodId is string => Boolean(foodId)));
    const reviewedIds = new Set(order.reviews.map(review => review.food_item_id).filter((foodId): foodId is string => Boolean(foodId)));
    return foodIds.size > 0 && [...foodIds].some(foodId => !reviewedIds.has(foodId));
  });
  if (!pendingReview) return null;
  return <section className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-orange-100 bg-brand-pale p-4 sm:p-5"><div><p className="font-extrabold text-brand-ink">Your order has been delivered! 🎉</p><p className="mt-1 text-sm text-stone-600">How was your food? Rate your items and help us serve you better.</p></div><Link to={`/reviews/${pendingReview.id}`} className="inline-flex min-h-11 shrink-0 items-center gap-2 rounded-xl bg-brand-orange px-4 text-sm font-bold text-white">Rate Your Food ⭐</Link></section>;
}
