import { useQuery } from '@tanstack/react-query';
import { getCustomerRestaurantSettings } from '../services/restaurantSettingsService';

export function useRestaurantSettings() {
  return useQuery({
    queryKey: ['restaurant-settings'],
    queryFn: getCustomerRestaurantSettings,
    staleTime: 0,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
  });
}
