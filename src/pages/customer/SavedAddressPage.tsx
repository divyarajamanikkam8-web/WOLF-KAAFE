import { useEffect, useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Check, LoaderCircle, MapPin, Pencil, Save, X } from 'lucide-react';
import { useCustomerProfile } from '../../hooks/useCustomerProfile';
import { getCustomerDefaultAddress, saveCustomerDefaultAddress } from '../../services/customerAddressService';
import type { DeliveryAddressInput } from '../../services/orderService';
import { supabase } from '../../lib/supabase';

const emptyAddress: DeliveryAddressInput = { full_name: '', phone: '', house: '', street: '', area: '', city: '', pincode: '', landmark: '' };
const addressFields: { key: keyof DeliveryAddressInput; label: string; required?: boolean; type?: string }[] = [
  { key: 'full_name', label: 'Full name', required: true, type: 'text' },
  { key: 'phone', label: 'Phone number', required: true, type: 'tel' },
  { key: 'house', label: 'House / Flat', required: true, type: 'text' },
  { key: 'street', label: 'Street', required: true, type: 'text' },
  { key: 'area', label: 'Area', required: true, type: 'text' },
  { key: 'city', label: 'City', required: true, type: 'text' },
  { key: 'pincode', label: 'Pincode', required: true, type: 'text' },
  { key: 'landmark', label: 'Landmark', type: 'text' },
];

export function SavedAddressPage() {
  const queryClient = useQueryClient();
  const { user, authReady } = useCustomerProfile();
  const addressQuery = useQuery({
    queryKey: ['customer-default-address', user?.id],
    queryFn: () => getCustomerDefaultAddress(user!.id),
    enabled: authReady && Boolean(user) && Boolean(supabase),
    staleTime: 0,
  });
  const [address, setAddress] = useState<DeliveryAddressInput>(emptyAddress);
  const [addressOwnerId, setAddressOwnerId] = useState<string | null>(null);
  const [editing, setEditing] = useState(true);
  const [feedback, setFeedback] = useState('');

  useEffect(() => {
    setAddress(emptyAddress);
    setAddressOwnerId(user?.id ?? null);
    setEditing(true);
    setFeedback('');
  }, [user?.id]);

  useEffect(() => {
    if (!addressQuery.isSuccess) return;
    const saved = addressQuery.data;
    setAddress(saved ? {
      full_name: saved.full_name,
      phone: saved.phone,
      house: saved.house,
      street: saved.street,
      area: saved.area,
      city: saved.city,
      pincode: saved.pincode,
      landmark: saved.landmark ?? '',
    } : emptyAddress);
    setEditing(!saved);
  }, [addressQuery.data, addressQuery.isSuccess]);

  const saveMutation = useMutation({
    mutationFn: () => saveCustomerDefaultAddress(user!.id, address),
    onSuccess: saved => {
      queryClient.setQueryData(['customer-default-address', user?.id], saved);
      setFeedback('Your default delivery address has been saved.');
      setEditing(false);
    },
    onError: () => setFeedback('Could not save your address. Check your connection and try again.'),
  });

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    saveMutation.reset();
    setFeedback('');
    if (!address.full_name.trim() || !address.house.trim() || !address.street.trim() || !address.area.trim() || !address.city.trim() || !/^\d{6}$/.test(address.pincode.trim())) {
      setFeedback('Complete all required address fields and enter a valid 6 digit pincode.');
      return;
    }
    if (address.phone.replace(/\D/g, '').length < 10) {
      setFeedback('Enter a valid phone number with at least 10 digits.');
      return;
    }
    saveMutation.mutate();
  }

  function cancelEditing() {
    const saved = addressQuery.data;
    if (!saved) return;
    setAddress({
      full_name: saved.full_name,
      phone: saved.phone,
      house: saved.house,
      street: saved.street,
      area: saved.area,
      city: saved.city,
      pincode: saved.pincode,
      landmark: saved.landmark ?? '',
    });
    setFeedback('');
    setEditing(false);
  }

  return <div className="mx-auto max-w-2xl">
    <h1 className="mb-5 text-3xl font-black">Saved addresses</h1>
    {!authReady ? <div role="status" className="rounded-2xl bg-white p-5 text-sm text-stone-500">Loading your account…</div>
      : !supabase ? <p role="alert" className="rounded-2xl bg-white p-5 text-sm text-stone-600">Address access is unavailable because Supabase is not configured.</p>
      : !user ? <section className="rounded-2xl bg-white p-6 text-center shadow-sm"><MapPin size={28} className="mx-auto text-brand-orange"/><p className="mt-3 font-bold">Sign in to manage your address</p><Link to="/login" state={{ from: '/addresses' }} className="mt-4 inline-flex min-h-11 items-center rounded-xl bg-brand-orange px-5 text-sm font-bold text-white">Sign in</Link></section>
      : addressOwnerId !== user.id || addressQuery.isLoading ? <div role="status" className="flex items-center gap-2 rounded-2xl bg-white p-5 text-sm text-stone-500"><LoaderCircle size={17} className="animate-spin text-brand-orange"/>Loading your saved address…</div>
      : addressQuery.isError ? <section role="alert" className="rounded-2xl bg-white p-5 text-sm text-red-700">Could not load your saved address. <button type="button" onClick={() => void addressQuery.refetch()} className="font-bold underline">Retry</button></section>
      : <section className="rounded-2xl bg-white p-5 shadow-sm sm:p-6">
        {addressQuery.data && !editing ? <>
          <div className="flex items-start gap-3"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-pale text-brand-burnt"><MapPin size={18}/></span><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h2 className="font-extrabold">{addressQuery.data.full_name}</h2><span className="rounded-full bg-green-50 px-2 py-1 text-[10px] font-bold text-green-700">Default</span></div><p className="mt-1 text-sm text-stone-600">{addressQuery.data.phone}</p><p className="mt-3 text-sm leading-6 text-stone-600">{[addressQuery.data.house, addressQuery.data.street, addressQuery.data.area, addressQuery.data.city, addressQuery.data.pincode, addressQuery.data.landmark].filter(Boolean).join(', ')}</p></div></div>
          <button type="button" onClick={() => { setFeedback(''); setEditing(true); }} className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-xl border border-stone-200 px-4 text-sm font-bold text-stone-700 hover:bg-stone-50"><Pencil size={16}/>Edit address</button>
        </> : <>
          <div className="flex items-start justify-between gap-3"><div><h2 className="font-extrabold">{addressQuery.data ? 'Edit delivery address' : 'Add your delivery address'}</h2><p className="mt-1 text-xs text-stone-500">We’ll use this address at checkout. You can change it any time.</p></div>{addressQuery.data && <button type="button" onClick={cancelEditing} aria-label="Cancel address editing" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-stone-200 text-stone-600 hover:bg-stone-50"><X size={17}/></button>}</div>
          <form onSubmit={submit} noValidate className="mt-4">
            <div className="grid gap-3 sm:grid-cols-2">{addressFields.map(field => <label key={field.key} className="block text-xs font-semibold text-stone-600">{field.label}{field.required ? ' *' : ''}<input type={field.type} inputMode={field.key === 'phone' || field.key === 'pincode' ? 'numeric' : undefined} autoComplete={field.key === 'full_name' ? 'name' : field.key === 'phone' ? 'tel' : undefined} value={address[field.key] ?? ''} onChange={event => setAddress(current => ({ ...current, [field.key]: event.target.value }))} className="mt-1.5 min-h-11 w-full rounded-xl border border-stone-200 px-3 text-sm font-normal text-stone-900 outline-none focus:border-brand-orange"/></label>)}</div>
            {feedback && <p role={saveMutation.isError ? 'alert' : 'status'} className={`mt-3 rounded-xl p-3 text-sm ${saveMutation.isError ? 'bg-red-50 text-red-700' : 'bg-brand-pale text-brand-burnt'}`}>{feedback}</p>}
            <button type="submit" disabled={saveMutation.isPending} className="mt-4 inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-brand-orange px-5 text-sm font-extrabold text-white disabled:opacity-60">{saveMutation.isPending ? <LoaderCircle size={16} className="animate-spin"/> : saveMutation.isSuccess ? <Check size={16}/> : <Save size={16}/>}Save address</button>
          </form>
        </>}
        {feedback && addressQuery.data && !editing && <p role="status" className="mt-4 rounded-xl bg-green-50 p-3 text-sm text-green-700">{feedback}</p>}
      </section>}
  </div>;
}
