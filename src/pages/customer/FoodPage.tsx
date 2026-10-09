import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Star, Clock3, Minus, Plus, UserRound, ThumbsUp } from 'lucide-react';
import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import type { UseQueryResult } from '@tanstack/react-query';
import { formatDistanceToNow } from 'date-fns';
import { useMenu } from '../../hooks/useMenu';
import { foodImageUrl, handleFoodItemImageError } from '../../utils/imageUrl';
import { useStore } from '../../store/useStore';
import { CustomerFavoriteButton } from '../../components/CustomerFavorites';
import { getFoodBasePrice, hasFoodSizeVariants, getFoodUnitPrice } from '../../utils/foodPricing';
import { getPublicFoodReviews, toggleFoodReviewHelpful } from '../../services/reviewService';
import type { PublicFoodReviewsResponse } from '../../services/reviewService';
export function FoodPage() {
  const { id } = useParams();
  const { data: menu = [], isLoading, isError, refetch } = useMenu();
  const food = menu.find(item => item.id === id);
  const publicReviews = useQuery({
    queryKey: ['food-reviews', id],
    queryFn: () => getPublicFoodReviews(id!),
    enabled: Boolean(id),
    staleTime: 0,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
  });
  const [size, setSize] = useState<'Regular' | 'Large'>('Regular');
  const [extras, setExtras] = useState<string[]>([]);
  const [quantity, setQuantity] = useState(1);
  const [note, setNote] = useState('');
  const add = useStore(state => state.add);
  const navigate = useNavigate();

  if (isLoading) return <div className="animate-pulse rounded-3xl bg-white p-8">Loading dish…</div>;
  if (isError) return <div className="rounded-2xl bg-red-50 p-5 text-red-700">Could not load this dish. <button onClick={() => void refetch()} className="font-bold underline">Retry</button></div>;
  if (!food) return <div>Food item not found.</div>;

  const total = getFoodUnitPrice(food, size, extras.length) * quantity;

  return (
    <div className="mx-auto max-w-4xl">
      <button onClick={() => navigate(-1)} className="mb-4 flex items-center gap-2 text-sm font-semibold text-stone-500">
        <ArrowLeft size={17} /> Back to menu
      </button>
      <div className="grid overflow-hidden rounded-3xl bg-white shadow-sm md:grid-cols-2">
        <div className="relative min-h-64 bg-stone-50">
          {food.image.trim() && <img src={foodImageUrl(food.image)} alt={food.name} onError={handleFoodItemImageError} className="absolute inset-0 h-full w-full object-contain object-center" />}
          <CustomerFavoriteButton foodItemId={food.id} iconSize={20} className="absolute right-4 top-4 rounded-full bg-white p-3 text-stone-500"/>
        </div>
        <div className="p-5 sm:p-7">
          <div className="flex items-start justify-between gap-3">
            <div><span className="text-xs font-bold uppercase tracking-widest text-brand-orange">{food.category}</span><h1 className="mt-1 text-2xl font-black">{food.name}</h1></div>
            {food.foodType && <span className={`mt-1 rounded-md px-2 py-1 text-[10px] font-extrabold ${food.foodType === 'VEG' ? 'bg-green-50 text-green-700' : food.foodType === 'EGG' ? 'bg-brand-pale text-brand-burnt' : 'bg-red-50 text-red-700'}`}>{food.foodType === 'NON_VEG' ? 'NON-VEG' : food.foodType}</span>}
          </div>
          <p className="mt-3 text-sm leading-relaxed text-stone-500">{food.description}</p>
          <div className="mt-3 flex gap-4 text-xs"><span className="flex items-center gap-1 font-bold"><Star size={14} className="fill-amber-400 text-amber-400" />{food.rating} ({food.reviews})</span><span className="flex items-center gap-1 text-stone-500"><Clock3 size={14} />{food.time}</span></div>
          <div className="mt-6 border-t pt-5">
            {hasFoodSizeVariants(food) ? <><b className="text-sm">Choose size</b><div className="mt-2 grid grid-cols-2 gap-2">{(['Regular', 'Large'] as const).filter(option => option === 'Regular' ? food.regularPrice !== null : food.largePrice !== null).map(option => <button type="button" key={option} onClick={() => setSize(option)} className={`rounded-xl border p-3 text-left text-sm ${size === option ? 'border-brand-orange bg-brand-pale text-brand-burnt' : 'border-stone-200'}`}>{option}<b className="float-right">₹{getFoodBasePrice(food, option)}</b></button>)}</div></> : <p className="text-sm font-bold">Price <span className="ml-2 text-brand-burnt">₹{food.price}</span></p>}
            <b className="mt-5 block text-sm">Make it yours <span className="font-normal text-stone-400">(₹30 each)</span></b>
            <div className="mt-2 grid grid-cols-2 gap-2">{['Cheese', 'Extra Chicken', 'Jalapeño', 'Sauce'].map(option => <label key={option} className="flex items-center gap-2 rounded-xl border border-stone-200 p-3 text-xs"><input type="checkbox" checked={extras.includes(option)} onChange={event => setExtras(event.target.checked ? [...extras, option] : extras.filter(item => item !== option))} className="accent-orange-500" />{option}</label>)}</div>
            <label className="mt-5 block text-sm font-bold">Special instructions<textarea value={note} onChange={event => setNote(event.target.value)} placeholder="Anything we should know?" className="mt-2 min-h-20 w-full rounded-xl border border-stone-200 p-3 text-sm font-normal outline-brand-orange" /></label>
            <div className="mt-5 flex items-center justify-between"><div className="flex items-center gap-4 rounded-xl border p-2"><button aria-label="Decrease quantity" onClick={() => setQuantity(Math.max(1, quantity - 1))}><Minus size={16} /></button><b>{quantity}</b><button aria-label="Increase quantity" onClick={() => setQuantity(quantity + 1)}><Plus size={16} /></button></div><b className="text-xl">₹{total}</b></div>
            {!food.available && <p role="status" className="mt-4 rounded-xl bg-red-50 p-3 text-center text-sm font-bold text-red-700">Out of stock</p>}
            <button disabled={!food.available} onClick={() => { for (let index = 0; index < quantity; index += 1) add(food, size, extras, note); navigate('/cart'); }} className="mt-4 w-full rounded-xl bg-brand-orange py-4 text-sm font-extrabold text-white disabled:cursor-not-allowed disabled:bg-stone-300">{food.available ? `Add to cart · ₹${total}` : 'Currently unavailable'}</button>
          </div>
        </div>
      </div>
      <FoodReviewsSection query={publicReviews}/>
    </div>
  );
}

function FoodReviewsSection({ query }: { query: UseQueryResult<PublicFoodReviewsResponse, Error> }) {
  const [activeRating, setActiveRating] = useState<number | null>(null);
  const [sortOrder, setSortOrder] = useState<'recent' | 'highest' | 'lowest'>('recent');
  const helpfulMutation = useMutation({
    mutationFn: toggleFoodReviewHelpful,
    onSuccess: () => query.refetch(),
  });
  const distribution = query.data?.distribution;
  const starCounts = [
    { stars: 5, count: distribution?.five_star_count ?? 0 },
    { stars: 4, count: distribution?.four_star_count ?? 0 },
    { stars: 3, count: distribution?.three_star_count ?? 0 },
    { stars: 2, count: distribution?.two_star_count ?? 0 },
    { stars: 1, count: distribution?.one_star_count ?? 0 },
  ];
  const totalReviews = distribution?.review_count ?? 0;
  const visibleReviews = [...(query.data?.reviews ?? [])]
    .filter(review => activeRating === null || review.food_rating === activeRating)
    .sort((left, right) => sortOrder === 'recent'
      ? new Date(right.created_at).getTime() - new Date(left.created_at).getTime()
      : sortOrder === 'highest'
        ? right.food_rating - left.food_rating || new Date(right.created_at).getTime() - new Date(left.created_at).getTime()
        : left.food_rating - right.food_rating || new Date(right.created_at).getTime() - new Date(left.created_at).getTime());
  const filters = [
    { rating: null as number | null, label: `All (${distribution?.review_count ?? 0})`, count: distribution?.review_count ?? 0 },
    ...starCounts.map(({ stars, count }) => ({ rating: stars, label: `${stars} ★ (${count})`, count })),
  ];

  return <section aria-labelledby="customer-reviews-heading" className="mt-6 rounded-3xl border border-orange-100/70 bg-white p-5 shadow-[0_12px_34px_rgba(124,45,18,0.06)] sm:p-7">
    <header className="flex flex-wrap items-start justify-between gap-3">
      <div><h2 id="customer-reviews-heading" className="text-2xl font-black tracking-tight sm:text-3xl">Customer Reviews</h2><p className="mt-1.5 text-sm text-stone-500">Real feedback from our customers</p></div>
      {!query.isLoading && !query.isError && <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-orange-50 px-3.5 py-2 text-sm font-extrabold text-brand-ink ring-1 ring-orange-100"><Star size={17} className="fill-brand-orange text-brand-orange"/>{distribution?.review_count ? distribution.average_rating.toFixed(1) : 'New'} <span className="font-semibold text-stone-500">({distribution?.review_count ?? 0})</span></span>}
    </header>

    {query.isLoading ? <p role="status" className="mt-6 rounded-2xl bg-orange-50/60 p-5 text-sm text-stone-500">Loading customer reviews…</p>
      : query.isError ? <p role="alert" className="mt-6 rounded-2xl bg-red-50 p-5 text-sm text-red-700">Could not load reviews for this food: {query.error.message} <button type="button" onClick={() => void query.refetch()} className="font-bold underline">Retry</button></p>
      : <>
        {(distribution?.review_count ?? 0) > 0 ? <>
          <div className="mt-6 grid gap-6 rounded-2xl bg-orange-50/50 p-4 sm:grid-cols-[minmax(150px,.65fr)_minmax(0,1.35fr)] sm:items-center sm:p-6">
            <div className="text-center sm:text-left"><p className="text-5xl font-black leading-none tracking-tight tabular-nums text-brand-ink">{distribution!.average_rating.toFixed(1)}</p><div className="mt-2 flex justify-center gap-0.5 sm:justify-start" aria-label={`${distribution!.average_rating} out of 5 stars`}>{[1,2,3,4,5].map(star => <Star key={star} size={19} className={star <= Math.floor(distribution!.average_rating) ? 'fill-brand-orange text-brand-orange' : 'fill-transparent text-stone-300'}/>)}</div><p className="mt-1.5 text-sm text-stone-500">{distribution!.review_count} {distribution!.review_count === 1 ? 'review' : 'reviews'}</p></div>
            <div aria-label="Rating distribution" className="space-y-2.5">{starCounts.map(({ stars, count }) => <div key={stars} className="flex items-center gap-2.5 text-xs sm:text-sm"><span className="w-8 shrink-0 font-semibold tabular-nums text-stone-600">{stars} ★</span><span className="h-2.5 flex-1 overflow-hidden rounded-full bg-stone-200/80"><span className="block h-full rounded-full bg-brand-orange transition-[width] duration-300" style={{ width: `${totalReviews ? count / totalReviews * 100 : 0}%` }}/></span><span className="w-7 text-right tabular-nums text-stone-500">{count}</span></div>)}</div>
          </div>

          <div aria-label="Filter reviews by rating" className="hide-scrollbar -mx-1 mt-5 flex snap-x gap-2 overflow-x-auto px-1 pb-1">{filters.map(filter => {
            const selected = activeRating === filter.rating;
            return <button key={filter.rating ?? 'all'} type="button" disabled={filter.rating !== null && filter.count === 0} aria-pressed={selected} onClick={() => setActiveRating(filter.rating)} className={`min-h-10 shrink-0 snap-start rounded-full border px-3.5 text-xs font-bold transition sm:text-sm ${selected ? 'border-brand-orange bg-orange-50 text-brand-burnt' : 'border-stone-200 bg-white text-stone-700 hover:border-orange-200 hover:bg-orange-50/40'} disabled:cursor-not-allowed disabled:opacity-45`}>{filter.label}</button>;
          })}</div>

          <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-b border-stone-100 pb-3"><h3 className="text-lg font-extrabold">Latest reviews</h3><label className="flex items-center gap-2 text-xs font-semibold text-stone-500">Sort by <select value={sortOrder} onChange={event => setSortOrder(event.target.value as 'recent' | 'highest' | 'lowest')} aria-label="Sort reviews" className="min-h-10 rounded-xl border border-stone-200 bg-white px-3 text-sm font-semibold text-stone-700 outline-none focus:border-brand-orange"><option value="recent">Most recent</option><option value="highest">Highest rating</option><option value="lowest">Lowest rating</option></select></label></div>

          {visibleReviews.length ? <div className="mt-3 space-y-3">{visibleReviews.map((review, index) => <article key={`${review.food_item_id}-${review.created_at}-${index}`} className="rounded-2xl border border-stone-100 bg-white p-4 shadow-[0_4px_18px_rgba(28,25,23,0.045)] sm:p-5"><div className="flex flex-wrap items-center justify-between gap-3"><div className="flex min-w-0 items-center gap-3"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-orange-50 text-brand-burnt"><UserRound size={19}/></span><div className="min-w-0"><p className="text-sm font-extrabold text-stone-800">Customer</p>{review.is_verified_purchase && <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-orange-50 px-2 py-0.5 text-[10px] font-bold text-brand-burnt"><span aria-hidden="true">✓</span> Verified Purchase</span>}</div></div><time className="text-xs text-stone-400" dateTime={review.created_at}>{formatDistanceToNow(new Date(review.created_at), { addSuffix: true })}</time></div><div className="mt-4 flex gap-0.5" aria-label={`${review.food_rating} out of 5 stars`}>{[1,2,3,4,5].map(star => <Star key={star} size={17} className={star <= review.food_rating ? 'fill-brand-orange text-brand-orange' : 'fill-transparent text-stone-300'}/>)}</div><p className="mt-2 whitespace-pre-wrap break-words text-sm leading-relaxed text-stone-700">{review.comment.trim() || 'Rated without a written comment.'}</p>{review.id && <div className="mt-4 border-t border-stone-100 pt-3"><button type="button" disabled={helpfulMutation.isPending} aria-pressed={review.viewer_marked_helpful} onClick={() => helpfulMutation.mutate(review.id)} className={`inline-flex min-h-10 items-center gap-2 rounded-full px-3 text-xs font-semibold transition ${review.viewer_marked_helpful ? 'bg-orange-50 text-brand-burnt' : 'text-stone-500 hover:bg-stone-50'} disabled:opacity-50`}><ThumbsUp size={15} className={review.viewer_marked_helpful ? 'fill-orange-200' : ''}/><span>Helpful ({review.helpful_count})</span></button></div>}</article>)}</div>
            : <div className="mt-4 rounded-2xl bg-stone-50 px-5 py-8 text-center"><p className="text-sm font-semibold text-stone-700">No reviews with this rating</p><button type="button" onClick={() => setActiveRating(null)} className="mt-2 text-sm font-bold text-brand-burnt underline">Show all reviews</button></div>}
        </> : <div className="mt-6 rounded-2xl bg-orange-50/50 px-5 py-10 text-center"><div className="flex justify-center gap-1" aria-label="5 star rating">{[1,2,3,4,5].map(star => <Star key={star} size={23} className="fill-brand-orange text-brand-orange"/>)}</div><h3 className="mt-4 text-lg font-extrabold">No reviews yet</h3><p className="mt-1 text-sm text-stone-500">Be the first customer to share your experience!</p></div>}
      </>}
    {helpfulMutation.isError && <p role="alert" className="mt-3 text-xs text-stone-500">Sign in to mark a review helpful. Please try again.</p>}
  </section>;
}
