import type { FoodItem } from '../types';
import type { CartLine } from '../types';

type SpecialPricing = Pick<FoodItem, 'isTodaySpecial' | 'specialPrice' | 'specialDiscountPercent' | 'specialStartsAt' | 'specialEndsAt'>;

export function isCurrentlyTodaySpecial(food: SpecialPricing, now: number | Date = Date.now()) {
  if (!food.isTodaySpecial) return false;
  const currentTime = now instanceof Date ? now.getTime() : now;
  const startsAt = food.specialStartsAt ? new Date(food.specialStartsAt).getTime() : null;
  const endsAt = food.specialEndsAt ? new Date(food.specialEndsAt).getTime() : null;
  return (startsAt === null || currentTime >= startsAt) && (endsAt === null || currentTime < endsAt);
}

export function getOriginalFoodBasePrice(food: Pick<FoodItem, 'price' | 'regularPrice' | 'largePrice'>, size: 'Regular' | 'Large') {
  if (size === 'Large' && food.largePrice != null) return food.largePrice;
  if (size === 'Regular' && food.regularPrice != null) return food.regularPrice;
  return food.price;
}

export function getFoodBasePrice(food: Pick<FoodItem, 'price' | 'regularPrice' | 'largePrice'> & Partial<SpecialPricing>, size: 'Regular' | 'Large', now: number | Date = Date.now()) {
  const originalPrice = getOriginalFoodBasePrice(food, size);
  if (!isCurrentlyTodaySpecial({
    isTodaySpecial: food.isTodaySpecial ?? false,
    specialPrice: food.specialPrice ?? null,
    specialDiscountPercent: food.specialDiscountPercent ?? 0,
    specialStartsAt: food.specialStartsAt ?? null,
    specialEndsAt: food.specialEndsAt ?? null,
  }, now)) return originalPrice;

  const regularPrice = getOriginalFoodBasePrice(food, 'Regular');
  if (food.specialPrice != null && regularPrice > 0) {
    return Math.round(originalPrice * food.specialPrice / regularPrice * 100) / 100;
  }
  if ((food.specialDiscountPercent ?? 0) > 0) {
    return Math.round(originalPrice * (1 - (food.specialDiscountPercent ?? 0) / 100) * 100) / 100;
  }
  return originalPrice;
}

export function getFoodDiscountPercent(food: Pick<FoodItem, 'price' | 'regularPrice' | 'largePrice'> & Partial<SpecialPricing>, size: 'Regular' | 'Large', now: number | Date = Date.now()) {
  const originalPrice = getOriginalFoodBasePrice(food, size);
  const currentPrice = getFoodBasePrice(food, size, now);
  return originalPrice > 0 && currentPrice < originalPrice
    ? Math.round((originalPrice - currentPrice) / originalPrice * 100)
    : 0;
}

export function getFoodUnitPrice(food: Pick<FoodItem, 'price' | 'regularPrice' | 'largePrice'> & Partial<SpecialPricing>, size: 'Regular' | 'Large', extrasCount = 0, now: number | Date = Date.now()) {
  return getFoodBasePrice(food, size, now) + extrasCount * 30;
}

export function getCartLineUnitPrice(line: Pick<CartLine, 'food' | 'size' | 'extras' | 'offerId' | 'offerDiscountPercent'>, now: number | Date = Date.now(), overridePercent?: number) {
  const percent = overridePercent ?? line.offerDiscountPercent ?? 0;
  if (line.offerId && percent > 0) {
    const menuPrice = getOriginalFoodBasePrice(line.food, line.size);
    return Math.round(menuPrice * (1 - percent / 100) * 100) / 100 + line.extras.length * 30;
  }
  return getFoodUnitPrice(line.food, line.size, line.extras.length, now);
}

export function hasFoodSizeVariants(food: Pick<FoodItem, 'regularPrice' | 'largePrice'>) {
  return food.regularPrice != null || food.largePrice != null;
}
