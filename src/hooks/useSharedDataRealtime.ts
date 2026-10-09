import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useStore } from '../store/useStore';
import { getCustomerCart, saveCustomerCart } from '../services/customerCartService';

export function useSharedDataRealtime() {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!supabase) return;
    const invalidateSharedData = () => {
      void queryClient.invalidateQueries({ queryKey: ['menu'] });
      void queryClient.invalidateQueries({ queryKey: ['categories'] });
      void queryClient.invalidateQueries({ queryKey: ['admin-menu'] });
      void queryClient.invalidateQueries({ queryKey: ['admin-categories'] });
      void queryClient.invalidateQueries({ queryKey: ['home-special-offer'] });
      void queryClient.invalidateQueries({ queryKey: ['home-offer-foods'] });
      void queryClient.invalidateQueries({ queryKey: ['admin-home-offers'] });
      void queryClient.invalidateQueries({ queryKey: ['cart-offer-discounts'] });
      void queryClient.invalidateQueries({ queryKey: ['food-ratings'] });
      void queryClient.invalidateQueries({ queryKey: ['food-reviews'] });
      void queryClient.invalidateQueries({ queryKey: ['offers'] });
      void queryClient.invalidateQueries({ queryKey: ['restaurant-settings'] });
      void queryClient.invalidateQueries({ queryKey: ['admin-restaurant-settings'] });
      void queryClient.invalidateQueries({ queryKey: ['admin-dashboard'] });
    };

    const channel = supabase.channel('global-shared-data-sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'food_items' }, () => {
        void queryClient.invalidateQueries({ queryKey: ['menu'] });
        void queryClient.invalidateQueries({ queryKey: ['admin-menu'] });
        void queryClient.invalidateQueries({ queryKey: ['home-offer-foods'] });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'categories' }, () => {
        void queryClient.invalidateQueries({ queryKey: ['menu'] });
        void queryClient.invalidateQueries({ queryKey: ['categories'] });
        void queryClient.invalidateQueries({ queryKey: ['admin-categories'] });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'home_special_offers' }, () => {
        void queryClient.invalidateQueries({ queryKey: ['home-special-offer'] });
        void queryClient.invalidateQueries({ queryKey: ['admin-home-offers'] });
        void queryClient.invalidateQueries({ queryKey: ['cart-offer-discounts'] });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'home_special_offer_food_items' }, () => {
        void queryClient.invalidateQueries({ queryKey: ['home-special-offer'] });
        void queryClient.invalidateQueries({ queryKey: ['home-offer-foods'] });
        void queryClient.invalidateQueries({ queryKey: ['admin-home-offers'] });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'food_review_rating_summaries' }, () => {
        void queryClient.invalidateQueries({ queryKey: ['menu'] });
        void queryClient.invalidateQueries({ queryKey: ['food-ratings'] });
        void queryClient.invalidateQueries({ queryKey: ['food-reviews'] });
        void queryClient.invalidateQueries({ queryKey: ['home-offer-foods'] });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'offers' }, () => {
        void queryClient.invalidateQueries({ queryKey: ['offers'] });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'restaurant_settings' }, () => {
        void queryClient.invalidateQueries({ queryKey: ['restaurant-settings'] });
        void queryClient.invalidateQueries({ queryKey: ['admin-restaurant-settings'] });
        void queryClient.invalidateQueries({ queryKey: ['admin-dashboard'] });
      })
      .subscribe(status => {
        if (status === 'SUBSCRIBED') invalidateSharedData();
      });

    return () => { void supabase?.removeChannel(channel); };
  }, [queryClient]);
}

export function useCartOwnerSync() {
  const queryClient = useQueryClient();
  useEffect(() => {
    if (!supabase) return;
    let active = true;
    let receivedAuthEvent = false;
    let ownerId: string | null = useStore.getState().cartOwnerId;
    let loadedOwnerId: string | null | undefined;
    let generation = 0;
    let mutedStoreEvent = false;
    let saveTimer: number | undefined;
    let saveQueue = Promise.resolve();
    let channel: ReturnType<NonNullable<typeof supabase>['channel']> | null = null;

    const readRemoteCart = async (forUserId: string, requestGeneration: number) => {
      try {
        const cart = await getCustomerCart(forUserId);
        if (!active || requestGeneration !== generation || ownerId !== forUserId) return;
        if (saveTimer !== undefined && loadedOwnerId === forUserId) return;
        mutedStoreEvent = true;
        useStore.getState().replaceCartForOwner(forUserId, cart);
        mutedStoreEvent = false;
        loadedOwnerId = forUserId;
      } catch {
        // Keep this account's local cache visible and retry at the next auth change.
      }
    };

    const activateOwner = (nextOwnerId: string | null) => {
      if (ownerId !== nextOwnerId || (generation === 0 && loadedOwnerId === undefined)) {
        generation += 1;
        ownerId = nextOwnerId;
        loadedOwnerId = undefined;
        if (saveTimer !== undefined) window.clearTimeout(saveTimer);
        if (channel) void supabase?.removeChannel(channel);
        channel = null;
        void queryClient.cancelQueries({ queryKey: ['my-orders'] });
        queryClient.removeQueries({ queryKey: ['my-orders'] });
        queryClient.removeQueries({ queryKey: ['customer-profile'] });
        queryClient.removeQueries({ queryKey: ['customer-default-address'] });
        queryClient.removeQueries({ queryKey: ['customer-favorites'] });
        queryClient.removeQueries({ queryKey: ['customer-favorite-role'] });
        useStore.getState().setCartOwner(nextOwnerId);
      }
      if (!nextOwnerId) {
        loadedOwnerId = null;
        return;
      }
      const requestGeneration = generation;
      window.setTimeout(() => {
        if (!active || requestGeneration !== generation || ownerId !== nextOwnerId) return;
        channel = supabase?.channel(`customer-cart-${nextOwnerId}`)
          .on('postgres_changes', { event: '*', schema: 'public', table: 'cart_items', filter: `user_id=eq.${nextOwnerId}` }, () => {
            // Realtime is scoped to this auth.uid; the RLS policy enforces the same boundary.
            void readRemoteCart(nextOwnerId, requestGeneration);
          }).subscribe() ?? null;
        void readRemoteCart(nextOwnerId, requestGeneration);
      }, 0);
    };

    const unsubscribeStore = useStore.subscribe((state, previous) => {
      if (mutedStoreEvent || !ownerId || loadedOwnerId !== ownerId || state.cartOwnerId !== ownerId || state.cart === previous.cart) return;
      if (saveTimer !== undefined) window.clearTimeout(saveTimer);
      saveTimer = window.setTimeout(() => {
        saveTimer = undefined;
        const current = useStore.getState();
        const targetOwner = ownerId;
        if (!targetOwner || current.cartOwnerId !== targetOwner || current.cartOwnerId !== loadedOwnerId) return;
        const snapshot = current.cart;
        saveQueue = saveQueue.then(() => saveCustomerCart(targetOwner, snapshot)).catch(() => undefined);
      }, 250);
    });

    const setOwner = (nextOwnerId: string | null) => {
      activateOwner(nextOwnerId);
    };
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      receivedAuthEvent = true;
      setOwner(session?.user.id ?? null);
    });
    void supabase.auth.getSession().then(({ data }) => {
      if (active && !receivedAuthEvent) setOwner(data.session?.user.id ?? null);
    }).catch(() => {
      if (active && !receivedAuthEvent) setOwner(null);
    });
    return () => {
      active = false;
      subscription.unsubscribe();
      unsubscribeStore();
      if (saveTimer !== undefined) window.clearTimeout(saveTimer);
      if (channel) void supabase?.removeChannel(channel);
    };
  }, [queryClient]);
}
