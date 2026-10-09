import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { ImagePlus, LoaderCircle, Pencil, Plus, Search, Trash2, X, RotateCcw, Star } from 'lucide-react';
import { Link } from 'react-router-dom';
import { getAdminCategories, getAdminMenu, createFood, updateFood, setFoodAvailability, setFoodTodaySpecial, softDeleteFood, restoreFood, uploadFoodImage, foodImageSha256, removeFoodImage, type AdminMenuItem, type FoodInput } from '../../services/adminMenuService';
import type { FoodType } from '../../types';
import { supabase } from '../../lib/supabase';

const optionalPrice = z.preprocess(value => value === '' || value === undefined || value === null ? null : value, z.coerce.number().positive('Enter a price greater than zero.').nullable());
const foodSchema = z.object({
  name: z.string().trim().min(2, 'Enter a food name.'),
  description: z.string().trim().min(3, 'Add a short description.'),
  category_id: z.string().min(1, 'Choose a category.'),
  food_type: z.preprocess(value => value === '' ? null : value, z.enum(['VEG', 'NON_VEG', 'EGG']).nullable()),
  price: optionalPrice,
  regular_price: optionalPrice,
  large_price: optionalPrice,
  display_order: z.coerce.number().int().min(0),
  discount_percent: z.coerce.number().min(0).max(100),
  prep_minutes: z.coerce.number().int().min(1).max(240),
  is_available: z.boolean(),
  is_featured: z.boolean(),
  is_today_special: z.boolean(),
  image_url: z.string(),
}).superRefine((values, context) => {
  if (values.price === null && values.regular_price === null) context.addIssue({ code: z.ZodIssueCode.custom, path: ['price'], message: 'Enter a price or a regular price.' });
  if (values.large_price !== null && values.regular_price === null) context.addIssue({ code: z.ZodIssueCode.custom, path: ['regular_price'], message: 'A large price requires a regular price.' });
});
type FormValues = z.infer<typeof foodSchema>;

const blankFood: FormValues = { name: '', description: '', category_id: '', food_type: null, price: null, regular_price: null, large_price: null, display_order: 0, discount_percent: 0, prep_minutes: 20, is_available: true, is_featured: false, is_today_special: false, image_url: '' };
const inputClass = 'min-h-11 w-full rounded-xl border border-stone-200 bg-white px-3 text-sm outline-none focus:border-brand-orange';

export function AdminMenuPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'available' | 'out' | 'missing-image' | 'deleted' | 'today-special'>('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState<'all' | FoodType>('all');
  const [editing, setEditing] = useState<AdminMenuItem | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [removeImage, setRemoveImage] = useState(false);
  const [pageError, setPageError] = useState('');
  const [pageMessage, setPageMessage] = useState('');
  const menu = useQuery({ queryKey: ['admin-menu'], queryFn: getAdminMenu, enabled: Boolean(supabase) });
  const categories = useQuery({ queryKey: ['admin-categories'], queryFn: getAdminCategories, enabled: Boolean(supabase) });
  const { register, handleSubmit, reset, watch, setValue, formState: { errors } } = useForm<FormValues>({ resolver: zodResolver(foodSchema), defaultValues: blankFood });
  const watchedImage = watch('image_url');
  const preview = useMemo(() => imageFile ? URL.createObjectURL(imageFile) : watchedImage, [imageFile, watchedImage]);

  useEffect(() => () => { if (imageFile && preview?.startsWith('blob:')) URL.revokeObjectURL(preview); }, [imageFile, preview]);

  // Add Food may open before the category query finishes. Select the first
  // active database category when that query resolves so the form is ready.
  useEffect(() => {
    if (!editorOpen || editing || watch('category_id') || !categories.data) return;
    const firstActiveCategory = categories.data.find(category => category.is_active);
    if (firstActiveCategory) setValue('category_id', firstActiveCategory.id, { shouldValidate: true });
  }, [categories.data, editing, editorOpen, setValue, watch]);

  const refreshMenu = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['admin-menu'] }),
      queryClient.invalidateQueries({ queryKey: ['menu'] }),
      queryClient.invalidateQueries({ queryKey: ['categories'] }),
    ]);
  };

  const saveMutation = useMutation({
    mutationFn: async ({ values, file, current }: { values: FormValues; file: File | null; current: AdminMenuItem | null }) => {
      let imageUrl = values.image_url;
      let imageSha256 = current?.image_sha256 ?? null;
      let uploaded: { url: string; path: string } | null = null;
      if (file) {
        imageSha256 = await foodImageSha256(file);
        if (imageSha256 !== current?.image_sha256) {
          uploaded = await uploadFoodImage(file, imageSha256, current?.id);
          imageUrl = uploaded.url;
        }
      }
      const input: FoodInput = {
        ...values,
        category_id: values.category_id,
        food_type: values.food_type,
        price: values.regular_price ?? values.price ?? 0,
        regular_price: values.regular_price,
        large_price: values.large_price,
        display_order: values.display_order,
        image_sha256: imageUrl.trim() ? imageSha256 : null,
        is_veg: values.food_type === 'VEG',
        image_url: imageUrl.trim() || null,
        special_price: null,
        special_discount_percent: 0,
        special_starts_at: null,
        special_ends_at: null,
        is_active: current?.is_active ?? true,
      };
      try {
        if (current) await updateFood(current.id, input);
        else await createFood(input);
      } catch (error) {
        if (uploaded) await removeFoodImage(uploaded.path).catch(() => undefined);
        throw error;
      }
    },
    onSuccess: async () => {
      await refreshMenu();
      setPageError('');
      setPageMessage('Food details saved to Supabase and the customer menu refreshed.');
      setEditorOpen(false);
      setImageFile(null);
      setRemoveImage(false);
      setEditing(null);
      reset(blankFood);
    },
    onError: error => setPageError(describeMenuError(error, 'Unable to save food.')),
  });

  const availabilityMutation = useMutation({
    mutationFn: ({ id, available }: { id: string; available: boolean }) => setFoodAvailability(id, available),
    onSuccess: async () => { await refreshMenu(); setPageError(''); setPageMessage('Food availability saved and customer menu refreshed.'); },
    onError: error => setPageError(describeMenuError(error, 'Unable to update food availability.')),
  });

  const todaySpecialMutation = useMutation({
    mutationFn: ({ id, isTodaySpecial }: { id: string; isTodaySpecial: boolean }) => setFoodTodaySpecial(id, isTodaySpecial),
    onSuccess: async () => { await refreshMenu(); setPageError(''); setPageMessage('Today’s Special setting saved and the customer page refreshed.'); },
    onError: error => setPageError(describeMenuError(error, 'Unable to update Today’s Special.')),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => softDeleteFood(id),
    onSuccess: async () => { await refreshMenu(); setPageError(''); setPageMessage('Food deleted from the customer menu. You can restore it from the Deleted filter.'); },
    onError: error => setPageError(describeMenuError(error, 'Unable to delete food.')),
  });

  const restoreMutation = useMutation({
    mutationFn: (id: string) => restoreFood(id),
    onSuccess: async () => { await refreshMenu(); setPageError(''); setPageMessage('Food restored as out of stock. Mark it available when it is ready to sell.'); },
    onError: error => setPageError(describeMenuError(error, 'Unable to restore food.')),
  });

  const openEditor = (food: AdminMenuItem | null = null) => {
    setEditing(food);
    setImageFile(null);
    setRemoveImage(false);
    setPageError('');
    setPageMessage('');
    setPageMessage('');
    reset(food ? {
      name: food.name,
      description: food.description,
      category_id: categories.data?.some(category => category.id === food.category_id) ? food.category_id ?? '' : '',
      food_type: food.food_type,
      price: food.price,
      regular_price: food.regular_price,
      large_price: food.large_price,
      display_order: food.display_order,
      discount_percent: food.discount_percent,
      prep_minutes: food.prep_minutes,
      is_available: food.is_available,
      is_featured: food.is_featured,
      is_today_special: food.is_today_special,
      image_url: food.image_url ?? '',
    } : { ...blankFood, category_id: categories.data?.find(category => category.is_active)?.id ?? '' });
    setEditorOpen(true);
  };

  const submit = handleSubmit(values => {
    setPageError('');
    if (!values.image_url.trim() && !imageFile && !removeImage) {
      setPageError('Upload a unique food photo before saving this menu item. Each food needs its own image.');
      return;
    }
    saveMutation.mutate({ values, file: imageFile, current: editing });
  });

  const allFoods = menu.data?.foods ?? [];
  const todaySpecialAvailable = Boolean(menu.data?.todaySpecialAvailable);
  const shownFoods = allFoods.filter(food => {
    const searchMatches = `${food.name} ${food.description} ${food.category_name} ${food.food_type ?? ''}`.toLowerCase().includes(search.trim().toLowerCase());
    const filterMatches = filter === 'deleted' ? !food.is_active : food.is_active && (filter === 'today-special' ? food.is_today_special : filter === 'all' || (filter === 'available' ? food.is_available : filter === 'out' ? !food.is_available : !food.image_url));
    const selectedCategory = categoryFilter === 'all' || food.category_id === categoryFilter;
    const selectedType = typeFilter === 'all' || food.food_type === typeFilter;
    return searchMatches && filterMatches && selectedCategory && selectedType;
  });
  const activeCount = allFoods.filter(food => food.is_active).length;
  const outOfStockCount = allFoods.filter(food => food.is_active && !food.is_available).length;
  const missingImageCount = allFoods.filter(food => food.is_active && !food.image_url).length;

  if (!supabase) return <div className="rounded-2xl border border-stone-200 bg-white p-6"><h1 className="text-2xl font-black">Menu Management</h1><p className="mt-2 text-sm text-stone-500">Connect Supabase to manage restaurant menu items.</p></div>;

  return <div className="mx-auto max-w-[1440px]">
    <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><p className="text-xs font-extrabold uppercase tracking-[.18em] text-brand-burnt">Restaurant catalog</p><h1 className="mt-2 text-2xl font-black sm:text-3xl">Menu Management</h1><p className="mt-1 text-sm text-stone-500">Manage the items customers see in the app.</p></div><button type="button" onClick={() => openEditor()} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-brand-orange px-4 text-sm font-bold text-white"><Plus size={17}/>Add Food</button></div>

    <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4"><Metric label="Total active items" value={activeCount}/><Metric label="Missing food photos" value={missingImageCount}/><Metric label="Out of stock" value={outOfStockCount}/><Metric label="Total records" value={allFoods.length}/></div>

    {pageError && <MenuErrorNotice message={pageError} className="mt-4"/>}
    {pageMessage && <p role="status" className="mt-4 rounded-xl bg-green-50 p-3 text-sm text-green-700">{pageMessage}</p>}
    {menu.isError && <div role="alert" className="mt-4 rounded-xl bg-red-50 p-4 text-sm text-red-700">Could not load menu items. Check Admin permissions or the latest menu migration. <button type="button" onClick={() => void menu.refetch()} className="ml-1 font-bold underline">Retry</button></div>}
    {!menu.isLoading && menu.data && !todaySpecialAvailable && <p role="status" className="mt-4 rounded-xl bg-amber-50 p-3 text-sm text-amber-900">Menu management is available. Apply migration 202610050003_today_special_menu.sql to enable Today’s Special settings.</p>}
    {categories.isError && <p role="alert" className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">Could not load menu categories. Food can’t be saved until categories are available. <button type="button" onClick={() => void categories.refetch()} className="ml-1 font-bold underline">Retry</button></p>}

    <section className="mt-5 overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm">
      <div className="flex flex-col gap-3 border-b border-stone-100 p-4 sm:p-5"><div><h2 className="font-extrabold">Food Items</h2><p className="mt-1 text-xs text-stone-500">Changes sync to the customer menu.</p></div><div className="grid min-w-0 gap-2 sm:grid-cols-2 xl:grid-cols-4"><label className="flex min-h-10 min-w-0 items-center gap-2 rounded-xl border border-stone-200 px-3"><Search size={16} className="shrink-0 text-stone-400"/><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Search food or category" aria-label="Search menu items" className="min-w-0 flex-1 text-sm outline-none"/></label><select value={categoryFilter} onChange={event => setCategoryFilter(event.target.value)} aria-label="Filter by category" className="min-h-10 rounded-xl border border-stone-200 bg-white px-3 text-sm"><option value="all">All categories</option>{categories.data?.map(category => <option key={category.id} value={category.id}>{category.name}</option>)}</select><select value={typeFilter} onChange={event => setTypeFilter(event.target.value as typeof typeFilter)} aria-label="Filter by food type" className="min-h-10 rounded-xl border border-stone-200 bg-white px-3 text-sm"><option value="all">All food types</option><option value="VEG">Veg</option><option value="NON_VEG">Non-Veg</option><option value="EGG">Egg</option></select><select value={filter} onChange={event => setFilter(event.target.value as typeof filter)} aria-label="Filter by availability or special status" className="min-h-10 rounded-xl border border-stone-200 bg-white px-3 text-sm"><option value="all">All active items</option><option value="today-special">Today’s Special</option><option value="available">Available</option><option value="out">Out of stock</option><option value="missing-image">Missing food photos</option><option value="deleted">Inactive records</option></select></div></div>
      {menu.isLoading ? <div className="space-y-3 p-4">{[0,1,2,3].map(item => <div key={item} className="h-16 animate-pulse rounded-xl bg-stone-100"/>)}</div> : shownFoods.length ? <div className="divide-y divide-stone-100">{shownFoods.map(food => <FoodRow key={food.id} food={food} pending={availabilityMutation.isPending || todaySpecialMutation.isPending || deleteMutation.isPending || restoreMutation.isPending} onEdit={() => openEditor(food)} onAvailability={() => { setPageError(''); setPageMessage(''); availabilityMutation.mutate({ id: food.id, available: !food.is_available }); }} onTodaySpecial={() => { setPageError(''); setPageMessage(''); todaySpecialMutation.mutate({ id: food.id, isTodaySpecial: !food.is_today_special }); }} onDelete={() => { if (window.confirm(`Delete “${food.name}”? This hides it from customers but keeps past order records.`)) { setPageError(''); setPageMessage(''); deleteMutation.mutate(food.id); } }} onRestore={() => { setPageError(''); setPageMessage(''); restoreMutation.mutate(food.id); }}/>)}</div> : <div className="px-4 py-12 text-center"><p className="font-bold">{allFoods.length ? 'No menu items match this filter.' : 'No food items yet'}</p><p className="mt-1 text-sm text-stone-500">{filter === 'deleted' ? 'Deleted foods stay here so they can be restored.' : 'Add a food item to publish it to the customer menu.'}</p></div>}
    </section>

    {editorOpen && <div className="fixed inset-0 z-[60] flex items-end justify-center bg-brand-ink/50 p-0 sm:items-center sm:p-4" role="presentation" onMouseDown={event => { if (event.currentTarget === event.target && !saveMutation.isPending) setEditorOpen(false); }}>
      <section role="dialog" aria-modal="true" aria-labelledby="food-editor-title" className="max-h-[94dvh] w-full max-w-2xl overflow-y-auto rounded-t-3xl bg-white p-5 shadow-2xl sm:rounded-2xl sm:p-6">
        <div className="flex items-start justify-between gap-4"><div><h2 id="food-editor-title" className="text-xl font-black">{editing ? 'Edit Food' : 'Add Food'}</h2><p className="mt-1 text-sm text-stone-500">Save changes directly to the restaurant menu.</p></div><button type="button" onClick={() => !saveMutation.isPending && setEditorOpen(false)} aria-label="Close food editor" className="flex h-10 w-10 items-center justify-center rounded-xl border border-stone-200 text-stone-500"><X size={18}/></button></div>
        <form onSubmit={submit} noValidate className="mt-5 space-y-4">
          <div className="grid gap-3 sm:grid-cols-2"><FormField label="Food name" error={errors.name?.message}><input {...register('name')} className={inputClass} placeholder="e.g. Aloo Tikki Burger"/></FormField><FormField label="Category" error={errors.category_id?.message}><select {...register('category_id')} disabled={categories.isLoading || categories.isError || !categories.data?.length} className={`${inputClass} disabled:cursor-not-allowed disabled:bg-stone-50 disabled:text-stone-500`}><option value="">{categories.isLoading ? 'Loading categories…' : categories.isError ? 'Could not load categories' : categories.data?.length ? 'Select a category' : 'No active categories available'}</option>{categories.data?.map(category => <option key={category.id} value={category.id}>{category.name}</option>)}</select>{editing?.category_id && !categories.data?.some(category => category.id === editing.category_id) && <p className="mt-1 text-xs text-brand-burnt">This item used an inactive category. Choose one of the current categories before saving.</p>}{categories.isError && <button type="button" onClick={() => void categories.refetch()} className="mt-1 text-xs font-bold text-brand-burnt underline">Retry category load</button>}</FormField><FormField label="Food type"><select {...register('food_type')} className={inputClass}><option value="">Not specified</option><option value="VEG">VEG</option><option value="NON_VEG">NON-VEG</option><option value="EGG">EGG</option></select></FormField></div>
          <FormField label="Description" error={errors.description?.message}><textarea {...register('description')} className={`${inputClass} min-h-20 py-3`} placeholder="Describe this dish"/></FormField>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3"><FormField label="Single price (₹)" error={errors.price?.message}><input type="number" min="0.01" step="0.01" {...register('price')} className={inputClass} placeholder="For items without sizes"/></FormField><FormField label="Regular price (₹)" error={errors.regular_price?.message}><input type="number" min="0.01" step="0.01" {...register('regular_price')} className={inputClass}/></FormField><FormField label="Large price (₹)" error={errors.large_price?.message}><input type="number" min="0.01" step="0.01" {...register('large_price')} className={inputClass}/></FormField><FormField label="Display order"><input type="number" min="0" step="1" {...register('display_order')} className={inputClass}/></FormField><FormField label="Discount (%)"><input type="number" min="0" max="100" step="1" {...register('discount_percent')} className={inputClass}/></FormField><FormField label="Prep time (minutes)"><input type="number" min="1" max="240" {...register('prep_minutes')} className={inputClass}/></FormField></div>
          <section className="rounded-xl border border-amber-200 bg-amber-50/50 p-3 sm:p-4">
            <label className="flex min-h-11 items-center gap-3 text-sm font-bold"><input type="checkbox" {...register('is_today_special')} className="h-4 w-4 accent-orange-600"/>⭐ Today’s Special</label>
          </section>
          <div className="grid gap-3 sm:grid-cols-2"><label className="flex min-h-11 items-center gap-3 rounded-xl border border-stone-200 px-3 text-sm"><input type="checkbox" {...register('is_featured')} className="h-4 w-4 accent-orange-600"/>Featured</label><label className="flex min-h-11 items-center gap-3 rounded-xl border border-stone-200 px-3 text-sm"><input type="checkbox" {...register('is_available')} className="h-4 w-4 accent-orange-600"/>Available to order</label></div>
          <input type="hidden" {...register('image_url')}/>
          <div><label htmlFor="food-image" className="mb-2 block text-xs font-bold">Unique food photo {editing?.image_url ? '· upload a replacement or remove it' : '(required)'}</label><div className="flex flex-col gap-3 rounded-xl border border-dashed border-stone-300 p-3 sm:flex-row sm:items-center">{preview ? <img src={preview} alt="Food preview" className="h-20 w-24 rounded-lg bg-stone-100 object-cover" onError={event => { event.currentTarget.style.visibility = 'hidden'; }}/> : <span className="flex h-20 w-24 items-center justify-center rounded-lg bg-stone-100 text-stone-400"><ImagePlus size={24}/></span>}<div className="min-w-0 flex-1"><input id="food-image" type="file" accept="image/png,image/jpeg,image/webp,image/avif" onChange={event => { setImageFile(event.target.files?.[0] ?? null); setRemoveImage(false); }} className="block w-full text-xs text-stone-600 file:mr-3 file:rounded-lg file:border-0 file:bg-brand-pale file:px-3 file:py-2 file:font-bold file:text-brand-burnt"/><p className="mt-2 text-xs text-stone-500">A unique image is stored against this food item in Supabase Storage. JPG, PNG, WebP, or AVIF; maximum 8 MB.</p><button type="button" onClick={() => { setImageFile(null); setValue('image_url', '', { shouldDirty: true }); setRemoveImage(true); }} disabled={!preview} className="mt-2 text-xs font-bold text-red-700 underline disabled:hidden">Remove image</button></div></div></div>
          {pageError && <MenuErrorNotice message={pageError}/>}
          <div className="flex flex-col-reverse gap-2 border-t border-stone-100 pt-4 sm:flex-row sm:justify-end"><button type="button" disabled={saveMutation.isPending} onClick={() => setEditorOpen(false)} className="min-h-11 rounded-xl border border-stone-200 px-5 text-sm font-bold text-stone-700">Cancel</button><button type="submit" disabled={saveMutation.isPending || categories.isLoading || !categories.data?.some(category => category.is_active)} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-brand-orange px-5 text-sm font-bold text-white disabled:opacity-60">{saveMutation.isPending && <LoaderCircle size={17} className="animate-spin"/>}{saveMutation.isPending ? 'Saving…' : editing ? 'Save changes' : 'Add food'}</button></div>
        </form>
      </section>
    </div>}
  </div>;
}

function Metric({ label, value }: { label: string; value: number }) {
  return <div className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm"><p className="text-xs font-bold text-stone-500">{label}</p><b className="mt-1 block text-2xl font-black">{value}</b></div>;
}

function describeMenuError(error: unknown, fallback: string) {
  const message = error instanceof Error ? error.message : typeof error === 'object' && error && 'message' in error ? String(error.message) : '';
  if (/auth session missing|session missing|session not found|jwt expired/i.test(message)) return 'Your Owner/Admin login session is missing or expired. Sign in again, then retry saving the food.';
  if (/row-level security|permission denied|not allowed/i.test(message)) return 'Supabase blocked this change. Confirm this account has role "admin" in profiles and the food admin manage RLS policy is installed.';
  if (/0 rows|multiple \(or no\) rows|single json object/i.test(message)) return 'Supabase did not update a food row. Refresh the list and confirm the item still exists.';
  return message ? `${fallback} ${message}` : `${fallback} Check Supabase permissions and try again.`;
}

function MenuErrorNotice({ message, className = '' }: { message: string; className?: string }) {
  const requiresLogin = /Owner\/Admin login session is missing|Could not verify your Owner\/Admin login/i.test(message);
  return <p role="alert" className={`${className} rounded-xl bg-red-50 p-3 text-sm text-red-700`}>{message}{requiresLogin && <> <Link to="/admin/login" className="ml-1 font-bold underline">Sign in again</Link></>}</p>;
}

function FormField({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return <div className="min-w-0"><label className="mb-1.5 block text-xs font-bold">{label}</label>{children}{error && <p className="mt-1 text-xs text-red-700">{error}</p>}</div>;
}

function FoodRow({ food, pending, onEdit, onAvailability, onTodaySpecial, onDelete, onRestore }: { food: AdminMenuItem; pending: boolean; onEdit: () => void; onAvailability: () => void; onTodaySpecial: () => void; onDelete: () => void; onRestore: () => void }) {
  const priceLabel = food.regular_price !== null
    ? `Regular ₹${food.regular_price.toLocaleString('en-IN')}${food.large_price !== null ? ` · Large ₹${food.large_price.toLocaleString('en-IN')}` : ''}`
    : `₹${food.price.toLocaleString('en-IN')}`;
  return <article className={`flex min-w-0 flex-col gap-3 p-4 sm:grid sm:grid-cols-[72px_minmax(0,1fr)_auto] sm:items-center sm:gap-4 sm:p-5 ${!food.is_active ? 'bg-stone-50/70' : ''}`}>
    {food.image_url ? <img src={food.image_url} alt={food.name} className="h-16 w-16 rounded-xl bg-stone-100 object-cover" onError={event => { event.currentTarget.style.visibility = 'hidden'; }}/> : <span className="flex h-16 w-16 items-center justify-center rounded-xl bg-stone-100 text-stone-400"><ImagePlus size={20}/></span>}
    <div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h3 className="break-words text-sm font-extrabold">{food.name}</h3><span className={`rounded-full px-2 py-1 text-[10px] font-bold ${!food.is_active ? 'bg-stone-200 text-stone-600' : food.is_available ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>{!food.is_active ? 'Inactive' : food.is_available ? 'Available' : 'Out of stock'}</span>{food.food_type && <span className="rounded-full bg-stone-100 px-2 py-1 text-[10px] font-bold text-stone-600">{food.food_type.replace('_', '-')}</span>}{food.is_featured && <span className="rounded-full bg-brand-pale px-2 py-1 text-[10px] font-bold text-brand-burnt">Featured</span>}{food.is_today_special && <span className="rounded-full bg-amber-50 px-2 py-1 text-[10px] font-bold text-amber-800">Today’s Special</span>}</div><p className="mt-1 line-clamp-1 text-xs text-stone-500">{food.category_name} · {food.prep_minutes} min · Order {food.display_order}</p><p className="mt-1 line-clamp-2 text-xs text-stone-500">{food.description}</p><p className="mt-1 text-sm font-extrabold">{priceLabel}{food.discount_percent > 0 && <span className="ml-2 text-xs font-medium text-stone-500">{food.discount_percent}% off</span>}</p></div>
    <div className="flex flex-wrap items-center gap-2 sm:justify-end"><button type="button" onClick={onEdit} disabled={pending || !food.is_active} aria-label={`Edit ${food.name}`} className="flex min-h-10 items-center gap-2 rounded-lg border border-stone-200 px-3 text-xs font-bold text-stone-700 disabled:opacity-40"><Pencil size={15}/>Edit</button>{food.is_active && <button type="button" onClick={onTodaySpecial} disabled={pending} aria-label={`${food.is_today_special ? 'Remove' : 'Mark'} ${food.name} ${food.is_today_special ? 'from' : 'as'} Today’s Special`} aria-pressed={food.is_today_special} className={`inline-flex min-h-10 items-center gap-2 rounded-lg px-3 text-xs font-bold disabled:opacity-50 ${food.is_today_special ? 'bg-amber-100 text-amber-900' : 'bg-stone-100 text-stone-700'}`}><Star size={14} className={food.is_today_special ? 'fill-amber-500 text-amber-600' : ''}/>{food.is_today_special ? 'Remove Special' : 'Today’s Special'}</button>}{food.is_active && <button type="button" onClick={onAvailability} disabled={pending} className={`min-h-10 rounded-lg px-3 text-xs font-bold disabled:opacity-50 ${food.is_available ? 'bg-stone-100 text-stone-700' : 'bg-green-50 text-green-700'}`}>{food.is_available ? 'Mark out of stock' : 'Mark available'}</button>}{food.is_active && <button type="button" onClick={onDelete} disabled={pending} aria-label={`Delete ${food.name}`} className="flex h-10 w-10 items-center justify-center rounded-lg border border-red-100 text-red-600 disabled:opacity-50"><Trash2 size={16}/></button>}{!food.is_active && <button type="button" onClick={onRestore} disabled={pending} className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-stone-200 px-3 text-xs font-bold text-stone-700 disabled:opacity-50"><RotateCcw size={14}/>Restore</button>}</div>
  </article>;
}

