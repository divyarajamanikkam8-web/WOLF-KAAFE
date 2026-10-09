import type { SyntheticEvent } from 'react';

const fallbackFoodImage = 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&fit=crop&w=900&q=80';

export function foodImageUrl(image: string) {
  if (!image.trim()) return '';
  if (image.startsWith('/')) return image;
  return image.startsWith('http')
    ? image
    : `https://images.unsplash.com/${image}?auto=format&fit=crop&w=900&q=85`;
}

export function handleFoodImageError(event: SyntheticEvent<HTMLImageElement>) {
  const image = event.currentTarget;
  if (image.dataset.fallback) {
    image.style.visibility = 'hidden';
    return;
  }
  image.dataset.fallback = 'true';
  image.src = fallbackFoodImage;
}

export function handleFoodItemImageError(event: SyntheticEvent<HTMLImageElement>) {
  event.currentTarget.style.visibility = 'hidden';
}
