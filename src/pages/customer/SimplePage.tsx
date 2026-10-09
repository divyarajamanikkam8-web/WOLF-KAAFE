import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { ArrowRight, CheckCircle2, ClipboardList, Heart, MapPin, UserRound, Bell, Star, CircleHelp } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import { FoodCard } from '../../components/FoodCard';
import { useCustomerFavorites } from '../../components/CustomerFavorites';
import { useMenu } from '../../hooks/useMenu';
import { useCustomerOrdersRealtime } from '../../hooks/useCustomerOrdersRealtime';
import { useCustomerProfile } from '../../hooks/useCustomerProfile';
import { getMyOrders, type CustomerOrder } from '../../services/orderService';
import { CustomerProfilePage } from './CustomerProfilePage';
import { SavedAddressPage } from './SavedAddressPage';

const titles: Record<string, string> = { orders: 'Your orders', favorites: 'Your favourites', addresses: 'Saved addresses', notifications: 'Notifications', reviews: 'Your reviews', profile: 'Your profile', help: 'Help & support', login: 'Welcome back', register: 'Create your account', 'forgot-password': 'Reset password', otp: 'Verify your number', onboarding: 'Welcome to The Wolf Kaafe', 'order-success': 'Order placed successfully' };
const statusText: Record<string, string> = { pending: 'Pending', accepted: 'Accepted', preparing: 'Preparing', ready: 'Ready', out_for_delivery: 'Out for delivery', delivered: 'Delivered', cancelled: 'Cancelled' };

export function SimplePage({ page }: { page: string }) {
  if (page === 'favorites') return <FavoritesPage />;
  if (page === 'profile') return <CustomerProfilePage />;
  if (page === 'addresses') return <SavedAddressPage />;
  if (page === 'order-success') return <OrderSuccessPage />;
  if (page === 'orders' || page === 'orders/:id' || page === 'track/:id') return <CustomerOrdersPage />;
  const Icon = page === 'addresses' ? MapPin : page === 'notifications' ? Bell : page === 'reviews' ? Star : page === 'profile' ? UserRound : CircleHelp;
  return <div className="mx-auto max-w-2xl"><h1 className="mb-5 text-3xl font-black">{titles[page] ?? 'The Wolf Kaafe'}</h1><Empty icon={<Icon />} title={titles[page] ?? 'Coming soon'} body="This section is ready to connect to your account." /></div>;
}

function OrderSuccessPage() {
  const { user, authReady } = useCustomerProfile();
  const order = (() => {
    if (!authReady || !user) return null;
    try { return JSON.parse(sessionStorage.getItem(`wolf-last-order-${user.id}`) ?? 'null') as { id?: string; total?: number; address?: string } | null; }
    catch { return null; }
  })();
  if (!authReady) return <p role="status" className="rounded-2xl bg-white p-5">Checking your account…</p>;
  if (!user) return <SignInPrompt from="/order-success" />;
  return <div className="mx-auto max-w-xl rounded-3xl bg-white p-7 text-center shadow-sm sm:p-10"><CheckCircle2 size={58} className="mx-auto text-green-600" /><h1 className="mt-4 text-2xl font-black">Order placed successfully</h1><p className="mt-2 text-sm text-stone-500">The kitchen is getting started. We will keep you updated.</p><div className="my-6 rounded-2xl bg-brand-pale p-4 text-left text-sm"><div className="flex justify-between"><b>Order ID</b><span>{order?.id ?? 'Available in your orders'}</span></div><div className="mt-2 flex justify-between"><b>Payment</b><span>Cash on Delivery</span></div>{order && <div className="mt-2 flex justify-between"><b>Total</b><span>₹{order.total ?? 0}</span></div>}{order?.address && <p className="mt-3 text-xs text-stone-500">Delivering to {order.address}</p>}</div><div className="grid grid-cols-2 gap-3"><Link to={order?.id ? `/track/${order.id}` : '/orders'} className="rounded-xl bg-brand-orange p-3 text-sm font-bold text-white">Track order</Link><Link to="/menu" className="rounded-xl border p-3 text-sm font-bold">Continue shopping</Link></div></div>;
}

function CustomerOrdersPage() {
  const { id } = useParams();
  const { user, authReady } = useCustomerProfile();
  const signedIn = Boolean(user);
  const orders = useQuery({ queryKey: ['my-orders', user?.id], queryFn: () => getMyOrders(user!.id), enabled: authReady && signedIn, staleTime: 0, refetchOnMount: 'always', refetchOnWindowFocus: true });
  useCustomerOrdersRealtime(authReady && signedIn);
  if (!authReady) return <p role="status" className="rounded-2xl bg-white p-5">Checking your account…</p>;
  if (!user) return <SignInPrompt from={id ? `/orders/${id}` : '/orders'} />;
  if (orders.isLoading) return <p role="status" className="rounded-2xl bg-white p-5">Loading your orders…</p>;
  if (orders.isError) return <div role="alert" className="rounded-2xl bg-red-50 p-5 text-sm text-red-700">Could not load your orders. <button onClick={() => void orders.refetch()} className="font-bold underline">Retry</button></div>;
  const order = orders.data?.find(item => item.id === id);
  if (id) return <div><h1 className="mb-5 text-3xl font-black">Order details</h1>{!order ? <Empty icon={<ClipboardList />} title="Order not found" body="This order may have been removed." /> : <div className="space-y-4"><article className="rounded-2xl bg-white p-5 shadow-sm"><div className="flex flex-wrap justify-between gap-2"><b>Order {order.id.slice(0, 8).toUpperCase()}</b><span className="rounded-full bg-brand-pale px-3 py-1 text-xs font-bold text-brand-burnt">{statusText[order.status] ?? order.status}</span></div><p className="mt-2 text-xs text-stone-500">{format(new Date(order.created_at), 'dd MMM yyyy, h:mm a')}</p><div className="mt-4 space-y-2 border-t pt-4">{order.order_items?.map((item, index) => <div key={`${item.name_snapshot}-${index}`} className="flex justify-between gap-3 text-sm"><span>{item.quantity} × {item.name_snapshot}{item.offer_id && Number(item.discount_percentage) > 0 && <small className="block text-green-700">Original ₹{Number(item.original_unit_price).toFixed(2)} · {Number(item.discount_percentage)}% OFF · Offer price ₹{Number(item.unit_price).toFixed(2)}</small>}</span><b>₹{(Number(item.unit_price) * item.quantity).toFixed(2)}</b></div>)}</div><div className="mt-4 flex justify-between border-t pt-4 text-sm"><span>Cash on Delivery · {order.payment_status}</span><b>₹{Number(order.total).toFixed(2)}</b></div></article><OrderReviewPrompt order={order} /></div>}</div>;
  return <div><h1 className="mb-5 text-3xl font-black">Your orders</h1>{orders.data?.length ? <div className="space-y-3">{orders.data.map(row => <article key={row.id} className="rounded-2xl bg-white p-5 shadow-sm"><Link to={`/orders/${row.id}`} className="block"><div className="flex flex-wrap items-start justify-between gap-2"><div><b>Order {row.id.slice(0, 8).toUpperCase()}</b><p className="mt-1 text-xs text-stone-500">{format(new Date(row.created_at), 'dd MMM yyyy, h:mm a')}</p></div><span className="rounded-full bg-brand-pale px-3 py-1 text-xs font-bold text-brand-burnt">{statusText[row.status] ?? row.status}</span></div><p className="mt-3 text-sm text-stone-600">{row.order_items?.map(item => `${item.quantity} × ${item.name_snapshot}`).join(', ')}</p><div className="mt-3 flex justify-between border-t pt-3 text-sm"><span>Cash on Delivery</span><b>₹{Number(row.total).toFixed(2)}</b></div></Link><OrderReviewPrompt order={row} /></article>)}</div> : <Empty icon={<ClipboardList />} title="No orders yet" body="Your next favourite meal is just around the corner." action="Explore menu" />}</div>;
}

function SignInPrompt({ from }: { from: string }) { return <section className="mx-auto max-w-xl rounded-3xl bg-white p-8 text-center shadow-sm"><h1 className="text-xl font-black">Sign in to see your account data</h1><p className="mt-2 text-sm text-stone-500">Orders and saved information are private to your customer account.</p><Link to="/login" state={{ from }} className="mt-5 inline-flex min-h-11 items-center rounded-xl bg-brand-orange px-5 text-sm font-bold text-white">Sign in</Link></section>; }

function OrderReviewPrompt({ order }: { order: CustomerOrder }) {
  if (order.status !== 'delivered') return null;
  const foodIds = [...new Set(order.order_items.map(item => item.food_item_id).filter((foodId): foodId is string => Boolean(foodId)))];
  if (!foodIds.length) return null;
  const reviewed = new Set(order.reviews.map(review => review.food_item_id).filter((foodId): foodId is string => Boolean(foodId)));
  const complete = foodIds.every(foodId => reviewed.has(foodId));
  return complete ? <div className="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-xl bg-green-50 p-3 text-sm font-semibold text-green-800"><span>Thank you for rating your order ❤️</span><Link to={`/reviews/${order.id}`} className="font-bold underline">Edit reviews</Link></div> : <div className="mt-4 rounded-xl bg-brand-pale p-4"><p className="font-extrabold">Your order has been delivered!</p><p className="mt-1 text-sm text-stone-600">How was your food? Rate your items and help us serve you better.</p><Link to={`/reviews/${order.id}`} className="mt-3 inline-flex min-h-10 items-center gap-2 rounded-xl bg-brand-orange px-4 text-sm font-bold text-white">{reviewed.size ? 'Continue your review' : 'Rate Your Food'}<ArrowRight size={15} /></Link></div>;
}

function FavoritesPage() {
  const { favoriteIds, isCustomer, isAuthLoading, isFavoritesLoading, isFavoritesError, retryFavorites } = useCustomerFavorites();
  const { data: menu = [], isLoading, isError, refetch } = useMenu();
  const savedFoods = menu.filter(food => favoriteIds.includes(food.id));
  return <><h1 className="mb-5 text-3xl font-black">Your favourites</h1>{isAuthLoading ? <p role="status" className="rounded-2xl bg-white p-5 text-sm text-stone-500">Checking your account…</p> : !isCustomer ? <SignInPrompt from="/favorites" /> : isFavoritesLoading ? <p role="status" className="rounded-2xl bg-white p-5 text-sm text-stone-500">Loading your favourites…</p> : isFavoritesError ? <div role="alert" className="rounded-2xl bg-red-50 p-5 text-sm text-red-700">Could not load your saved foods. <button type="button" onClick={retryFavorites} className="font-bold underline">Retry</button></div> : isLoading ? <p className="rounded-2xl bg-white p-5 text-sm text-stone-500">Loading your menu…</p> : isError ? <div role="alert" className="rounded-2xl bg-red-50 p-5 text-sm text-red-700">Could not load your saved foods. <button onClick={() => void refetch()} className="font-bold underline">Retry</button></div> : savedFoods.length ? <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">{savedFoods.map(food => <FoodCard food={food} key={food.id} />)}</div> : <Empty icon={<Heart />} title="No favourites yet" body="Tap the heart on a dish to save it for later." />}</>;
}

function Empty({ icon, title, body, action }: { icon: React.ReactNode; title: string; body: string; action?: string }) { return <div className="rounded-3xl border border-dashed border-stone-300 bg-white py-14 text-center"><span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-pale text-brand-orange">{icon}</span><h2 className="mt-4 font-bold">{title}</h2><p className="mt-1 text-sm text-stone-500">{body}</p>{action && <Link to="/menu" className="mt-4 inline-block rounded-xl bg-brand-orange px-5 py-3 text-sm font-bold text-white">{action}</Link>}</div>; }
