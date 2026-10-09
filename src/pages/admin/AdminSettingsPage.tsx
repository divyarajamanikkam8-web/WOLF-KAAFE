import { useEffect, useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, ImagePlus, LoaderCircle, Save } from 'lucide-react';
import { getAdminRestaurantSettings, saveAdminRestaurantSettings, uploadRestaurantLogo, type AdminRestaurantSettings } from '../../services/restaurantSettingsService';
import { supabase } from '../../lib/supabase';

type FormState = {
  restaurant_name: string; phone: string; email: string; address: string;
  opening_time: string; closing_time: string; is_open: boolean;
  delivery_fee: string; minimum_order: string; free_delivery_threshold: string;
  estimated_delivery_minutes: string; cash_on_delivery_enabled: boolean;
  notify_new_orders_enabled: boolean; delivery_radius_km: string;
};

const inputClass = 'mt-1.5 min-h-11 w-full rounded-xl border border-stone-200 bg-white px-3 text-sm outline-none focus:border-brand-orange';
const fromSettings = (settings: AdminRestaurantSettings): FormState => ({
  restaurant_name: settings.restaurant_name,
  phone: settings.phone ?? '', email: settings.email ?? '', address: settings.address ?? '',
  opening_time: settings.opening_time?.slice(0, 5) ?? '', closing_time: settings.closing_time?.slice(0, 5) ?? '',
  is_open: settings.is_open, delivery_fee: String(settings.delivery_fee), minimum_order: String(settings.minimum_order),
  free_delivery_threshold: String(settings.free_delivery_threshold), estimated_delivery_minutes: String(settings.estimated_delivery_minutes),
  cash_on_delivery_enabled: settings.cash_on_delivery_enabled, notify_new_orders_enabled: settings.notify_new_orders_enabled,
  delivery_radius_km: String(settings.delivery_radius_km),
});

export function AdminSettingsPage() {
  const queryClient = useQueryClient();
  const settingsQuery = useQuery({ queryKey: ['admin-restaurant-settings'], queryFn: getAdminRestaurantSettings, staleTime: 0, refetchOnMount: 'always' });
  const [form, setForm] = useState<FormState | null>(null);
  const [feedback, setFeedback] = useState('');
  const [accountName, setAccountName] = useState('');
  const [accountEmail, setAccountEmail] = useState('');
  const [accountFeedback, setAccountFeedback] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [passwordFeedback, setPasswordFeedback] = useState('');

  useEffect(() => {
    if (settingsQuery.data) setForm(fromSettings(settingsQuery.data));
  }, [settingsQuery.data]);
  useEffect(() => {
    let active = true;
    void supabase?.auth.getUser().then(({ data, error }) => {
      if (!active || error || !data.user) return;
      setAccountName(String(data.user.user_metadata?.full_name ?? ''));
      setAccountEmail(data.user.email ?? '');
    });
    return () => { active = false; };
  }, []);

  const saveMutation = useMutation({
    mutationFn: (values: Omit<AdminRestaurantSettings, 'id' | 'logo_url'>) => saveAdminRestaurantSettings(values),
    onSuccess: async saved => {
      setForm(fromSettings(saved));
      setFeedback('Settings saved. Customer apps will use these values.');
      await Promise.all([
        queryClient.setQueryData(['admin-restaurant-settings'], saved),
        queryClient.invalidateQueries({ queryKey: ['restaurant-settings'] }),
        queryClient.invalidateQueries({ queryKey: ['admin-dashboard'] }),
      ]);
    },
    onError: () => setFeedback('Could not save settings. Check your connection and try again.'),
  });

  const uploadMutation = useMutation({
    mutationFn: uploadRestaurantLogo,
    onSuccess: async saved => {
      await Promise.all([
        queryClient.setQueryData(['admin-restaurant-settings'], saved),
        queryClient.invalidateQueries({ queryKey: ['restaurant-settings'] }),
      ]);
      setFeedback('Restaurant logo saved.');
    },
    onError: error => setFeedback(error instanceof Error ? error.message : 'Could not upload the logo.'),
  });

  function saveSettings(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!form) return;
    const numberFields = [form.delivery_fee, form.minimum_order, form.free_delivery_threshold, form.estimated_delivery_minutes, form.delivery_radius_km].map(Number);
    if (numberFields.some(value => !Number.isFinite(value)) || numberFields[0] < 0 || numberFields[1] < 0 || numberFields[2] < 0 || numberFields[3] < 1 || numberFields[3] > 720 || numberFields[4] < 0 || !form.restaurant_name.trim()) {
      setFeedback('Enter a restaurant name and valid non-negative settings. Estimated delivery must be 1–720 minutes.');
      return;
    }
    setFeedback('');
    saveMutation.mutate({
      restaurant_name: form.restaurant_name.trim(),
      phone: form.phone.trim() || null, email: form.email.trim() || null, address: form.address.trim() || null,
      opening_time: form.opening_time || null, closing_time: form.closing_time || null,
      is_open: form.is_open, delivery_fee: numberFields[0], minimum_order: numberFields[1],
      free_delivery_threshold: numberFields[2], estimated_delivery_minutes: numberFields[3],
      delivery_radius_km: numberFields[4], cash_on_delivery_enabled: form.cash_on_delivery_enabled,
      notify_new_orders_enabled: form.notify_new_orders_enabled,
    });
  }

  async function saveAccount(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase) return;
    setAccountFeedback('');
    const { error } = await supabase.auth.updateUser({ data: { full_name: accountName.trim() } });
    setAccountFeedback(error ? 'Could not update your admin profile.' : 'Admin profile updated.');
  }

  async function changePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase) return;
    if (newPassword.length < 8) { setPasswordFeedback('Use at least 8 characters for the new password.'); return; }
    setPasswordFeedback('');
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setPasswordFeedback(error ? error.message : 'Password updated through Supabase Auth.');
    if (!error) setNewPassword('');
  }

  if (settingsQuery.isLoading || (settingsQuery.data && !form)) return <SettingsMessage text="Loading saved settings…" loading/>;
  if (settingsQuery.isError || !settingsQuery.data || !form) return <SettingsMessage text="Could not load settings from Supabase. Retry to continue." action={() => void settingsQuery.refetch()}/>;

  const update = <K extends keyof FormState>(key: K, value: FormState[K]) => setForm(current => current ? { ...current, [key]: value } : current);
  const saving = saveMutation.isPending || uploadMutation.isPending;
  return <div className="mx-auto max-w-4xl space-y-5">
    <header><p className="text-xs font-extrabold uppercase tracking-[.18em] text-brand-burnt">Owner workspace</p><h1 className="mt-2 text-2xl font-black sm:text-3xl">Settings</h1><p className="mt-1 text-sm text-stone-500">Changes are saved to Supabase and shared with customers.</p></header>
    <form onSubmit={saveSettings} className="space-y-5">
      <section className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm sm:p-6"><h2 className="font-extrabold">Restaurant information</h2><div className="mt-4 grid gap-4 sm:grid-cols-2">
        <label className="text-xs font-bold text-stone-600">Restaurant name<input required value={form.restaurant_name} onChange={e => update('restaurant_name', e.target.value)} className={inputClass}/></label>
        <label className="text-xs font-bold text-stone-600">Phone number<input type="tel" value={form.phone} onChange={e => update('phone', e.target.value)} className={inputClass}/></label>
        <label className="text-xs font-bold text-stone-600">Contact email<input type="email" value={form.email} onChange={e => update('email', e.target.value)} className={inputClass}/></label>
        <label className="text-xs font-bold text-stone-600">Address<input value={form.address} onChange={e => update('address', e.target.value)} className={inputClass}/></label>
        <label className="text-xs font-bold text-stone-600">Opening time<input type="time" value={form.opening_time} onChange={e => update('opening_time', e.target.value)} className={inputClass}/></label>
        <label className="text-xs font-bold text-stone-600">Closing time<input type="time" value={form.closing_time} onChange={e => update('closing_time', e.target.value)} className={inputClass}/></label>
      </div><div className="mt-4 flex flex-wrap items-center justify-between gap-4 rounded-xl bg-stone-50 p-4"><div><p className="text-sm font-bold">Restaurant is open</p><p className="mt-1 text-xs text-stone-500">Closed status blocks checkout.</p></div><input type="checkbox" checked={form.is_open} onChange={e => update('is_open', e.target.checked)} aria-label="Restaurant is open" className="h-5 w-5 accent-orange-600"/></div>
      <div className="mt-4 flex flex-wrap items-center gap-3"><span className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-xl bg-stone-100">{settingsQuery.data.logo_url ? <img src={settingsQuery.data.logo_url} alt="Restaurant logo" className="h-full w-full object-contain"/> : <ImagePlus size={20} className="text-stone-400"/>}</span><label className="text-sm font-bold text-brand-burnt">Upload restaurant logo<input type="file" accept="image/*" disabled={saving} onChange={event => { const file = event.target.files?.[0]; if (file) uploadMutation.mutate(file); event.currentTarget.value = ''; }} className="mt-1 block max-w-full text-xs font-medium text-stone-500"/></label></div>
      </section>

      <section className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm sm:p-6"><h2 className="font-extrabold">Delivery and payment</h2><div className="mt-4 grid gap-4 sm:grid-cols-2">
        <label className="text-xs font-bold text-stone-600">Delivery fee (₹)<input type="number" min="0" step="0.01" value={form.delivery_fee} onChange={e => update('delivery_fee', e.target.value)} className={inputClass}/></label>
        <label className="text-xs font-bold text-stone-600">Minimum order (₹)<input type="number" min="0" step="0.01" value={form.minimum_order} onChange={e => update('minimum_order', e.target.value)} className={inputClass}/></label>
        <label className="text-xs font-bold text-stone-600">Free delivery from (₹)<input type="number" min="0" step="0.01" value={form.free_delivery_threshold} onChange={e => update('free_delivery_threshold', e.target.value)} className={inputClass}/></label>
        <label className="text-xs font-bold text-stone-600">Estimated delivery (minutes)<input type="number" min="1" max="720" step="1" value={form.estimated_delivery_minutes} onChange={e => update('estimated_delivery_minutes', e.target.value)} className={inputClass}/></label>
      </div><label className="mt-4 flex min-h-12 items-center justify-between gap-4 rounded-xl bg-stone-50 p-4"><span><b className="block text-sm">Cash on Delivery</b><small className="mt-1 block text-xs text-stone-500">This is the payment method supported by the current checkout.</small></span><input type="checkbox" checked={form.cash_on_delivery_enabled} onChange={e => update('cash_on_delivery_enabled', e.target.checked)} className="h-5 w-5 accent-orange-600"/></label><p className="mt-3 text-xs text-stone-500">Online payments are unavailable because no payment gateway is configured.</p></section>

      <section className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm sm:p-6"><h2 className="font-extrabold">Admin notifications</h2><label className="mt-4 flex min-h-12 items-center justify-between gap-4 rounded-xl bg-stone-50 p-4"><span><b className="block text-sm">New order alerts</b><small className="mt-1 block text-xs text-stone-500">Controls the existing live order alert in the admin portal.</small></span><input type="checkbox" checked={form.notify_new_orders_enabled} onChange={e => update('notify_new_orders_enabled', e.target.checked)} className="h-5 w-5 accent-orange-600"/></label><p className="mt-3 text-xs text-stone-500">Order status, registration, and review alerts are not configured in this app.</p></section>
      {feedback && <p role={saveMutation.isError || uploadMutation.isError ? 'alert' : 'status'} className={`rounded-xl p-3 text-sm ${saveMutation.isError || uploadMutation.isError ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-800'}`}>{feedback}</p>}
      <button type="submit" disabled={saving} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-brand-orange px-5 text-sm font-extrabold text-white disabled:opacity-60">{saving ? <LoaderCircle size={17} className="animate-spin"/> : saveMutation.isSuccess ? <Check size={17}/> : <Save size={17}/>}Save settings</button>
    </form>

    <section className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm sm:p-6"><h2 className="font-extrabold">Admin account</h2><form onSubmit={saveAccount} className="mt-4 flex flex-wrap items-end gap-3"><label className="min-w-[220px] flex-1 text-xs font-bold text-stone-600">Profile name<input value={accountName} onChange={e => setAccountName(e.target.value)} className={inputClass}/></label><label className="min-w-[220px] flex-1 text-xs font-bold text-stone-600">Sign-in email<input readOnly value={accountEmail} className={`${inputClass} bg-stone-50`}/></label><button className="min-h-11 rounded-xl border border-stone-200 px-4 text-sm font-bold">Save profile</button></form>{accountFeedback && <p role="status" className="mt-3 text-sm text-stone-600">{accountFeedback}</p>}
      <form onSubmit={event => void changePassword(event)} className="mt-5 flex flex-wrap items-end gap-3 border-t border-stone-100 pt-5"><label className="min-w-[220px] flex-1 text-xs font-bold text-stone-600">New password<input type="password" autoComplete="new-password" minLength={8} value={newPassword} onChange={e => setNewPassword(e.target.value)} className={inputClass}/></label><button className="min-h-11 rounded-xl border border-stone-200 px-4 text-sm font-bold">Change password</button></form>{passwordFeedback && <p role="status" className="mt-3 text-sm text-stone-600">{passwordFeedback}</p>}</section>
  </div>;
}

function SettingsMessage({ text, loading = false, action }: { text: string; loading?: boolean; action?: () => void }) {
  return <section className="rounded-2xl border border-stone-200 bg-white p-6 text-center shadow-sm"><p role={loading ? 'status' : 'alert'} className="text-sm text-stone-600">{text}</p>{action && <button type="button" onClick={action} className="mt-3 min-h-10 rounded-xl bg-brand-orange px-4 text-sm font-bold text-white">Retry</button>}</section>;
}
