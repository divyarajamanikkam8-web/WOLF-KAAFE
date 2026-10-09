import { useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, Bell, CircleHelp, ClipboardList, Heart, LoaderCircle, LogOut, Mail, MapPin, Pencil, Phone, Save, Star, UserRound, X } from 'lucide-react';
import { useCustomerProfile } from '../../hooks/useCustomerProfile';
import { signOut } from '../../services/authService';
import { updateCustomerProfile, type CustomerProfileUpdate } from '../../services/profileService';
import { supabase } from '../../lib/supabase';

const schema = z.object({
  full_name: z.string().trim().min(2, 'Enter your name.'),
  phone: z.string().trim().regex(/^\d{10}$/, 'Enter a valid 10 digit phone number.'),
});
type FormValues = z.infer<typeof schema>;

const profileLinks = [
  ['My Orders', '/orders', ClipboardList],
  ['Favorites', '/favorites', Heart],
  ['Addresses', '/addresses', MapPin],
  ['Notifications', '/notifications', Bell],
  ['Reviews', '/reviews', Star],
  ['Help & Support', '/help', CircleHelp],
] as const;

export function CustomerProfilePage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user, authReady, authError, data: profile, isLoading, isError, error, refetch } = useCustomerProfile();
  const [editing, setEditing] = useState(false);
  const [profileOwnerId, setProfileOwnerId] = useState<string | null>(null);
  const [logoutError, setLogoutError] = useState('');
  const [loggingOut, setLoggingOut] = useState(false);
  const { register, handleSubmit, reset, formState: { errors } } = useForm<FormValues>({ resolver: zodResolver(schema) });

  useEffect(() => {
    setProfileOwnerId(user?.id ?? null);
    setEditing(false);
    reset({ full_name: '', phone: '' });
  }, [user?.id, reset]);

  useEffect(() => {
    if (profile) reset({ full_name: profile.full_name, phone: profile.phone ?? '' });
  }, [profile, reset]);

  const updateMutation = useMutation({
    mutationFn: (changes: CustomerProfileUpdate) => updateCustomerProfile(user!.id, changes),
    onSuccess: updated => {
      queryClient.setQueryData(['customer-profile', user?.id], updated);
      setEditing(false);
    },
  });

  const save = handleSubmit(values => updateMutation.mutate(values));

  const logout = async () => {
    if (!supabase || loggingOut) return;
    setLoggingOut(true);
    setLogoutError('');
    try {
      const result = await signOut();
      if (!result) throw new Error('Authentication is not configured.');
      if (result.error) throw result.error;
      if (user) sessionStorage.removeItem(`wolf-last-order-${user.id}`);
      queryClient.removeQueries({ queryKey: ['customer-profile'] });
      queryClient.removeQueries({ queryKey: ['my-orders'] });
      navigate('/login', { replace: true });
    } catch {
      setLogoutError('Could not log out. Please try again.');
      setLoggingOut(false);
    }
  };

  const title = <h1 className="mb-5 text-3xl font-black">Your profile</h1>;
  if (!supabase) return <div className="mx-auto max-w-2xl">{title}<ProfileMessage message="Profile access is unavailable because Supabase is not configured."/></div>;
  if (!authReady) return <div className="mx-auto max-w-2xl">{title}<ProfileMessage message="Loading your profile…" loading/></div>;
  if (authError) return <div className="mx-auto max-w-2xl">{title}<ProfileMessage message={authError} action="Try again" onAction={() => window.location.reload()}/></div>;
  if (!user) return <div className="mx-auto max-w-2xl">{title}<ProfileMessage message="Sign in to view your profile." action="Login" onAction={() => navigate('/login', { state: { from: '/profile' } })}/></div>;
  if (profileOwnerId !== user.id) return <div className="mx-auto max-w-2xl">{title}<ProfileMessage message="Loading your profile…" loading/></div>;
  if (isLoading) return <div className="mx-auto max-w-2xl">{title}<ProfileMessage message="Loading your profile…" loading/></div>;
  if (isError || !profile) return <div className="mx-auto max-w-2xl">{title}<ProfileMessage message={getProfileErrorMessage(error)} action="Retry" onAction={() => void refetch()}/></div>;

  return <div className="mx-auto max-w-2xl">
    {title}
    <section className="mb-5 rounded-2xl border border-stone-100 bg-white p-5 shadow-sm sm:p-6">
      <div className="flex items-start gap-4">
        <span className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-full bg-brand-pale text-brand-burnt">
          <UserRound size={30}/>
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="break-words text-xl font-extrabold">{profile.full_name || 'Customer'}</h2>
          <div className="mt-2 flex items-center gap-2 break-all text-sm text-stone-500"><Mail size={15} className="shrink-0 text-brand-orange"/>{profile.email || 'No email available'}</div>
          <div className="mt-1 flex items-center gap-2 text-sm text-stone-500"><Phone size={15} className="shrink-0 text-brand-orange"/>{profile.phone || 'Phone number not added'}</div>
        </div>
        <button type="button" onClick={() => { reset({ full_name: profile.full_name, phone: profile.phone ?? '' }); updateMutation.reset(); setEditing(value => !value); }} aria-label={editing ? 'Cancel profile editing' : 'Edit profile'} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-stone-200 text-stone-600 hover:bg-stone-50">
          {editing ? <X size={18}/> : <Pencil size={17}/>}
        </button>
      </div>

      {editing && <form onSubmit={save} noValidate className="mt-5 space-y-3 border-t border-stone-100 pt-5">
        <div><label htmlFor="profile-name" className="mb-1.5 block text-xs font-bold">Full Name</label><input id="profile-name" autoComplete="name" {...register('full_name')} className="min-h-12 w-full rounded-xl border border-stone-200 px-4 text-sm outline-none focus:border-brand-orange"/>{errors.full_name && <p className="mt-1 text-xs text-brand-error">{errors.full_name.message}</p>}</div>
        <div><label htmlFor="profile-phone" className="mb-1.5 block text-xs font-bold">Phone Number</label><input id="profile-phone" type="tel" inputMode="numeric" autoComplete="tel" {...register('phone')} className="min-h-12 w-full rounded-xl border border-stone-200 px-4 text-sm outline-none focus:border-brand-orange"/>{errors.phone && <p className="mt-1 text-xs text-brand-error">{errors.phone.message}</p>}</div>
        <div><span className="mb-1.5 block text-xs font-bold">Email</span><p className="rounded-xl bg-stone-50 px-4 py-3 text-sm text-stone-500">{profile.email} <span className="ml-1 text-xs">Managed by your sign-in account</span></p></div>
        {updateMutation.isError && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-brand-error">{updateMutation.error instanceof Error ? updateMutation.error.message : 'Could not save your changes. Please try again.'}</p>}
        <button type="submit" disabled={updateMutation.isPending} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-brand-orange px-5 py-3 text-sm font-bold text-white disabled:opacity-60">{updateMutation.isPending ? <LoaderCircle size={17} className="animate-spin"/> : <Save size={17}/>}Save changes</button>
      </form>}
      {!editing && <button type="button" onClick={() => { updateMutation.reset(); setEditing(true); }} className="mt-4 inline-flex min-h-10 items-center gap-2 rounded-xl border border-stone-200 px-4 text-sm font-bold text-stone-700 hover:bg-stone-50"><Pencil size={15}/>Edit Profile</button>}
    </section>

    <div className="space-y-2">{profileLinks.map(([label, path, Icon]) => <Link key={path} to={path} className="flex items-center gap-3 rounded-xl bg-white p-4 shadow-sm"><Icon size={18} className="text-brand-orange"/><span className="flex-1 text-sm font-bold">{label}</span><ArrowRight size={16} className="text-stone-400"/></Link>)}
      {logoutError && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-brand-error">{logoutError}</p>}
      <button type="button" onClick={() => void logout()} disabled={loggingOut} aria-busy={loggingOut} className="flex w-full items-center gap-3 rounded-xl border border-red-200 bg-white p-4 text-left text-sm font-bold text-red-600 disabled:cursor-wait disabled:opacity-60"><LogOut size={18}/><span className="flex-1">{loggingOut ? 'Logging out…' : 'Log out'}</span>{!loggingOut && <ArrowRight size={16} className="text-red-300"/>}</button>
    </div>
  </div>;
}

function getProfileErrorMessage(error: unknown) {
  const supabaseError = error as { code?: string; message?: string } | null;
  const message = supabaseError?.message?.toLowerCase() ?? '';
  if (message.includes('profile could not be found')) {
    return 'Your profile record is missing. Apply the customer profile migration, then retry.';
  }
  if (supabaseError?.code === '42501' || supabaseError?.code === 'PGRST301') {
    return 'Supabase blocked access to this profile. Apply the customer profile security migration, then retry.';
  }
  if (supabaseError?.code === 'PGRST116') {
    return 'Your profile record is missing. Apply the customer profile migration, then retry.';
  }
  if (supabaseError?.code === '42703' || supabaseError?.code === 'PGRST204') {
    return 'The profiles table is missing a required field. Apply the latest profile migration, then retry.';
  }
  if (message.includes('auth') || message.includes('session')) {
    return 'Your sign-in session may have expired. Log in again, then reopen your profile.';
  }
  return 'We could not load your profile. Check your connection and try again.';
}

function ProfileMessage({ message, action, onAction, loading = false }: { message: string; action?: string; onAction?: () => void; loading?: boolean }) {
  return <div role={loading ? 'status' : 'alert'} className="rounded-2xl border border-stone-100 bg-white p-5 text-sm text-stone-600 shadow-sm">
    <div className="flex items-center gap-2">{loading && <LoaderCircle size={17} className="animate-spin text-brand-orange"/>}{message}</div>
    {action && onAction && <button type="button" onClick={onAction} className="mt-3 font-bold text-brand-burnt underline">{action}</button>}
    {!action && !loading && <Link to="/login" className="mt-3 inline-flex font-bold text-brand-burnt underline">Return to login</Link>}
  </div>;
}
