import { supabase } from '../lib/supabase';

export type AdminFoodReviewSummary = {
  food_item_id: string;
  name: string;
  image_url: string | null;
  is_active: boolean;
  average_rating: number;
  review_count: number;
  five_star_count: number;
  four_star_count: number;
  three_star_count: number;
  two_star_count: number;
  one_star_count: number;
};

export type AdminFoodReview = {
  id: string;
  customer_name: string;
  order_id: string;
  food_rating: number;
  comment: string;
  created_at: string;
};

export type PublicFoodReview = {
  id: string;
  food_item_id: string;
  food_rating: number;
  comment: string;
  created_at: string;
  is_verified_purchase: boolean;
  helpful_count: number;
  viewer_marked_helpful: boolean;
};

export type FoodReviewDistribution = {
  average_rating: number;
  review_count: number;
  five_star_count: number;
  four_star_count: number;
  three_star_count: number;
  two_star_count: number;
  one_star_count: number;
};

export type PublicFoodReviewsResponse = {
  distribution: FoodReviewDistribution;
  reviews: PublicFoodReview[];
};

function requireSupabase() {
  if (!supabase) throw new Error('Supabase is not configured.');
  return supabase;
}

export async function submitOrderFoodReviews(orderId: string, reviews: { food_item_id: string; rating: number; review_text: string }[]) {
  const client = requireSupabase();
  const { data: authData, error: authError } = await client.auth.getUser();
  if (authError) throw authError;
  if (!authData.user) throw new Error('Sign in to submit your food review.');
  const { data, error } = await client.rpc('submit_order_food_reviews', {
    p_order_id: orderId,
    p_reviews: reviews,
  });
  if (error) throw error;
  return Number(data ?? 0);
}

export async function getAdminFoodReviewSummaries(): Promise<AdminFoodReviewSummary[]> {
  const client = requireSupabase();
  const [{ data: summaryRows, error: summaryError }, { data: foods, error: foodError }] = await Promise.all([
    client.rpc('get_admin_food_review_summaries'),
    client.from('food_items').select('id,name,image_url,is_active').order('name'),
  ]);
  if (summaryError) throw summaryError;
  if (foodError) throw foodError;
  const summaries = new Map<string, Record<string, unknown>>();
  for (const row of summaryRows ?? []) summaries.set(String(row.food_item_id), row as Record<string, unknown>);
  return (foods ?? []).map(food => {
    const row = summaries.get(food.id) ?? {};
    return {
      food_item_id: food.id,
      name: food.name,
      image_url: food.image_url,
      is_active: food.is_active,
      average_rating: Number(row.average_rating ?? 0),
      review_count: Number(row.review_count ?? 0),
      five_star_count: Number(row.five_star_count ?? 0),
      four_star_count: Number(row.four_star_count ?? 0),
      three_star_count: Number(row.three_star_count ?? 0),
      two_star_count: Number(row.two_star_count ?? 0),
      one_star_count: Number(row.one_star_count ?? 0),
    };
  });
}

export async function getAdminFoodReviews(foodId: string): Promise<AdminFoodReview[]> {
  const client = requireSupabase();
  const { data: rows, error } = await client.rpc('get_admin_food_reviews', { p_food_id: foodId });
  if (error) throw error;
  return (rows ?? []) as AdminFoodReview[];
}

export async function deleteAdminFoodReview(reviewId: string) {
  const client = requireSupabase();
  const { data, error } = await client.rpc('delete_admin_food_review', { p_review_id: reviewId });
  if (error) throw error;
  return Boolean(data);
}

export async function getPublicFoodReviews(foodId: string): Promise<PublicFoodReviewsResponse> {
  const client = requireSupabase();
  const [{ data: stats, error: statsError }, { data: reviews, error: reviewsError }] = await Promise.all([
    client.from('food_review_rating_summaries')
      .select('rating_total,review_count,five_star_count,four_star_count,three_star_count,two_star_count,one_star_count')
      .eq('food_item_id', foodId)
      .maybeSingle(),
    client.rpc('get_public_food_reviews', { p_food_id: foodId }),
  ]);
  if (statsError) throw statsError;
  let publicReviews: PublicFoodReview[];
  if (reviewsError && (reviewsError.code === 'PGRST202' || reviewsError.code === '42883')) {
    // Keep reviews readable during staged deployments where the public RPC migration
    // has not reached this Supabase project yet. These columns are publicly granted.
    const { data: rows, error } = await client.from('reviews')
      .select('food_item_id,food_rating,comment,created_at')
      .eq('food_item_id', foodId)
      .order('created_at', { ascending: false })
      .limit(50);
    if (error) throw error;
    publicReviews = (rows ?? []).map(row => ({
      id: '',
      food_item_id: String(row.food_item_id),
      food_rating: Number(row.food_rating),
      comment: String(row.comment ?? ''),
      created_at: String(row.created_at),
      is_verified_purchase: false,
      helpful_count: 0,
      viewer_marked_helpful: false,
    }));
  } else {
    if (reviewsError) throw reviewsError;
    publicReviews = (reviews ?? []) as PublicFoodReview[];
  }
  const total = Number(stats?.review_count ?? 0);
  return {
    distribution: {
      average_rating: total ? Math.round(Number(stats?.rating_total ?? 0) / total * 10) / 10 : 0,
      review_count: total,
      five_star_count: Number(stats?.five_star_count ?? 0),
      four_star_count: Number(stats?.four_star_count ?? 0),
      three_star_count: Number(stats?.three_star_count ?? 0),
      two_star_count: Number(stats?.two_star_count ?? 0),
      one_star_count: Number(stats?.one_star_count ?? 0),
    },
    reviews: publicReviews,
  };
}

export async function toggleFoodReviewHelpful(reviewId: string) {
  const client = requireSupabase();
  const { data, error } = await client.rpc('toggle_food_review_helpful', { p_review_id: reviewId });
  if (error) throw error;
  return Boolean(data);
}
