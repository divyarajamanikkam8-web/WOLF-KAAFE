import type { ImgHTMLAttributes } from 'react';
import { useRestaurantSettings } from '../hooks/useRestaurantSettings';

type RestaurantLogoProps = Omit<ImgHTMLAttributes<HTMLImageElement>, 'src' | 'alt'> & {
  alt?: string;
};

/** Shared restaurant mark so admin and customer surfaces use the saved logo. */
export function RestaurantLogo({ alt, ...imageProps }: RestaurantLogoProps) {
  const settingsQuery = useRestaurantSettings();
  const settings = settingsQuery.data;

  return <img
    {...imageProps}
    src={settings?.logo_url || '/images/wolf-kaafe-logo.png'}
    alt={alt || settings?.restaurant_name || 'The Wolf Kaafe'}
  />;
}
