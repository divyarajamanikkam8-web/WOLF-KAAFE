import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { ImageOff, LoaderCircle, MessageSquareText, Search, Star, Trash2 } from 'lucide-react';
import { deleteAdminFoodReview, getAdminFoodReviews, getAdminFoodReviewSummaries } from '../../services/reviewService';
import type { AdminFoodReviewSummary } from '../../services/reviewService';
import { foodImageUrl, handleFoodItemImageError } from '../../utils/imageUrl';

const ratingFields = [
  ['5', 'five_star_count'],
  ['4', 'four_star_count'],
  ['3', 'three_star_count'],
  ['2', 'two_star_count'],
  ['1', 'one_star_count'],
] as const;

export function AdminReviewsPage() {
  const [search, setSearch] = useState('');
  const summary = useQuery({ queryKey: ['admin-reviews', 'summary'], queryFn: getAdminFoodReviewSummaries, staleTime: 30_000 });
  const filteredFoods = useMemo(() => {
    const query = search.trim().toLowerCase();
    return (summary.data ?? []).filter(food => !query || food.name.toLowerCase().includes(query));
  }, [summary.data, search]);
  const ratedFoods = (summary.data ?? []).filter(food => food.review_count > 0).length;
  const totalReviews = (summary.data ?? []).reduce((total, food) => total + food.review_count, 0);
  const average = totalReviews
    ? (summary.data ?? []).reduce((total, food) => total + food.average_rating * food.review_count, 0) / totalReviews
    : 0;

  return <div className="mx-auto max-w-[1440px] space-y-5">
    <header className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-xs font-extrabold uppercase tracking-[.16em] text-brand-burnt">Customer feedback</p><h1 className="mt-1 text-2xl font-black sm:text-3xl">Reviews &amp; Ratings</h1><p className="mt-1 text-sm text-stone-500">Food ratings and customer reviews from delivered orders.</p></div></header>
    {summary.isLoading ? <div role="status" className="rounded-2xl border border-stone-200 bg-white p-6 text-sm text-stone-500">Loading reviews…</div>
      : summary.isError ? <div role="alert" className="rounded-2xl border border-red-100 bg-red-50 p-5 text-sm text-red-700">Could not load review data. Confirm the food review migration is applied in Supabase. <button type="button" onClick={() => void summary.refetch()} className="ml-1 font-bold underline">Retry</button></div>
      : <>
        <section className="grid grid-cols-2 gap-3 lg:grid-cols-3">
          <Stat title="Total reviews" value={totalReviews.toLocaleString('en-IN')} detail="All customer food ratings"/>
          <Stat title="Average rating" value={totalReviews ? average.toFixed(1) : '—'} detail={totalReviews ? 'Across reviewed food items' : 'No ratings yet'} icon/>
          <Stat title="Foods reviewed" value={`${ratedFoods} / ${(summary.data ?? []).length}`} detail="Menu items with feedback"/>
        </section>
        <section className="overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-stone-100 p-4 sm:p-5"><div><h2 className="font-extrabold">Food ratings</h2><p className="mt-1 text-xs text-stone-500">{filteredFoods.length} food items · updated live from Supabase</p></div><label className="flex min-h-11 w-full items-center gap-2 rounded-xl border border-stone-200 px-3 sm:max-w-xs"><Search size={17} className="shrink-0 text-stone-400"/><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Search food" aria-label="Search food by name" className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-stone-400"/></label></div>
          {filteredFoods.length ? <div className="divide-y divide-stone-100">{filteredFoods.map(food => <FoodReviewRow key={food.food_item_id} food={food}/>)}</div>
            : <div className="p-10 text-center"><MessageSquareText size={25} className="mx-auto text-stone-400"/><p className="mt-2 text-sm font-semibold">No matching food items</p></div>}
        </section>
      </>}
  </div>;
}

function Stat({ title, value, detail, icon = false }: { title: string; value: string; detail: string; icon?: boolean }) {
  return <article className="min-w-0 rounded-2xl border border-stone-200 bg-white p-4 shadow-sm sm:p-5"><p className="text-xs font-bold text-stone-500 sm:text-sm">{title}</p><div className="mt-2 flex items-center gap-2"><b className="truncate text-2xl font-black sm:text-3xl">{value}</b>{icon && <Star size={19} className="fill-amber-400 text-amber-400"/>}</div><p className="mt-1 truncate text-[11px] text-stone-500 sm:text-xs">{detail}</p></article>;
}

function FoodReviewRow({ food }: { food: AdminFoodReviewSummary }) {
  const [expanded, setExpanded] = useState(false);
  const queryClient = useQueryClient();
  const reviews = useQuery({ queryKey: ['admin-reviews', 'food', food.food_item_id], queryFn: () => getAdminFoodReviews(food.food_item_id), enabled: expanded, staleTime: 30_000 });
  const deleteReview = useMutation({
    mutationFn: deleteAdminFoodReview,
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['admin-reviews'] }),
        queryClient.invalidateQueries({ queryKey: ['menu'] }),
        queryClient.invalidateQueries({ queryKey: ['food-ratings'] }),
        queryClient.invalidateQueries({ queryKey: ['food-reviews'] }),
      ]);
    },
  });
  const maxCount = Math.max(1, food.five_star_count, food.four_star_count, food.three_star_count, food.two_star_count, food.one_star_count);
  const image = food.image_url ? foodImageUrl(food.image_url) : '';

  return <article className="p-4 sm:p-5">
    <button type="button" aria-expanded={expanded} onClick={() => setExpanded(value => !value)} className="flex min-h-0 w-full flex-col gap-4 rounded-xl text-left sm:flex-row sm:items-center">
      <span className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-stone-50">{image ? <img src={image} alt={food.name} onError={handleFoodItemImageError} className="h-full w-full object-contain"/> : <ImageOff size={22} className="text-stone-400"/>}</span>
      <span className="min-w-0 flex-1"><span className="flex flex-wrap items-center gap-2"><b className="break-words">{food.name}</b>{!food.is_active && <span className="rounded-full bg-stone-100 px-2 py-0.5 text-[10px] font-bold text-stone-500">Inactive</span>}</span><span className="mt-1 flex items-center gap-1 text-sm text-stone-600"><Star size={14} className="fill-amber-400 text-amber-400"/><b>{food.review_count ? food.average_rating.toFixed(1) : '—'}</b><span>({food.review_count} {food.review_count === 1 ? 'review' : 'reviews'})</span></span></span>
      <span className="text-xs font-bold text-brand-burnt">{expanded ? 'Hide reviews' : food.review_count ? 'View reviews' : 'No reviews yet'}</span>
    </button>
    <div className="mt-4 grid gap-2 sm:grid-cols-5">{ratingFields.map(([stars, field]) => {
      const count = food[field];
      return <div key={stars} className="flex items-center gap-2 text-xs"><span className="w-7 shrink-0 font-semibold text-stone-600">{stars} ★</span><span className="h-2 flex-1 overflow-hidden rounded-full bg-stone-100"><span className="block h-full rounded-full bg-brand-orange" style={{ width: `${count ? Math.max(4, count / maxCount * 100) : 0}%` }}/></span><span className="w-7 text-right tabular-nums text-stone-500">{count}</span></div>;
    })}</div>
    {expanded && <div className="mt-4 border-t border-stone-100 pt-4">
      {reviews.isLoading ? <p className="text-sm text-stone-500">Loading customer reviews…</p>
        : reviews.isError ? <p role="alert" className="text-sm text-red-700">Could not load customer reviews. <button type="button" onClick={() => void reviews.refetch()} className="font-bold underline">Retry</button></p>
        : reviews.data?.length ? <div className="space-y-3">{deleteReview.isError && <p role="alert" className="rounded-lg bg-red-50 p-3 text-xs text-red-700">Could not delete this review. Please retry.</p>}{reviews.data.map(review => <article key={review.id} className="rounded-xl bg-stone-50 p-4"><div className="flex flex-wrap items-center justify-between gap-2"><div><b className="text-sm">{review.customer_name}</b><div className="mt-1 flex items-center gap-0.5" aria-label={`${review.food_rating} out of 5 stars`}>{[1,2,3,4,5].map(star => <Star key={star} size={13} className={star <= review.food_rating ? 'fill-brand-orange text-brand-orange' : 'text-stone-300'}/>)}</div></div><div className="flex items-center gap-3"><time className="text-xs text-stone-500">{format(new Date(review.created_at), 'dd MMM yyyy')}</time><button type="button" disabled={deleteReview.isPending} aria-label={`Delete review from ${review.customer_name}`} onClick={() => { if (window.confirm('Delete this customer review? The food rating will be recalculated.')) deleteReview.mutate(review.id); }} className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-red-100 bg-white px-2.5 text-xs font-bold text-red-700 hover:bg-red-50 disabled:opacity-50">{deleteReview.isPending ? <LoaderCircle size={14} className="animate-spin"/> : <Trash2 size={14}/>}<span className="hidden sm:inline">Delete</span></button></div></div><p className="mt-3 whitespace-pre-wrap break-words text-sm leading-relaxed text-stone-700">{review.comment.trim() || 'Rated without a written comment.'}</p><p className="mt-2 text-[11px] text-stone-400">Order #{review.order_id.slice(0, 8).toUpperCase()}</p></article>)}</div>
          : <p className="text-sm text-stone-500">No customer reviews for this item yet.</p>}
    </div>}
  </article>;
}
