import { useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ImagePlus, LoaderCircle, Pencil, Plus, Trash2, Upload, Video } from 'lucide-react';
import { getAdminMenu } from '../../services/adminMenuService';
import { deleteHomeSpecialOffer, getAdminHomeSpecialOffers, getHomeOfferMediaPath, removeHomeOfferMedia, saveHomeSpecialOffer, uploadHomeOfferMedia, type HomeSpecialOffer, type HomeSpecialOfferInput } from '../../services/homeOfferService';

type OfferForm = Omit<HomeSpecialOfferInput, 'start_date' | 'end_date'> & { start_date: string; end_date: string };
const emptyForm: OfferForm = { title: '', heading: '', description: '', discount_text: '', discount_percentage: 0, button_text: 'View Offers', image_url: null, video_url: null, is_active: false, start_date: '', end_date: '', display_order: 0, food_item_ids: [] };

function dateInput(value: string | null) {
  if (!value) return '';
  const date = new Date(value);
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

export function AdminOffersPage() {
  const queryClient = useQueryClient();
  const editorRef = useRef<HTMLElement>(null);
  const titleInputRef = useRef<HTMLInputElement>(null);
  const offers = useQuery({ queryKey: ['admin-home-offers'], queryFn: getAdminHomeSpecialOffers, staleTime: 15_000 });
  const menu = useQuery({ queryKey: ['admin-menu'], queryFn: getAdminMenu, staleTime: 30_000 });
  const [editing, setEditing] = useState<HomeSpecialOffer | null>(null);
  const [form, setForm] = useState<OfferForm>(emptyForm);
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [pageError, setPageError] = useState('');
  const [pageMessage, setPageMessage] = useState('');
  const preview = useMemo(() => mediaFile ? URL.createObjectURL(mediaFile) : form.video_url || form.image_url, [mediaFile, form.video_url, form.image_url]);
  useEffect(() => () => { if (mediaFile && preview?.startsWith('blob:')) URL.revokeObjectURL(preview); }, [mediaFile, preview]);

  const save = useMutation({
    mutationFn: async () => {
      if (!form.title.trim() || !form.heading.trim()) throw new Error('Enter an offer title and heading.');
      if (!form.button_text.trim()) throw new Error('Enter text for the offer button.');
      if (!Number.isFinite(form.discount_percentage) || form.discount_percentage < 0 || form.discount_percentage > 100) throw new Error('Discount must be between 0 and 100%.');
      if (!form.food_item_ids.length) throw new Error('Choose at least one food item for this offer.');
      const start = form.start_date ? new Date(form.start_date).toISOString() : null;
      const end = form.end_date ? new Date(form.end_date).toISOString() : null;
      if (start && end && start >= end) throw new Error('End date must be later than start date.');
      let uploaded: Awaited<ReturnType<typeof uploadHomeOfferMedia>> | null = null;
      const input: HomeSpecialOfferInput = {
        ...form,
        title: form.title.trim(), heading: form.heading.trim(), description: form.description.trim(),
        discount_text: form.discount_text.trim(), button_text: form.button_text.trim(),
        image_url: form.image_url, video_url: form.video_url,
        start_date: start, end_date: end, display_order: Number(form.display_order) || 0,
      };
      try {
        if (mediaFile) {
          uploaded = await uploadHomeOfferMedia(mediaFile);
          input.image_url = uploaded.kind === 'image' ? uploaded.url : null;
          input.video_url = uploaded.kind === 'video' ? uploaded.url : null;
        }
        await saveHomeSpecialOffer(input, editing?.id);
      } catch (error) {
        if (uploaded) await removeHomeOfferMedia(uploaded.path).catch(() => undefined);
        throw error;
      }
      const previous = editing?.image_url || editing?.video_url;
      const next = input.image_url || input.video_url;
      if (previous && previous !== next) {
        const oldPath = getHomeOfferMediaPath(previous);
        if (oldPath) await removeHomeOfferMedia(oldPath).catch(() => undefined);
      }
    },
    onSuccess: async () => {
      setPageError(''); setPageMessage('Offer saved. Active eligible offers appear on the customer home page.');
      setEditing(null); setForm(emptyForm); setMediaFile(null);
      await Promise.all([queryClient.invalidateQueries({ queryKey: ['admin-home-offers'] }), queryClient.invalidateQueries({ queryKey: ['home-special-offer'] })]);
    },
    onError: error => { setPageError(error instanceof Error ? error.message : 'Could not save this offer.'); setPageMessage(''); },
  });

  const remove = useMutation({
    mutationFn: async (offer: HomeSpecialOffer) => {
      await deleteHomeSpecialOffer(offer.id);
      const media = offer.image_url || offer.video_url;
      const path = getHomeOfferMediaPath(media);
      if (path) await removeHomeOfferMedia(path).catch(() => undefined);
    },
    onSuccess: async () => {
      setPageMessage('Offer deleted.'); setPageError('');
      await Promise.all([queryClient.invalidateQueries({ queryKey: ['admin-home-offers'] }), queryClient.invalidateQueries({ queryKey: ['home-special-offer'] })]);
    },
    onError: error => { setPageError(error instanceof Error ? error.message : 'Could not delete this offer.'); setPageMessage(''); },
  });

  const editOffer = (offer: HomeSpecialOffer) => {
    setEditing(offer); setPageError(''); setPageMessage(''); setMediaFile(null);
    setForm({ title: offer.title, heading: offer.heading, description: offer.description, discount_text: offer.discount_text, discount_percentage: offer.discount_percentage, button_text: offer.button_text, image_url: offer.image_url, video_url: offer.video_url, is_active: offer.is_active, start_date: dateInput(offer.start_date), end_date: dateInput(offer.end_date), display_order: offer.display_order, food_item_ids: offer.food_item_ids });
    window.requestAnimationFrame(() => {
      editorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      window.setTimeout(() => titleInputRef.current?.focus({ preventScroll: true }), 250);
    });
  };

  const set = <K extends keyof OfferForm>(key: K, value: OfferForm[K]) => setForm(current => ({ ...current, [key]: value }));
  const foods = (menu.data?.foods ?? []).filter(food => food.is_active);

  return <div className="mx-auto max-w-5xl space-y-5">
    <header><p className="text-xs font-extrabold uppercase tracking-[.16em] text-brand-burnt">Customer home page</p><h1 className="mt-1 text-2xl font-black sm:text-3xl">Special Offer Banner</h1><p className="mt-1 text-sm text-stone-500">Manage the promotional banner, its schedule, media, and featured foods.</p></header>
    {pageError && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{pageError}</p>}
    {pageMessage && <p role="status" className="rounded-xl bg-green-50 p-3 text-sm text-green-800">{pageMessage}</p>}
    <section ref={editorRef} className="scroll-mt-24 rounded-2xl border border-stone-100 bg-white p-4 shadow-sm sm:p-6">
      <div className="mb-4 flex items-center justify-between gap-3"><div><h2 className="font-extrabold">{editing ? 'Edit offer' : 'Create offer'}</h2><p className="mt-1 text-xs text-stone-500">The top active offer within its schedule appears on Home.</p></div>{editing && <button type="button" onClick={() => { setEditing(null); setForm(emptyForm); setMediaFile(null); }} className="text-xs font-bold text-stone-500 underline">Cancel edit</button>}</div>
      <form onSubmit={event => { event.preventDefault(); setPageError(''); setPageMessage(''); save.mutate(); }} className="grid gap-4 sm:grid-cols-2">
        <Field label="Offer title"><input ref={titleInputRef} required value={form.title} onChange={event => set('title', event.target.value)} placeholder="Weekend Special" className={inputClass}/></Field>
        <Field label="Main heading"><input required value={form.heading} onChange={event => set('heading', event.target.value)} placeholder="Get 30% OFF on Burgers" className={inputClass}/></Field>
        <Field label="Description"><textarea value={form.description} onChange={event => set('description', event.target.value)} rows={2} className={inputClass} placeholder="Order your favourite burgers today!"/></Field>
        <div className="grid grid-cols-2 gap-3"><Field label="Discount percentage"><div className="relative"><input type="number" min="0" max="100" step="0.01" value={form.discount_percentage} onChange={event => set('discount_percentage', Math.min(100, Math.max(0, Number(event.target.value) || 0)))} className={`${inputClass} pr-8`}/><span className="absolute right-3 top-3 text-stone-500">%</span></div></Field><Field label="Discount badge text"><input value={form.discount_text} onChange={event => set('discount_text', event.target.value)} placeholder="30% OFF" className={inputClass}/></Field></div>
        <Field label="Starts at"><input type="datetime-local" value={form.start_date} onChange={event => set('start_date', event.target.value)} className={inputClass}/></Field>
        <Field label="Ends at"><input type="datetime-local" value={form.end_date} onChange={event => set('end_date', event.target.value)} className={inputClass}/></Field>
        <Field label="Display order"><input type="number" value={form.display_order} onChange={event => set('display_order', Number(event.target.value))} className={inputClass}/></Field>
        <div className="flex flex-col gap-2"><label className="text-xs font-bold">Promotional image or video</label><label className="flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-stone-300 px-3 text-sm font-semibold text-stone-600 hover:bg-stone-50"><Upload size={16}/>{mediaFile ? mediaFile.name : 'Choose image or MP4/WebM'}<input type="file" accept="image/jpeg,image/png,image/webp,image/avif,video/mp4,video/webm" onChange={event => { setMediaFile(event.target.files?.[0] ?? null); }} className="sr-only"/></label>{preview && <div className="relative h-32 overflow-hidden rounded-xl bg-stone-900">{mediaFile?.type.startsWith('video/') || (!mediaFile && form.video_url) ? <video src={preview} muted playsInline className="h-full w-full object-contain"/> : <img src={preview} alt="Promotional media preview" className="h-full w-full object-contain"/>}</div>}{(form.image_url || form.video_url || mediaFile) && <button type="button" onClick={() => { setMediaFile(null); set('image_url', null); set('video_url', null); }} className="self-start text-xs font-bold text-red-700 underline">Remove media</button>}<p className="text-[11px] text-stone-500">JPG, PNG, WebP, AVIF, MP4, or WebM · up to 50 MB</p></div>
        <div className="flex min-w-0 flex-col gap-1.5"><span className="text-xs font-bold">Foods shown by View Offers</span><div className="max-h-48 space-y-1 overflow-y-auto rounded-xl border border-stone-200 p-2">{foods.map(food => <label key={food.id} className="flex min-h-9 items-center gap-2 rounded-lg px-2 text-xs hover:bg-stone-50"><input type="checkbox" checked={form.food_item_ids.includes(food.id)} onChange={event => set('food_item_ids', event.target.checked ? [...form.food_item_ids, food.id] : form.food_item_ids.filter(id => id !== food.id))} className="accent-orange-600"/><span className="min-w-0 flex-1 truncate">{food.name}</span></label>)}{menu.isLoading && <p className="p-2 text-xs text-stone-500">Loading menu foods…</p>}{!menu.isLoading && !foods.length && <p className="p-2 text-xs text-stone-500">No active food items are available.</p>}</div>{form.food_item_ids.length > 0 && <div className="rounded-xl bg-orange-50/70 p-3 text-xs"><p className="mb-2 font-bold text-brand-burnt">Selected food price preview · {form.discount_percentage}% OFF</p><div className="space-y-1.5">{foods.filter(food => form.food_item_ids.includes(food.id)).map(food => { const original = food.regular_price ?? food.price; const discounted = Math.round(original * (1 - form.discount_percentage / 100) * 100) / 100; return <div key={food.id} className="flex justify-between gap-3"><span className="truncate">{food.name}</span><span className="shrink-0"><span className="text-stone-400 line-through">₹{original.toFixed(2)}</span> → <b>₹{discounted.toFixed(2)}</b></span></div>; })}</div></div>}<p className="text-[11px] text-stone-500">Select only foods included in this offer. At least one is required.</p></div>
        <div className="flex flex-col gap-3 sm:justify-end"><label className="flex min-h-11 items-center gap-2 text-sm font-semibold"><input type="checkbox" checked={form.is_active} onChange={event => set('is_active', event.target.checked)} className="h-4 w-4 accent-orange-600"/>Offer is active</label><button type="submit" disabled={save.isPending || menu.isLoading} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-brand-orange px-4 text-sm font-extrabold text-white disabled:opacity-50">{save.isPending ? <LoaderCircle size={16} className="animate-spin"/> : <Plus size={16}/>} {save.isPending ? 'Saving…' : editing ? 'Save changes' : 'Create offer'}</button></div>
      </form>
    </section>
    <section className="overflow-hidden rounded-2xl border border-stone-100 bg-white shadow-sm"><div className="border-b border-stone-100 p-4"><h2 className="font-extrabold">Offers</h2></div>{offers.isLoading ? <p className="p-5 text-sm text-stone-500">Loading offers…</p> : offers.isError ? <p role="alert" className="p-5 text-sm text-red-700">Could not load home offers. Apply migrations 202610070005_home_special_offers.sql and 202610080001_offer_discount_pricing.sql, then retry.</p> : offers.data?.length ? <div className="divide-y divide-stone-100">{offers.data.map(offer => <article key={offer.id} className="flex flex-wrap items-center gap-3 p-4"><div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-stone-100 text-stone-400">{offer.video_url ? <Video size={22}/> : offer.image_url ? <img src={offer.image_url} alt="" className="h-full w-full object-cover"/> : <ImagePlus size={22}/>}</div><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h3 className="font-bold">{offer.title}</h3><span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${offer.is_active ? 'bg-green-50 text-green-700' : 'bg-stone-100 text-stone-500'}`}>{offer.is_active ? 'Active' : 'Inactive'}</span>{offer.discount_percentage > 0 && <span className="rounded-full bg-orange-50 px-2 py-0.5 text-[10px] font-bold text-brand-burnt">{offer.discount_percentage}% OFF</span>}</div><p className="mt-1 truncate text-xs text-stone-500">{offer.heading} · {offer.food_item_ids.length} foods · Order {offer.display_order}</p></div><button type="button" onClick={() => editOffer(offer)} aria-label={`Edit ${offer.title}`} className="inline-flex min-h-10 items-center gap-1.5 rounded-lg border border-stone-200 px-3 text-xs font-bold"><Pencil size={14}/>Edit</button><button type="button" onClick={() => { if (window.confirm(`Delete “${offer.title}”?`)) remove.mutate(offer); }} aria-label={`Delete ${offer.title}`} disabled={remove.isPending} className="flex h-10 w-10 items-center justify-center rounded-lg border border-red-100 text-red-600 disabled:opacity-50"><Trash2 size={15}/></button></article>)}</div> : <p className="p-6 text-center text-sm text-stone-500">No home offers yet. Create one above.</p>}</section>
  </div>;
}

const inputClass = 'min-h-11 w-full rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm outline-none focus:border-brand-orange';
function Field({ label, children }: { label: string; children: ReactNode }) { return <label className="flex min-w-0 flex-col gap-1.5 text-xs font-bold">{label}{children}</label>; }
