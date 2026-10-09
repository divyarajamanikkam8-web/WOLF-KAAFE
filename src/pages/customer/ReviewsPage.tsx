import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { ArrowLeft, ArrowRight, CheckCircle2, ClipboardList, LoaderCircle, MessageCircleHeart, Star } from 'lucide-react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useCustomerOrdersRealtime } from '../../hooks/useCustomerOrdersRealtime';
import { getMyOrders, type CustomerOrder, type CustomerOrderItem } from '../../services/orderService';
import { submitOrderFoodReviews } from '../../services/reviewService';
import { foodImageUrl, handleFoodItemImageError } from '../../utils/imageUrl';
import { useCustomerProfile } from '../../hooks/useCustomerProfile';

type ReviewDraft = { rating: number; review_text: string };

export function ReviewsPage() {
  const { id: orderId } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [submitError, setSubmitError] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [drafts, setDrafts] = useState<Record<string, ReviewDraft>>({});

  const { user, authReady } = useCustomerProfile();
  const signedIn = Boolean(user);
  const orders = useQuery({ queryKey: ['my-orders', user?.id], queryFn: () => getMyOrders(user!.id), enabled: authReady && signedIn, staleTime: 0, refetchOnMount: 'always', refetchOnWindowFocus: true });
  useCustomerOrdersRealtime(authReady && signedIn);
  const deliveredOrders = useMemo(() => (orders.data ?? []).filter(order => order.status === 'delivered'), [orders.data]);
  const selectedOrder = deliveredOrders.find(order => order.id === orderId);
  const reviewItems = useMemo(() => selectedOrder ? uniqueReviewItems(selectedOrder) : [], [selectedOrder]);
  const existingReviews = useMemo(() => new Map((selectedOrder?.reviews ?? []).filter(review => review.food_item_id).map(review => [review.food_item_id!, review])), [selectedOrder]);

  useEffect(() => {
    if (!selectedOrder) return;
    setDrafts(Object.fromEntries(reviewItems.map(item => {
      const existing = existingReviews.get(item.food_item_id!);
      return [item.food_item_id!, { rating: existing?.food_rating ?? 0, review_text: existing?.comment ?? '' }];
    })));
    setSubmitError('');
  }, [selectedOrder?.id, reviewItems, existingReviews]);

  const mutation = useMutation({
    mutationFn: () => {
      if (!selectedOrder) throw new Error('Delivered order not found.');
      return submitOrderFoodReviews(selectedOrder.id, reviewItems.map(item => ({
        food_item_id: item.food_item_id!,
        rating: drafts[item.food_item_id!]?.rating ?? 0,
        review_text: drafts[item.food_item_id!]?.review_text ?? '',
      })));
    },
    onSuccess: async () => {
      setSubmitted(true);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['my-orders', user?.id] }),
        queryClient.invalidateQueries({ queryKey: ['menu'] }),
        queryClient.invalidateQueries({ queryKey: ['food-ratings'] }),
        queryClient.invalidateQueries({ queryKey: ['food-reviews'] }),
        queryClient.invalidateQueries({ queryKey: ['admin-reviews'] }),
      ]);
      navigate('/reviews', { replace: true, state: { reviewSubmitted: true } });
    },
    onError: error => setSubmitError(error instanceof Error ? error.message : 'Could not submit your review. Please try again.'),
  });

  const setDraft = (foodId: string, patch: Partial<ReviewDraft>) => setDrafts(current => {
    const previous = current[foodId] ?? { rating: 0, review_text: '' };
    return { ...current, [foodId]: { ...previous, ...patch } };
  });

  if (!authReady) return <div className="rounded-2xl bg-white p-6 text-sm text-stone-500">Checking your account…</div>;
  if (!signedIn) return <section className="mx-auto max-w-xl rounded-3xl bg-white p-8 text-center shadow-sm"><MessageCircleHeart size={34} className="mx-auto text-brand-orange"/><h1 className="mt-3 text-xl font-black">Sign in to review your order</h1><p className="mt-2 text-sm text-stone-500">Your delivered orders and food reviews belong to your customer account.</p><Link to="/login" state={{ from: orderId ? `/reviews/${orderId}` : '/reviews' }} className="mt-5 inline-flex min-h-11 items-center rounded-xl bg-brand-orange px-5 text-sm font-bold text-white">Sign in</Link></section>;
  if (orders.isLoading) return <div role="status" className="rounded-2xl bg-white p-6 text-sm text-stone-500">Loading delivered orders…</div>;
  if (orders.isError) return <div role="alert" className="rounded-2xl bg-red-50 p-5 text-sm text-red-700">Could not load your orders. <button type="button" onClick={() => void orders.refetch()} className="font-bold underline">Retry</button></div>;

  if (orderId) {
    if (!selectedOrder) return <section className="mx-auto max-w-xl rounded-3xl bg-white p-8 text-center shadow-sm"><ClipboardList size={32} className="mx-auto text-stone-400"/><h1 className="mt-3 text-xl font-black">Delivered order not found</h1><p className="mt-2 text-sm text-stone-500">Reviews are available only for your own delivered orders.</p><Link to="/reviews" className="mt-5 inline-flex items-center gap-2 text-sm font-bold text-brand-burnt"><ArrowLeft size={16}/> Your reviews</Link></section>;
    if (!reviewItems.length) return <section className="mx-auto max-w-2xl rounded-3xl bg-white p-8 text-center shadow-sm"><CheckCircle2 size={34} className="mx-auto text-green-600"/><h1 className="mt-3 text-xl font-black">Your order has been delivered!</h1><p className="mt-2 text-sm text-stone-500">There are no reviewable menu items on this order.</p><Link to="/reviews" className="mt-5 inline-flex items-center gap-2 text-sm font-bold text-brand-burnt"><ArrowLeft size={16}/> Your reviews</Link></section>;

    const allRated = reviewItems.every(item => (drafts[item.food_item_id!]?.rating ?? 0) > 0);
    const isEditing = reviewItems.some(item => existingReviews.has(item.food_item_id!));
    return <div className="mx-auto max-w-3xl">
      <Link to="/reviews" className="mb-5 inline-flex min-h-10 items-center gap-2 text-sm font-bold text-stone-500 hover:text-brand-burnt"><ArrowLeft size={17}/> Delivered orders</Link>
      <header className="mb-5 rounded-3xl bg-brand-ink p-5 text-white sm:p-7"><span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 text-xs font-bold"><MessageCircleHeart size={15} className="text-brand-orange"/> Order #{selectedOrder.id.slice(0, 8).toUpperCase()}</span><h1 className="mt-3 text-2xl font-black">How was your order?</h1><p className="mt-1 text-sm text-white/75">Rate each food item and help us serve you better.</p></header>
      {submitted && <p role="status" className="mb-4 rounded-2xl bg-green-50 p-4 text-sm font-semibold text-green-800">Thank you for your feedback! ❤️</p>}
      <div className="space-y-4">{reviewItems.map(item => {
        const foodId = item.food_item_id!;
        const draft = drafts[foodId] ?? { rating: 0, review_text: '' };
        const image = item.food?.image_url ?? '';
        return <article key={foodId} className="rounded-2xl border border-stone-100 bg-white p-4 shadow-sm sm:p-5">
          <div className="flex items-center gap-3"><div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-stone-50">{image && <img src={foodImageUrl(image)} alt={item.name_snapshot} onError={handleFoodItemImageError} className="h-full w-full object-contain"/>}</div><div className="min-w-0"><h2 className="break-words font-extrabold">{item.name_snapshot}</h2><p className="mt-1 text-xs text-stone-500">{item.quantity} ordered{item.size ? ` · ${item.size}` : ''}</p></div></div>
          <div className="mt-4" role="group" aria-label={`Rate ${item.name_snapshot}`}><p className="mb-2 text-sm font-semibold text-stone-700">Your rating</p><div className="flex gap-1">{[1, 2, 3, 4, 5].map(star => <button key={star} type="button" aria-label={`${star} star${star === 1 ? '' : 's'}`} aria-pressed={draft.rating === star} onClick={() => setDraft(foodId, { rating: star })} className="flex h-11 w-11 items-center justify-center rounded-xl text-stone-300 transition hover:scale-110 hover:bg-brand-pale active:scale-95" title={`${star} stars`}><Star size={25} className={star <= draft.rating ? 'animate-heart-pop fill-brand-orange text-brand-orange' : 'fill-transparent'}/></button>)}</div></div>
          <label className="mt-4 block text-sm font-semibold text-stone-700">Tell us about your experience <span className="font-normal text-stone-400">(optional)</span><textarea maxLength={1000} rows={3} value={draft.review_text} onChange={event => setDraft(foodId, { review_text: event.target.value })} placeholder="Write your review…" className="mt-2 w-full resize-y rounded-xl border border-stone-200 bg-white p-3 text-sm outline-none transition placeholder:text-stone-400 focus:border-brand-orange focus:ring-2 focus:ring-brand-orange/15"/><span className="mt-1 block text-right text-xs font-normal text-stone-400">{draft.review_text.length}/1000</span></label>
        </article>;
      })}</div>
      {submitError && <p role="alert" className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">{submitError}</p>}
      {!allRated && <p className="mt-4 text-xs text-stone-500">Choose a star rating for each food item to submit.</p>}
      <button type="button" disabled={!allRated || mutation.isPending || !selectedOrder} onClick={() => { setSubmitError(''); mutation.mutate(); }} className="mt-5 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-brand-orange px-5 text-sm font-extrabold text-white transition hover:bg-brand-burnt disabled:cursor-not-allowed disabled:opacity-50">{mutation.isPending ? <><LoaderCircle size={17} className="animate-spin"/>Submitting…</> : <>{isEditing ? 'Update Review' : 'Submit Review'}<ArrowRight size={17}/></>}</button>
    </div>;
  }

  const deliveredCount = deliveredOrders.length;
  return <div className="mx-auto max-w-3xl">
    <header className="mb-5"><h1 className="text-3xl font-black">Your reviews</h1><p className="mt-1 text-sm text-stone-500">Rate the food from your delivered orders.</p></header>
    {submitted && <p role="status" className="mb-4 rounded-2xl bg-green-50 p-4 text-sm font-semibold text-green-800">Thank you for your feedback! ❤️</p>}
    {deliveredCount ? <div className="space-y-4">{deliveredOrders.map(order => <DeliveredOrderReviewCard key={order.id} order={order}/>)}</div>
      : <section className="rounded-3xl border border-dashed border-stone-300 bg-white p-8 text-center"><MessageCircleHeart size={34} className="mx-auto text-brand-orange"/><h2 className="mt-3 text-lg font-extrabold">No delivered orders to review yet</h2><p className="mt-1 text-sm text-stone-500">When one of your orders is delivered, we’ll invite you to rate its food items here.</p><Link to="/orders" className="mt-5 inline-flex items-center gap-2 text-sm font-bold text-brand-burnt">View your orders <ArrowRight size={16}/></Link></section>}
  </div>;
}

function DeliveredOrderReviewCard({ order }: { order: CustomerOrder }) {
  const items = uniqueReviewItems(order);
  const reviewedIds = new Set(order.reviews.filter(review => review.food_item_id).map(review => review.food_item_id));
  const isComplete = items.length > 0 && items.every(item => reviewedIds.has(item.food_item_id));
  const hasAnyReview = items.some(item => reviewedIds.has(item.food_item_id));
  return <article className="rounded-2xl border border-stone-100 bg-white p-4 shadow-sm sm:p-5">
    <div className="flex flex-wrap items-start justify-between gap-2"><div><p className="text-xs font-semibold uppercase tracking-wide text-stone-400">Delivered order</p><h2 className="mt-1 font-extrabold">#{order.id.slice(0, 8).toUpperCase()}</h2><p className="mt-1 text-xs text-stone-500">{format(new Date(order.created_at), 'dd MMM yyyy, h:mm a')}</p></div><span className="rounded-full bg-green-50 px-3 py-1 text-xs font-bold text-green-700">Delivered</span></div>
    <p className="mt-3 text-sm text-stone-600">{items.map(item => item.name_snapshot).join(', ') || 'No reviewable food items'}</p>
    {isComplete ? <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-green-50 p-3"><span className="inline-flex items-center gap-2 text-sm font-semibold text-green-800"><CheckCircle2 size={17}/>Thank you for rating your order ❤️</span><Link to={`/reviews/${order.id}`} className="text-sm font-bold text-green-800 underline">Edit reviews</Link></div>
      : <div className="mt-4 rounded-xl bg-brand-pale p-4"><p className="text-sm font-extrabold text-brand-ink">Your order has been delivered! 🎉</p><p className="mt-1 text-sm text-stone-600">How was your food? Rate your items and help us serve you better.</p><Link to={`/reviews/${order.id}`} className="mt-3 inline-flex min-h-10 items-center gap-2 rounded-xl bg-brand-orange px-4 text-sm font-bold text-white">{hasAnyReview ? 'Continue your review ⭐' : 'Rate Your Food ⭐'}<ArrowRight size={15}/></Link></div>}
  </article>;
}

function uniqueReviewItems(order: CustomerOrder): CustomerOrderItem[] {
  const seen = new Set<string>();
  return order.order_items.filter(item => {
    if (!item.food_item_id || seen.has(item.food_item_id)) return false;
    seen.add(item.food_item_id);
    return true;
  });
}
