import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { getCustomerProfile } from '../services/profileService';

export function useCustomerProfile() {
  const queryClient = useQueryClient();
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(!supabase);
  const [authError, setAuthError] = useState('');

  useEffect(() => {
    if (!supabase) return;
    let active = true;
    let receivedAuthEvent = false;

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!active) return;
      receivedAuthEvent = true;
      const nextUser = session?.user ?? null;
      setUser(nextUser);
      setAuthReady(true);
      setAuthError('');
      void queryClient.removeQueries({ queryKey: ['customer-profile'] });
    });

    void supabase.auth.getSession().then(({ data, error }) => {
      if (!active || receivedAuthEvent) return;
      setUser(data.session?.user ?? null);
      setAuthReady(true);
      setAuthError(error ? 'Could not restore your sign-in session. Please try again.' : '');
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [queryClient]);

  const profileQuery = useQuery({
    queryKey: ['customer-profile', user?.id],
    queryFn: () => getCustomerProfile(user!.id),
    enabled: authReady && Boolean(user),
    retry: 1,
  });

  return { user, authReady, authError, ...profileQuery };
}
