import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';

export function useCustomerOrdersRealtime(enabled: boolean) {
  const queryClient = useQueryClient();
  useEffect(() => {
    if (!enabled || !supabase) return;
    let active = true;
    let receivedAuthEvent = false;
    let channel: ReturnType<NonNullable<typeof supabase>['channel']> | null = null;

    const attach = (userId: string | null) => {
      if (!active) return;
      if (channel) void supabase?.removeChannel(channel);
      channel = null;
      if (!userId) return;
      channel = supabase?.channel(`customer-orders-${userId}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'orders', filter: `user_id=eq.${userId}` }, () => {
          void queryClient.invalidateQueries({ queryKey: ['my-orders', userId] });
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'reviews', filter: `user_id=eq.${userId}` }, () => {
          void queryClient.invalidateQueries({ queryKey: ['my-orders', userId] });
          void queryClient.invalidateQueries({ queryKey: ['menu'] });
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'food_review_rating_summaries' }, () => {
          void queryClient.invalidateQueries({ queryKey: ['menu'] });
        })
        .subscribe() ?? null;
    };

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      receivedAuthEvent = true;
      attach(session?.user.id ?? null);
    });
    void supabase.auth.getUser().then(({ data }) => {
      if (!receivedAuthEvent) attach(data.user?.id ?? null);
    });

    return () => {
      active = false;
      authListener.subscription.unsubscribe();
      if (channel) void supabase?.removeChannel(channel);
    };
  }, [enabled, queryClient]);
}
