import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';

type AdminRealtimeHandlers = {
  onConnectionChange?: (status: 'connecting' | 'connected' | 'disconnected') => void;
  onNewOrder?: () => void;
  notifyNewOrders?: boolean;
};

export function useAdminRealtime(handlers: AdminRealtimeHandlers = {}) {
  const queryClient = useQueryClient();
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  useEffect(() => {
    const client = supabase;
    if (!client) {
      handlersRef.current.onConnectionChange?.('disconnected');
      return;
    }
    handlersRef.current.onConnectionChange?.('connecting');
    const channel = client.channel('admin-live-order-data')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, payload => {
        void queryClient.invalidateQueries({ queryKey: ['admin-orders'] });
        void queryClient.invalidateQueries({ queryKey: ['admin-order-counts'] });
        void queryClient.invalidateQueries({ queryKey: ['admin-order-pending-count'] });
        void queryClient.invalidateQueries({ queryKey: ['admin-dashboard'] });
        void queryClient.invalidateQueries({ queryKey: ['admin-analytics'] });
        void queryClient.invalidateQueries({ queryKey: ['admin-customers'] });
        if (payload.eventType === 'INSERT' && handlersRef.current.notifyNewOrders) handlersRef.current.onNewOrder?.();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, () => {
        void queryClient.invalidateQueries({ queryKey: ['admin-customers'] });
        void queryClient.invalidateQueries({ queryKey: ['admin-dashboard'] });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'reviews' }, () => {
        void queryClient.invalidateQueries({ queryKey: ['admin-reviews'] });
        void queryClient.invalidateQueries({ queryKey: ['menu'] });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'food_review_rating_summaries' }, () => {
        void queryClient.invalidateQueries({ queryKey: ['admin-reviews'] });
        void queryClient.invalidateQueries({ queryKey: ['menu'] });
      })
      .subscribe(status => handlersRef.current.onConnectionChange?.(status === 'SUBSCRIBED' ? 'connected' : 'disconnected'));
    return () => {
      handlersRef.current.onConnectionChange?.('disconnected');
      void client.removeChannel(channel);
    };
  }, [queryClient]);
}
