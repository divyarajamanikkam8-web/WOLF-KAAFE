export type Category = { id: string; name: string; image: string };
export type FoodType = 'VEG' | 'NON_VEG' | 'EGG';
export type FoodItem = { id: string; name: string; description: string; category: string; categoryId: string | null; foodType: FoodType | null; price: number; regularPrice: number | null; largePrice: number | null; displayOrder: number; rating: number; reviews: number; time: string; image: string; veg: boolean; available: boolean; active: boolean; isTodaySpecial: boolean; specialPrice: number | null; specialDiscountPercent: number; specialStartsAt: string | null; specialEndsAt: string | null; badge?: string };
export type CartLine = { key: string; food: FoodItem; quantity: number; size: 'Regular' | 'Large'; extras: string[]; note?: string; offerId?: string; offerDiscountPercent?: number };
export type OrderStatus = 'Pending' | 'Accepted' | 'Preparing' | 'Ready' | 'Out for Delivery' | 'Delivered' | 'Cancelled';
