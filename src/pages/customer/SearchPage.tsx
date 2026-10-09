import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, Search, X } from 'lucide-react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useMenu } from '../../hooks/useMenu';
import { useCategories } from '../../hooks/useCategories';
import { foodImageUrl, handleFoodItemImageError } from '../../utils/imageUrl';

const normalizeSearchText = (value: string | null | undefined) => (value ?? '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .trim()
  .replace(/\s+/g, ' ')
  .toLowerCase()
  .replace(/\bbiriyani\b/g, 'biryani');

function hasMeaningfulTerm(field: string, query: string) {
  const words = field.split(' ').filter(Boolean);
  const queryWords = query.split(' ').filter(Boolean);
  if (!queryWords.length) return false;
  return words.some((_, start) => queryWords.every((queryWord, offset) =>
    words[start + offset]?.startsWith(queryWord)));
}

export function SearchPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState(searchParams.get('q') ?? '');
  const [showAll, setShowAll] = useState(false);
  const { data: foods = [], isLoading, isError, refetch } = useMenu();
  const { data: categories = [] } = useCategories();
  const normalizedQuery = normalizeSearchText(query);
  const results = useMemo(() => {
    if (!normalizedQuery) return [];
    return foods
      .map((food, index) => {
        const name = normalizeSearchText(food.name);
        const category = normalizeSearchText(food.category);
        const description = normalizeSearchText(food.description);
        const rank = name === normalizedQuery ? 0
          : name.startsWith(normalizedQuery) ? 1
          : hasMeaningfulTerm(name, normalizedQuery) ? 2
          : category.startsWith(normalizedQuery) ? 3
          : hasMeaningfulTerm(category, normalizedQuery) ? 4
          : normalizedQuery.length >= 3 && hasMeaningfulTerm(description, normalizedQuery) ? 7
          : Number.POSITIVE_INFINITY;
        return { food, index, rank };
      })
      .filter(result => Number.isFinite(result.rank))
      .sort((a, b) => a.rank - b.rank || a.index - b.index)
      .map(result => result.food);
  }, [foods, normalizedQuery]);
  const visibleResults = showAll ? results : results.slice(0, 6);

  const updateQuery = (value: string) => {
    setQuery(value);
    setShowAll(false);
  };

  useEffect(() => { inputRef.current?.focus(); }, []);

  const goBack = () => {
    if (window.history.length > 1) navigate(-1);
    else navigate('/home', { replace: true });
  };

  return <div className="mx-auto flex min-h-[calc(100dvh-2.5rem)] min-w-0 max-w-2xl flex-col">
    <form onSubmit={event => event.preventDefault()} className="sticky top-0 z-10 -mx-4 flex items-center gap-2 border-b border-stone-100 bg-stone-50 px-4 py-2">
      <button type="button" onClick={goBack} aria-label="Go back" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-stone-700"><ArrowLeft size={21}/></button>
      <label className="flex min-w-0 flex-1 items-center gap-2 rounded-2xl border border-stone-200 bg-white px-3 shadow-sm focus-within:border-stone-300">
        <Search size={19} className="shrink-0 text-stone-400"/>
        <input ref={inputRef} value={query} onChange={event => updateQuery(event.target.value)} type="search" autoComplete="off" autoCorrect="off" spellCheck={false} aria-label="Search food or category" placeholder="Search food or category..." className="h-12 min-w-0 flex-1 bg-transparent text-base outline-none focus-visible:outline-none [appearance:textfield] [&::-webkit-search-cancel-button]:hidden" />
        {query && <button type="button" onClick={() => { updateQuery(''); inputRef.current?.focus(); }} aria-label="Clear search" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-stone-500"><X size={18}/></button>}
      </label>
    </form>

    {!normalizedQuery ? <section className="pt-7">
      <h1 className="text-xl font-extrabold">Search for your favourite food</h1>
      <h2 className="mt-7 text-sm font-bold text-stone-600">Popular searches</h2>
      <div className="mt-3 flex flex-wrap gap-2">{categories.slice(0, 4).map(category => <button key={category.id} type="button" onClick={() => { updateQuery(category.name); inputRef.current?.focus(); }} className="rounded-full border border-stone-200 bg-white px-4 py-2.5 text-sm font-semibold text-stone-700">{category.name}</button>)}</div>
    </section> : <section className="min-w-0 flex-1 pt-5" aria-live="polite">
      <h1 className="mb-3 text-base font-extrabold">Search results</h1>
      {isLoading ? <p className="py-8 text-center text-sm text-stone-500">Searching…</p>
        : isError ? <div role="alert" className="rounded-2xl bg-red-50 p-4 text-sm text-red-700">Could not load search results. <button onClick={() => void refetch()} className="font-bold underline">Retry</button></div>
        : results.length ? <><div className="divide-y divide-stone-100 overflow-hidden rounded-2xl border border-stone-100 bg-white">{visibleResults.map(food => <Link key={food.id} to={`/food/${food.id}`} className="flex min-w-0 items-center gap-3 p-3 transition hover:bg-stone-50 sm:gap-4 sm:p-4">
          {food.image?.trim() && <img src={foodImageUrl(food.image)} alt={food.name} onError={handleFoodItemImageError} loading="lazy" decoding="async" className="h-[68px] w-[68px] shrink-0 rounded-xl bg-stone-50 object-contain sm:h-20 sm:w-20" />}
          <span className="min-w-0 flex-1"><b className="line-clamp-2 break-words text-sm font-bold sm:text-base">{food.name}</b><span className="mt-1 block text-xs text-stone-500">{food.category}</span><span className="mt-1 block text-sm font-semibold text-brand-burnt">{food.regularPrice !== null ? 'From ' : ''}₹{food.regularPrice ?? food.price}</span></span>
        </Link>)}</div>{results.length > 6 && <button type="button" onClick={() => setShowAll(value => !value)} className="mt-3 w-full rounded-xl py-3 text-sm font-bold text-brand-burnt">{showAll ? 'Show fewer results' : `View all ${results.length} results`}</button>}</>
        : <div className="rounded-2xl border border-dashed border-stone-300 bg-white px-5 py-10 text-center"><h2 className="font-bold">No food found</h2><p className="mt-1 text-sm text-stone-500">Try searching for another food or category.</p></div>}
    </section>}
  </div>;
}
