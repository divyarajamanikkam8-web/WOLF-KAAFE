import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Eye, EyeOff, KeyRound } from 'lucide-react';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { signOut } from '../../services/authService';
import { supabase } from '../../lib/supabase';

const schema = z.object({ password: z.string().min(8, 'Use at least 8 characters'), confirmPassword: z.string() }).refine(values => values.password === values.confirmPassword, { path: ['confirmPassword'], message: 'Passwords do not match' });
type Values = z.infer<typeof schema>;

export function ResetPasswordPage() {
  const navigate = useNavigate();
  const [validLink, setValidLink] = useState(false);
  const [checking, setChecking] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const { register, handleSubmit, formState: { errors } } = useForm<Values>({ resolver: zodResolver(schema) });

  useEffect(() => {
    if (!supabase) { setChecking(false); return; }
    let active = true;
    const { data: listener } = supabase.auth.onAuthStateChange(event => {
      if (event === 'PASSWORD_RECOVERY' && active) { setValidLink(true); setChecking(false); }
    });
    void supabase.auth.getSession().then(({ data }) => {
      if (active && data.session) { setValidLink(true); setChecking(false); }
      else if (active) setChecking(false);
    });
    return () => { active = false; listener.subscription.unsubscribe(); };
  }, []);

  const submit = handleSubmit(async ({ password }) => {
    if (!supabase) { setError('Supabase is not configured for this app.'); return; }
    setBusy(true); setError('');
    const { error: updateError } = await supabase.auth.updateUser({ password });
    if (updateError) { setError(updateError.message); setBusy(false); return; }
    await signOut();
    navigate('/admin/login', { replace: true, state: { passwordUpdated: true } });
  });

  return <div className="mx-auto max-w-md py-4 sm:py-10"><Link to="/admin/login" className="inline-flex items-center gap-2 text-sm font-semibold text-brand-burnt"><ArrowLeft size={16}/> Admin login</Link><section className="mt-5 rounded-3xl border border-stone-100 bg-white p-6 shadow-soft sm:p-8"><span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-pale text-brand-orange"><KeyRound size={23}/></span><h1 className="mt-4 text-2xl font-black">Choose a new password</h1>{checking?<p className="mt-2 text-sm text-stone-500">Checking your secure reset link…</p>:!validLink?<><p className="mt-2 text-sm text-stone-500">This reset link is missing, expired, or already used. Request another link to continue.</p><Link to="/forgot-password" className="mt-5 inline-flex rounded-xl bg-brand-orange px-5 py-3 text-sm font-bold text-white">Request a new link</Link></>:<form onSubmit={submit} className="mt-6 space-y-4"><div><label htmlFor="new-password" className="mb-1.5 block text-xs font-bold">New password</label><div className="relative"><input id="new-password" type={showPassword?'text':'password'} autoComplete="new-password" {...register('password')} className="min-h-12 w-full rounded-xl border border-stone-200 px-4 pr-12 text-sm outline-none focus:border-brand-orange"/><button type="button" onClick={()=>setShowPassword(!showPassword)} aria-label={showPassword?'Hide password':'Show password'} className="absolute right-2 top-1/2 -translate-y-1/2 text-stone-400">{showPassword?<EyeOff size={18}/>:<Eye size={18}/>}</button></div>{errors.password&&<p className="mt-1 text-xs text-brand-error">{errors.password.message}</p>}</div><div><label htmlFor="confirm-password" className="mb-1.5 block text-xs font-bold">Confirm new password</label><input id="confirm-password" type="password" autoComplete="new-password" {...register('confirmPassword')} className="min-h-12 w-full rounded-xl border border-stone-200 px-4 text-sm outline-none focus:border-brand-orange"/>{errors.confirmPassword&&<p className="mt-1 text-xs text-brand-error">{errors.confirmPassword.message}</p>}</div>{error&&<p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-brand-error">{error}</p>}<button disabled={busy} className="w-full rounded-xl bg-brand-orange px-4 py-3 text-sm font-extrabold text-white disabled:opacity-60">{busy?'Updating password…':'Save new password'}</button></form>}</section></div>;
}
