import { useSearchParams } from 'react-router-dom';
import { Search, SlidersHorizontal, SearchX, Grid2X2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { FoodCard } from '../../components/FoodCard';
import { useMenu } from '../../hooks/useMenu';
import { useCategories } from '../../hooks/useCategories';
import { HorizontalRail } from '../../components/HorizontalRail';
import { foodImageUrl, handleFoodImageError } from '../../utils/imageUrl';

export function MenuPage({ search = false }: { search?: boolean }) {
  const [params, setParams] = useSearchParams();
  const [query, setQuery] = useState(params.get('q') ?? '');
  const [category, setCategory] = useState(params.get('category') ?? 'all');
  const [veg, setVeg] = useState(false);
  const { data: menu = [], isLoading, isError, refetch } = useMenu();
  const { data: categoryData = [] } = useCategories();
  const categories = [{ id: 'all', name: 'All', image: '' }, ...categoryData];
  const filtered = useMemo(() => menu.filter(food =>
    (category === 'all' || food.categoryId === category || food.category === category) && (!veg || food.veg) &&
    `${food.name} ${food.description} ${food.category} ${food.foodType ?? ''}`.toLowerCase().includes(query.toLowerCase())),
  [menu, category, veg, query]);

  return <div>
    <div className="mb-6"><p className="text-xs font-bold uppercase tracking-[.18em] text-brand-orange">{search ? 'Find something delicious' : 'Made fresh for you'}</p><h1 className="mt-1 text-3xl font-black">{search ? 'Search' : 'Our menu'}</h1><p className="mt-2 text-sm text-stone-500">Explore the flavours you love, made fresh to order.</p></div>
    <label className="mb-4 flex min-w-0 items-center gap-3 rounded-2xl border border-stone-200 bg-white px-4 py-3"><Search size={19} className="shrink-0 text-stone-400"/><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Search food or category..." className="min-w-0 flex-1 text-sm outline-none"/><SlidersHorizontal size={17} className="shrink-0 text-stone-400"/></label>
    <HorizontalRail className="mb-4 gap-4">{categories.map(item => <button type="button" key={item.id} onClick={() => { setCategory(item.id); setParams(item.id === 'all' ? {} : { category: item.id }); }} aria-pressed={category === item.id} className={`flex w-[92px] min-w-[92px] shrink-0 snap-start flex-col items-center gap-2 py-1 text-[11px] font-bold leading-4 ${category === item.id ? 'text-brand-burnt' : 'text-stone-600'}`}>
      <span className={`flex h-[72px] w-[72px] shrink-0 items-center justify-center overflow-hidden rounded-full bg-brand-pale ${category === item.id ? 'ring-2 ring-brand-orange ring-offset-2' : ''}`}>{item.id === 'all' ? <Grid2X2 size={24} className="text-brand-burnt"/> : <img src={foodImageUrl(item.image || 'photo-1512621776951-a57141f2eefd')} alt="" loading="lazy" decoding="async" onError={handleFoodImageError} className="h-full w-full rounded-full p-3 object-contain object-center"/>}</span>
      <span className="line-clamp-2 min-h-8 w-full break-words text-center">{item.name}</span></button>)}</HorizontalRail>
    <button onClick={() => setVeg(!veg)} className={`mb-5 rounded-full border px-3 py-2 text-xs font-semibold ${veg ? 'border-green-600 bg-green-50 text-green-700' : 'border-stone-200 bg-white text-stone-600'}`}>Veg only {veg ? '✓' : ''}</button>
    {isLoading ? <div className="grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-4">{Array.from({ length: 4 }, (_, index) => <div key={index} className="animate-pulse overflow-hidden rounded-2xl bg-white"><div className="food-image-container bg-stone-200"/><div className="space-y-2 p-4"><div className="h-4 w-3/4 rounded bg-stone-200"/><div className="h-3 rounded bg-stone-100"/></div></div>)}</div>
      : isError ? <div role="alert" className="rounded-2xl bg-red-50 p-5 text-sm text-red-700">Could not load the menu. <button onClick={() => void refetch()} className="ml-2 font-bold underline">Retry</button></div>
      : filtered.length ? <div className="grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-4">{filtered.map(food => <FoodCard key={food.id} food={food}/>)}</div>
      : <div className="rounded-3xl border border-dashed border-stone-300 bg-white py-16 text-center"><SearchX size={34} className="mx-auto text-stone-400"/><h2 className="mt-3 font-bold">No dishes found</h2><p className="mt-1 text-sm text-stone-500">Try another search or category.</p></div>}
  </div>;
}
