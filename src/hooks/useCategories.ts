import { useQuery } from '@tanstack/react-query';
import { getCategories } from '../services/menuService';

export function useCategories() {
  return useQuery({ queryKey: ['categories'], queryFn: getCategories, staleTime: 0, refetchOnMount: 'always', refetchOnWindowFocus: true, refetchOnReconnect: true });
}
