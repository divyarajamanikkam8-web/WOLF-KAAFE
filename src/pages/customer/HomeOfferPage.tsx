import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight, CircleAlert, Sparkles, Star } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { FoodCard } from '../../components/FoodCard';
import { getActiveHomeSpecialOfferById, getHomeOfferFoods } from '../../services/homeOfferService';

export function HomeOfferPage() {
  const { offerId = '' } = useParams();
  const offer = useQuery({ queryKey: ['home-special-offer', offerId], queryFn: () => getActiveHomeSpecialOfferById(offerId), enabled: Boolean(offerId), staleTime: 0, refetchOnMount: 'always', refetchOnWindowFocus: true, refetchOnReconnect: true, refetchInterval: 60_000 });
  const foods = useQuery({ queryKey: ['home-offer-foods', offerId, offer.data?.food_item_ids], queryFn: () => getHomeOfferFoods(offer.data!.food_item_ids), enabled: Boolean(offer.data), staleTime: 0, refetchOnMount: 'always', refetchOnWindowFocus: true, refetchOnReconnect: true });

  if (offer.isLoading) return <div role="status" className="mx-auto max-w-5xl rounded-2xl bg-white p-6 text-sm text-stone-500">Loading offer…</div>;
  if (offer.isError) return <OfferMessage title="Could not load this offer" message={offer.error.message} retry={() => void offer.refetch()}/>;
  if (!offer.data) return <OfferMessage title="Offer no longer available" message="This offer may have expired or been deactivated."/>;

  return <div className="mx-auto max-w-6xl space-y-6">
    <Link to="/home" className="inline-flex min-h-10 items-center gap-2 text-sm font-bold text-stone-500 hover:text-brand-burnt"><ArrowLeft size={17}/>Back to Home</Link>
    <section className="relative isolate min-h-44 overflow-hidden rounded-3xl bg-[linear-gradient(115deg,#1b1110_0%,#3a1b14_54%,#863411_100%)] p-5 text-white shadow-lg sm:min-h-48 sm:p-7">
      {offer.data.video_url ? <video src={offer.data.video_url} autoPlay muted loop playsInline aria-label={offer.data.heading} className="absolute inset-y-0 right-0 h-full w-[42%] object-cover opacity-80 [mask-image:linear-gradient(to_right,transparent_0%,black_45%,black_100%)]"/> : offer.data.image_url ? <img src={offer.data.image_url} alt={offer.data.heading} className="absolute inset-y-0 right-0 h-full w-[42%] object-contain object-center"/> : null}
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_78%_50%,rgba(249,115,22,.22),transparent_45%)]"/>
      <div className="relative z-10 max-w-[70%] sm:max-w-[65%]">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-200/35 bg-[#5b2b18]/75 px-3 py-1.5 text-[10px] font-extrabold uppercase tracking-[.14em] text-orange-50"><Sparkles size={13}/>{offer.data.title}</span>
        <h1 className="mt-3 text-2xl font-black leading-tight sm:text-3xl">{offer.data.heading}</h1>
        {offer.data.description && <p className="mt-2 max-w-xl text-sm leading-relaxed text-orange-50/80">{offer.data.description}</p>}
        <div className="mt-3 flex flex-wrap items-center gap-3">{(offer.data.discount_percentage > 0 || offer.data.discount_text) && <span className="rounded-lg border border-amber-200/30 bg-stone-950/40 px-3 py-1.5 text-xs font-black uppercase tracking-wide text-amber-100">{offer.data.discount_percentage > 0 ? `${offer.data.discount_percentage}% OFF` : offer.data.discount_text}</span>}<span className="inline-flex items-center gap-1 text-xs font-semibold text-orange-100"><Star size={14} className="fill-orange-300 text-orange-300"/>Offer foods selected by The Wolf Kaafe</span></div>
      </div>
    </section>

    <section aria-labelledby="offer-foods-heading">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-2"><div><p className="text-xs font-bold uppercase tracking-[.16em] text-brand-burnt">{offer.data.title}</p><h2 id="offer-foods-heading" className="mt-1 text-xl font-black sm:text-2xl">Special Offer Foods</h2></div><Link to="/home" className="inline-flex min-h-10 items-center gap-1 text-xs font-bold text-brand-burnt">Browse full menu <ArrowRight size={14}/></Link></div>
      {foods.isLoading ? <div role="status" className="rounded-2xl bg-white p-6 text-sm text-stone-500">Loading offer foods…</div>
        : foods.isError ? <div role="alert" className="rounded-2xl bg-red-50 p-5 text-sm text-red-700">Could not load the foods for this offer. <button type="button" onClick={() => void foods.refetch()} className="font-bold underline">Retry</button></div>
          : foods.data?.length ? <div className="grid min-w-0 grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-4">{foods.data.map(food => <FoodCard key={food.id} food={food} offer={{ id: offer.data!.id, discountPercentage: offer.data!.discount_percentage }}/>)}</div>
            : <div className="rounded-2xl bg-white px-5 py-12 text-center shadow-sm"><h3 className="font-extrabold">No dishes are currently available for this offer.</h3><p className="mt-1 text-sm text-stone-500">Please check back later or browse the full menu.</p><Link to="/home" className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-xl bg-brand-orange px-4 text-sm font-bold text-white">Back to Home<ArrowRight size={15}/></Link></div>}
    </section>
  </div>;
}

function OfferMessage({ title, message, retry }: { title: string; message: string; retry?: () => void }) {
  return <section className="mx-auto max-w-xl rounded-3xl bg-white p-7 text-center shadow-sm"><span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-orange-50 text-brand-burnt"><CircleAlert size={22}/></span><h1 className="mt-3 text-xl font-black">{title}</h1><p className="mt-2 text-sm text-stone-500">{message}</p><div className="mt-5 flex flex-wrap justify-center gap-3">{retry && <button type="button" onClick={retry} className="inline-flex min-h-11 items-center rounded-xl border border-stone-200 px-4 text-sm font-bold">Retry</button>}<Link to="/home" className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-brand-orange px-4 text-sm font-bold text-white">Back to Home<ArrowRight size={15}/></Link></div></section>;
}
