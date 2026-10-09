import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { CartLine, FoodItem } from '../types';
type Store = { cart: CartLine[]; cartOwnerId: string | null; cartByOwner: Record<string, CartLine[]>; setCartOwner: (ownerId: string | null) => void; replaceCartForOwner: (ownerId: string, cart: CartLine[]) => void; add: (food: FoodItem, size?: 'Regular' | 'Large', extras?: string[], note?: string, offer?: { id: string; discountPercentage: number }) => void; increment: (key: string, delta: number) => void; remove: (key: string) => void; syncCartWithMenu: (foods: FoodItem[]) => void; clear: () => void };
const ownerKey = (ownerId: string | null) => ownerId ?? 'guest';
const saveCart = (state: Pick<Store, 'cartOwnerId' | 'cartByOwner'>, cart: CartLine[]) => ({ cart, cartByOwner: { ...state.cartByOwner, [ownerKey(state.cartOwnerId)]: cart } });

export const useStore = create<Store>()(persist((set) => ({ cart: [], cartOwnerId: null, cartByOwner: { guest: [] }, setCartOwner: ownerId => set(state => {
  const cartByOwner = { ...state.cartByOwner, [ownerKey(state.cartOwnerId)]: state.cart };
  const key = ownerKey(ownerId);
  return { cartOwnerId: ownerId, cart: cartByOwner[key] ?? [], cartByOwner: { ...cartByOwner, [key]: cartByOwner[key] ?? [] } };
}), replaceCartForOwner: (ownerId, cart) => set(state => {
  if (state.cartOwnerId !== ownerId) return state;
  return { ...saveCart(state, cart), cartOwnerId: ownerId };
}), add: (food, size = 'Regular', extras = [], note = '', offer) => { if (!food.available || !food.active) return; set(s => { const key = `${food.id}-${size}-${extras.slice().sort().join('-')}-${note.trim()}-${offer?.id ?? 'menu'}`; const found = s.cart.find(i => i.key === key); const cart = found ? s.cart.map(i => i.key === key ? { ...i, quantity: i.quantity + 1, food } : i) : [...s.cart, { key, food, size, extras, note: note.trim() || undefined, quantity: 1, offerId: offer?.id, offerDiscountPercent: offer?.discountPercentage }]; return saveCart(s, cart); }); }, increment: (key, delta) => set(s => saveCart(s, s.cart.map(i => i.key === key ? { ...i, quantity: i.quantity + delta } : i).filter(i => i.quantity > 0))), remove: key => set(s => saveCart(s, s.cart.filter(i => i.key !== key))), syncCartWithMenu: foods => set(state => {
  const currentFoods = new Map(foods.map(food => [food.id, food]));
  let changed = false;
  const cart = state.cart.map(line => {
    const current = currentFoods.get(line.food.id);
    const nextFood = current ?? { ...line.food, active: false, available: false };
    const same = line.food.name === nextFood.name && line.food.description === nextFood.description && line.food.category === nextFood.category && line.food.categoryId === nextFood.categoryId && line.food.foodType === nextFood.foodType && line.food.price === nextFood.price && line.food.regularPrice === nextFood.regularPrice && line.food.largePrice === nextFood.largePrice && line.food.displayOrder === nextFood.displayOrder && line.food.image === nextFood.image && line.food.available === nextFood.available && line.food.active === nextFood.active && line.food.veg === nextFood.veg && line.food.time === nextFood.time && line.food.badge === nextFood.badge && line.food.isTodaySpecial === nextFood.isTodaySpecial && line.food.specialPrice === nextFood.specialPrice && line.food.specialDiscountPercent === nextFood.specialDiscountPercent && line.food.specialStartsAt === nextFood.specialStartsAt && line.food.specialEndsAt === nextFood.specialEndsAt;
    if (same) return line;
    changed = true;
    return { ...line, food: nextFood };
  });
  return changed ? saveCart(state, cart) : state;
}), clear: () => set(s => saveCart(s, [])) }), {
  name: 'wolf-kaafe-store',
  version: 3,
  partialize: state => ({ cartByOwner: state.cartByOwner }) as Store,
  migrate: (persistedState, version) => {
    const stored = (persistedState && typeof persistedState === 'object' ? persistedState : {}) as Partial<Store> & { favorites?: string[] };
    delete stored.favorites;
    if (version < 2) {
      const previousCart = stored.cart ?? [];
      stored.cartByOwner = { guest: previousCart };
    }
    // The authenticated identity is restored from Supabase, never from this cache.
    stored.cartOwnerId = null;
    stored.cart = [];
    return stored as Store;
  },
}));
