import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, MailCheck } from 'lucide-react';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { supabase } from '../../lib/supabase';

const schema = z.object({ email: z.string().email('Enter a valid email address') });
type Values = z.infer<typeof schema>;

export function ForgotPasswordPage() {
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const { register, handleSubmit, formState: { errors } } = useForm<Values>({ resolver: zodResolver(schema) });
  const submit = handleSubmit(async ({ email }) => {
    setBusy(true); setMessage(''); setError('');
    if (!supabase) { setError('Supabase is not configured for this app.'); setBusy(false); return; }
    const { error: requestError } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/reset-password` });
    if (requestError) setError(requestError.message);
    else setMessage('If that email has an account, a password reset link is on its way. Check your inbox.');
    setBusy(false);
  });
  return <div className="mx-auto max-w-md py-4 sm:py-10"><Link to="/admin/login" className="inline-flex items-center gap-2 text-sm font-semibold text-brand-burnt"><ArrowLeft size={16}/> Back to admin login</Link><section className="mt-5 rounded-3xl border border-stone-100 bg-white p-6 shadow-soft sm:p-8"><span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-pale text-brand-orange"><MailCheck size={23}/></span><h1 className="mt-4 text-2xl font-black">Reset your password</h1><p className="mt-2 text-sm text-stone-500">Enter the owner email. We’ll send a secure link to choose a new password.</p><form onSubmit={submit} className="mt-6 space-y-4"><div><label htmlFor="reset-email" className="mb-1.5 block text-xs font-bold">Email address</label><input id="reset-email" type="email" autoComplete="email" {...register('email')} placeholder="owner@wolfkaafe.com" className="min-h-12 w-full rounded-xl border border-stone-200 px-4 text-sm outline-none focus:border-brand-orange"/>{errors.email&&<p className="mt-1 text-xs text-brand-error">{errors.email.message}</p>}</div>{message&&<p role="status" className="rounded-xl bg-green-50 p-3 text-sm text-green-700">{message}</p>}{error&&<p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-brand-error">{error}</p>}<button disabled={busy} className="w-full rounded-xl bg-brand-orange px-4 py-3 text-sm font-extrabold text-white disabled:opacity-60">{busy?'Sending link…':'Send password reset link'}</button></form></section></div>;
}
