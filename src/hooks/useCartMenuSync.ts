import { useEffect, useState } from 'react';
import { useMenu } from './useMenu';
import { useStore } from '../store/useStore';
import { getFoodBasePrice } from '../utils/foodPricing';

export function useCartMenuSync() {
  const menu = useMenu();
  const cart = useStore(state => state.cart);
  const syncCartWithMenu = useStore(state => state.syncCartWithMenu);
  const [notice, setNotice] = useState('');

  useEffect(() => {
    if (menu.data === undefined) return;
    const currentFoods = new Map(menu.data.map(food => [food.id, food]));
    const priceChanges = cart.flatMap(line => {
      const current = currentFoods.get(line.food.id);
      return current && getFoodBasePrice(current, line.size) !== getFoodBasePrice(line.food, line.size) ? [`${line.food.name}: ₹${getFoodBasePrice(line.food, line.size)} → ₹${getFoodBasePrice(current, line.size)}`] : [];
    });
    const unavailable = cart.some(line => {
      const current = currentFoods.get(line.food.id);
      return !current || !current.active || !current.available;
    });
    const messages = [priceChanges.length ? `Prices updated: ${priceChanges.join(', ')}. Review your cart total.` : '', unavailable ? 'Some items are no longer available. Remove them before checkout.' : ''].filter(Boolean);
    if (messages.length) setNotice(messages.join(' '));
    syncCartWithMenu(menu.data);
  }, [menu.data, cart, syncCartWithMenu]);

  return { foods: menu.data, isMenuLoading: menu.isLoading, isMenuError: menu.isError, refetchMenu: menu.refetch, cartNotice: notice };
}
