import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, ArrowRight, Clock3, ImageOff, Plus, Sparkles, Star, Tag } from 'lucide-react';
import { Link } from 'react-router-dom';
import { CustomerFavoriteButton } from '../../components/CustomerFavorites';
import { useMenu } from '../../hooks/useMenu';
import { getFoodRatings } from '../../services/menuService';
import { useStore } from '../../store/useStore';
import type { FoodItem } from '../../types';
import { foodImageUrl, handleFoodItemImageError } from '../../utils/imageUrl';
import { getFoodBasePrice, getFoodDiscountPercent, getOriginalFoodBasePrice, isCurrentlyTodaySpecial } from '../../utils/foodPricing';

export function TodaySpecialPage() {
  const { data: menu = [], isLoading, isError, refetch } = useMenu();
  const [now, setNow] = useState(() => Date.now());
  const specials = useMemo(() => menu.filter(food => isCurrentlyTodaySpecial(food, now)), [menu, now]);
  const specialIds = useMemo(() => specials.map(food => food.id), [specials]);
  const ratings = useQuery({ queryKey: ['food-ratings', specialIds], queryFn: () => getFoodRatings(specialIds), enabled: specialIds.length > 0, staleTime: 0, refetchOnMount: 'always', refetchOnWindowFocus: true, refetchOnReconnect: true });

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  return <div className="mx-auto max-w-6xl">
    <Link to="/home" className="mb-5 inline-flex min-h-10 items-center gap-2 text-sm font-bold text-stone-500 hover:text-brand-burnt"><ArrowLeft size={17}/> Back to Home</Link>
    <header className="mb-6 rounded-3xl bg-brand-ink p-5 text-white sm:p-7">
      <span className="inline-flex items-center gap-2 rounded-full bg-brand-orange px-3 py-1.5 text-[10px] font-extrabold uppercase tracking-wider"><Sparkles size={13}/> Today’s Special</span>
      <h1 className="mt-3 text-2xl font-black sm:text-3xl">Today’s Special</h1>
      <p className="mt-1 text-sm text-white/75">Delicious dishes at special prices, picked fresh for today.</p>
    </header>

    {isLoading ? <div className="grid grid-cols-2 gap-3 sm:gap-4">{[0, 1, 2, 3].map(item => <div key={item} className="aspect-[1.4] animate-pulse rounded-2xl bg-stone-200"/>)}</div>
      : isError ? <div role="alert" className="rounded-2xl bg-red-50 p-5 text-sm text-red-700">Could not load today’s specials. <button type="button" onClick={() => void refetch()} className="ml-1 font-bold underline">Retry</button></div>
      : specials.length ? <div className="grid grid-cols-2 gap-3 sm:gap-4">{specials.map(food => <SpecialFoodCard key={food.id} food={food} now={now} rating={ratings.data?.[food.id]?.rating ?? 0} reviews={ratings.data?.[food.id]?.reviews ?? 0}/>)}</div>
      : <div className="rounded-2xl border border-dashed border-stone-300 bg-white px-5 py-12 text-center"><span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-brand-pale text-brand-burnt"><Tag size={21}/></span><h2 className="mt-3 text-lg font-extrabold">No specials available right now</h2><p className="mt-1 text-sm text-stone-500">Please check back soon for today’s dishes.</p><Link to="/home" className="mt-4 inline-flex items-center gap-2 text-sm font-bold text-brand-burnt">Explore the menu <ArrowRight size={16}/></Link></div>}
  </div>;
}

function SpecialFoodCard({ food, now, rating, reviews }: { food: FoodItem; now: number; rating: number; reviews: number }) {
  const add = useStore(state => state.add);
  const currentPrice = getFoodBasePrice(food, 'Regular', now);
  const originalPrice = getOriginalFoodBasePrice(food, 'Regular');
  const discountPercent = getFoodDiscountPercent(food, 'Regular', now);

  return <article className="group min-w-0 overflow-hidden rounded-2xl border border-stone-100 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
    <div className="relative aspect-[1.45] overflow-hidden bg-stone-100">
      {food.image.trim() ? <Link to={`/food/${food.id}`} className="block h-full w-full"><img src={foodImageUrl(food.image)} alt={food.name} loading="lazy" decoding="async" onError={handleFoodItemImageError} className="h-full w-full object-contain object-center transition duration-300"/></Link> : <div className="flex h-full items-center justify-center text-stone-400" aria-label={`${food.name} image unavailable`}><ImageOff size={28}/></div>}
      <span className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-full bg-brand-orange px-2.5 py-1.5 text-[10px] font-extrabold text-white shadow-sm"><Sparkles size={12}/> Today Special</span>
      {discountPercent > 0 && <span className="absolute bottom-3 left-3 rounded-full bg-white/95 px-2.5 py-1 text-xs font-extrabold text-brand-burnt shadow-sm">{discountPercent}% OFF</span>}
      <CustomerFavoriteButton foodItemId={food.id} className="absolute right-3 top-3 flex h-10 w-10 items-center justify-center rounded-full bg-white text-stone-500 shadow-sm" iconSize={18}/>
    </div>
    <div className="p-4">
      <div className="flex min-w-0 items-start justify-between gap-2"><Link to={`/food/${food.id}`} className="line-clamp-2 min-w-0 break-words font-extrabold leading-snug hover:text-brand-burnt">{food.name}</Link>{food.foodType && <span className={`shrink-0 rounded-md px-1.5 py-1 text-[9px] font-extrabold ${food.foodType === 'VEG' ? 'bg-green-50 text-green-700' : food.foodType === 'EGG' ? 'bg-brand-pale text-brand-burnt' : 'bg-red-50 text-red-700'}`}>{food.foodType === 'NON_VEG' ? 'NON-VEG' : food.foodType}</span>}</div>
      <p className="mt-2 line-clamp-2 min-h-10 text-xs leading-relaxed text-stone-500">{food.description}</p>
      <div className="mt-3 flex items-center gap-2 text-xs text-stone-500"><span className="flex items-center gap-1 font-semibold text-stone-800"><Star size={13} className="fill-amber-400 text-amber-400"/>{rating.toFixed(1)}</span><span>({reviews})</span><span>·</span><span className="flex items-center gap-1"><Clock3 size={12}/>{food.time}</span></div>
      <div className="mt-4 flex items-center justify-between gap-2"><div className="flex min-w-0 flex-wrap items-baseline gap-x-2"><span className="text-lg font-black text-brand-ink">₹{currentPrice.toLocaleString('en-IN')}</span>{discountPercent > 0 && <><span className="text-xs text-stone-400 line-through">₹{originalPrice.toLocaleString('en-IN')}</span><span className="text-[10px] font-bold text-green-700">{discountPercent}% off</span></>}</div><button type="button" disabled={!food.available} onClick={() => add(food)} className="inline-flex min-h-10 shrink-0 items-center gap-1 rounded-xl bg-brand-pale px-3 text-sm font-bold text-brand-burnt transition hover:bg-brand-orange hover:text-white disabled:cursor-not-allowed disabled:bg-stone-100 disabled:text-stone-400"><Plus size={17}/>{food.available ? 'Add' : 'Unavailable'}</button></div>
    </div>
  </article>;
}
