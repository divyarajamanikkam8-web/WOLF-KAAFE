import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Heart } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { getProfileRole } from '../services/authService';
import { getCustomerFavoriteIds, setCustomerFavorite } from '../services/favoriteService';
import { supabase } from '../lib/supabase';

type FavoriteContextValue = {
  favoriteIds: string[];
  isCustomer: boolean;
  isAuthLoading: boolean;
  isFavoritesLoading: boolean;
  isFavoritesError: boolean;
  isSaving: boolean;
  errorMessage: string;
  retryFavorites: () => void;
  clearError: () => void;
  toggleFavorite: (foodItemId: string) => void;
};

const CustomerFavoritesContext = createContext<FavoriteContextValue | null>(null);

export function CustomerFavoritesProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();
  const userIdRef = useRef<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [authReady, setAuthReady] = useState(!supabase);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    if (!supabase) return;
    let active = true;
    let receivedAuthEvent = false;
    const applyUser = (nextUserId: string | null) => {
      if (userIdRef.current !== nextUserId) {
        userIdRef.current = nextUserId;
        setUserId(nextUserId);
        queryClient.removeQueries({ queryKey: ['customer-favorites'] });
        queryClient.removeQueries({ queryKey: ['customer-favorite-role'] });
      }
      setAuthReady(true);
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      receivedAuthEvent = true;
      applyUser(session?.user.id ?? null);
    });
    void supabase.auth.getSession().then(({ data, error }) => {
      if (active && !receivedAuthEvent) applyUser(error ? null : data.session?.user.id ?? null);
    }).catch(() => {
      if (active && !receivedAuthEvent) applyUser(null);
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [queryClient]);

  const roleQuery = useQuery({
    queryKey: ['customer-favorite-role', userId],
    queryFn: () => getProfileRole(userId!),
    enabled: Boolean(authReady && userId),
    retry: false,
    staleTime: 60_000,
  });
  const isCustomer = Boolean(userId && roleQuery.data === 'customer');
  const customerId = isCustomer ? userId : null;
  const favoritesQuery = useQuery({
    queryKey: ['customer-favorites', customerId],
    queryFn: () => getCustomerFavoriteIds(customerId!),
    enabled: Boolean(customerId),
    staleTime: 0,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
  });
  const favoriteIds = favoritesQuery.data ?? [];
  const mutation = useMutation({
    mutationFn: ({ user, food, save }: { user: string; food: string; save: boolean }) => setCustomerFavorite(user, food, save),
    onMutate: async ({ user, food, save }) => {
      const queryKey = ['customer-favorites', user];
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<string[]>(queryKey);
      queryClient.setQueryData<string[]>(queryKey, current => {
        const currentIds = current ?? [];
        return save
          ? currentIds.includes(food) ? currentIds : [...currentIds, food]
          : currentIds.filter(id => id !== food);
      });
      setErrorMessage('');
      return { queryKey, previous };
    },
    onError: (_error, _variables, context) => {
      if (context?.previous) queryClient.setQueryData(context.queryKey, context.previous);
      setErrorMessage('Could not update your favourite. Check your connection and try again.');
    },
    onSettled: (_result, _error, variables) => {
      void queryClient.invalidateQueries({ queryKey: ['customer-favorites', variables.user] });
    },
  });

  const toggleFavorite = (foodItemId: string) => {
    if (!customerId || favoritesQuery.isLoading || favoritesQuery.isError || mutation.isPending) return;
    mutation.mutate({ user: customerId, food: foodItemId, save: !favoriteIds.includes(foodItemId) });
  };
  const value = useMemo<FavoriteContextValue>(() => ({
    favoriteIds,
    isCustomer,
    isAuthLoading: !authReady || Boolean(userId && roleQuery.isLoading),
    isFavoritesLoading: Boolean(customerId && favoritesQuery.isLoading),
    isFavoritesError: Boolean(customerId && favoritesQuery.isError),
    isSaving: mutation.isPending,
    errorMessage,
    retryFavorites: () => { void favoritesQuery.refetch(); },
    clearError: () => setErrorMessage(''),
    toggleFavorite,
  }), [authReady, customerId, errorMessage, favoriteIds, favoritesQuery.isError, favoritesQuery.isLoading, isCustomer, mutation.isPending, roleQuery.isLoading, userId]);

  return <CustomerFavoritesContext.Provider value={value}>
    {children}
    {isCustomer && favoritesQuery.isError && <div role="alert" className="fixed inset-x-4 bottom-20 z-[60] mx-auto flex max-w-md items-center justify-between gap-3 rounded-xl bg-red-50 p-3 text-sm text-red-700 shadow-lg md:bottom-6"><span>Could not load your favourites. Check your connection and retry.</span><button type="button" onClick={() => void favoritesQuery.refetch()} className="shrink-0 font-bold underline">Retry</button></div>}
    {errorMessage && <div role="alert" className="fixed inset-x-4 bottom-20 z-[60] mx-auto flex max-w-md items-center justify-between gap-3 rounded-xl bg-red-50 p-3 text-sm text-red-700 shadow-lg md:bottom-6"><span>{errorMessage}</span><button type="button" onClick={() => setErrorMessage('')} aria-label="Dismiss favourite message" className="font-bold">×</button></div>}
  </CustomerFavoritesContext.Provider>;
}

export function useCustomerFavorites() {
  const context = useContext(CustomerFavoritesContext);
  if (!context) throw new Error('useCustomerFavorites must be used inside CustomerFavoritesProvider.');
  return context;
}

export function CustomerFavoriteButton({ foodItemId, className, iconSize = 16, animateOnLike = false }: { foodItemId: string; className: string; iconSize?: number; animateOnLike?: boolean }) {
  const { favoriteIds, isCustomer, isAuthLoading, isFavoritesLoading, isFavoritesError, isSaving, toggleFavorite } = useCustomerFavorites();
  const navigate = useNavigate();
  const location = useLocation();
  const favorite = favoriteIds.includes(foodItemId);
  const busy = isAuthLoading || (isCustomer && (isFavoritesLoading || isFavoritesError)) || isSaving;

  return <button type="button" aria-label={favorite ? 'Remove from favorites' : 'Add to favorites'} aria-pressed={favorite} disabled={busy} onClick={() => {
    if (!isCustomer) {
      navigate('/login', { state: { from: `${location.pathname}${location.search}` } });
      return;
    }
    toggleFavorite(foodItemId);
  }} className={`${className} disabled:cursor-wait disabled:opacity-60`}>
    <Heart size={iconSize} className={favorite ? `${animateOnLike ? 'animate-heart-pop ' : ''}fill-brand-orange text-brand-orange` : animateOnLike ? 'transition-colors duration-200' : ''}/>
  </button>;
}
