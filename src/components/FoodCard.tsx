import { Star, Clock3, Plus } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useStore } from '../store/useStore';
import { CustomerFavoriteButton } from './CustomerFavorites';
import type { FoodItem } from '../types';
import { foodImageUrl, handleFoodItemImageError } from '../utils/imageUrl';
import { getFoodBasePrice, getOriginalFoodBasePrice, hasFoodSizeVariants } from '../utils/foodPricing';

export function FoodCard({ food, popular = false, offer }: { food: FoodItem; popular?: boolean; offer?: { id: string; discountPercentage: number } }) {
  const add = useStore(state => state.add);
  const originalPrice = offer && offer.discountPercentage > 0 ? getOriginalFoodBasePrice(food, 'Regular') : getFoodBasePrice(food, 'Regular');
  const offerPrice = offer && offer.discountPercentage > 0 ? Math.round(originalPrice * (1 - offer.discountPercentage / 100) * 100) / 100 : originalPrice;
  return <article className="group min-w-0 overflow-hidden rounded-2xl border border-stone-100 bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-soft">
    <div className="food-image-container bg-brand-pale"><Link to={`/food/${food.id}`} className="absolute inset-0 flex items-center justify-center">{food.image.trim() && <img loading="lazy" decoding="async" src={foodImageUrl(food.image)} alt={food.name} onError={handleFoodItemImageError} className="food-image"/>}</Link>
      {food.badge && <span className="absolute left-3 top-3 rounded-full bg-white/95 px-2.5 py-1 text-[10px] font-bold text-brand-burnt shadow-sm">{food.badge}</span>}
      {!food.available && <span className="absolute bottom-3 left-3 rounded-md bg-red-700 px-2 py-1 text-[9px] font-extrabold uppercase tracking-wide text-white shadow-sm">Out of stock</span>}
      <CustomerFavoriteButton foodItemId={food.id} iconSize={18} animateOnLike className="absolute right-2.5 top-2.5 z-10 flex h-11 w-11 items-center justify-center rounded-full bg-white text-stone-500 shadow-md ring-1 ring-stone-900/5 transition-all duration-200 hover:scale-105 hover:shadow-lg active:scale-95"/>
    </div>
    <div className={`min-w-0 ${popular ? 'p-3 sm:p-3.5' : 'p-3.5'}`}><div className="mb-1 flex min-w-0 items-start justify-between gap-2"><Link to={`/food/${food.id}`} className="line-clamp-2 min-w-0 break-words font-bold leading-snug">{food.name}</Link>{food.foodType && <span aria-label={food.foodType.replace('_', '-')} className={`shrink-0 rounded-md px-1.5 py-1 text-[9px] font-extrabold ${food.foodType === 'VEG' ? 'bg-green-50 text-green-700' : food.foodType === 'EGG' ? 'bg-brand-pale text-brand-burnt' : 'bg-red-50 text-red-700'}`}>{food.foodType === 'NON_VEG' ? 'NON-VEG' : food.foodType}</span>}</div><p className="line-clamp-2 min-h-9 text-xs leading-relaxed text-stone-500">{food.description}</p><div className="mt-2 flex items-center gap-2 text-[11px] text-stone-500"><span className="flex items-center gap-1 font-semibold text-stone-800"><Star size={13} className="fill-amber-400 text-amber-400"/>{food.reviews ? food.rating.toFixed(1) : 'New'}</span><span>({food.reviews})</span><span>·</span><span className="flex items-center gap-1"><Clock3 size={12}/>{food.time}</span></div>
      <div className={`mt-3 flex min-w-0 items-center justify-between ${popular ? 'gap-1 sm:gap-2' : ''}`}><div className="flex min-w-0 flex-wrap items-baseline gap-x-1.5"><span className={popular ? 'min-w-0 truncate text-base font-extrabold sm:text-lg' : 'text-lg font-extrabold'}>{hasFoodSizeVariants(food) ? 'From ' : ''}₹{offerPrice.toFixed(2)}</span>{offer && offer.discountPercentage > 0 && <><span className="text-[10px] text-stone-400 line-through">₹{originalPrice.toFixed(2)}</span><span className="rounded-full bg-red-50 px-1.5 py-0.5 text-[9px] font-extrabold text-red-700">{offer.discountPercentage}% OFF</span></>}</div><button aria-label={food.available ? `Add ${food.name} to cart` : `${food.name} is out of stock`} disabled={!food.available} onClick={() => add(food, 'Regular', [], '', offer)} className={popular ? 'flex shrink-0 items-center gap-1 whitespace-nowrap rounded-xl bg-brand-pale px-1 py-2 text-[10px] font-bold text-brand-burnt transition hover:bg-brand-orange hover:text-white disabled:cursor-not-allowed disabled:bg-stone-100 disabled:text-stone-400 sm:h-11 sm:px-3 sm:text-sm' : 'flex h-9 items-center gap-1 rounded-xl bg-brand-pale px-3 text-sm font-bold text-brand-burnt transition hover:bg-brand-orange hover:text-white disabled:cursor-not-allowed disabled:bg-stone-100 disabled:text-stone-400'}>{(!popular || food.available) && <Plus size={popular ? 15 : 17}/>}<span>{food.available ? 'Add' : 'Unavailable'}</span></button></div>
    </div>
  </article>;
}

