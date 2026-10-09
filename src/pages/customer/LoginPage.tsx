import { useState } from 'react';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeft, Eye, EyeOff } from 'lucide-react';
import { signIn, getProfileRole, signOut } from '../../services/authService';
import { RestaurantLogo } from '../../components/RestaurantLogo';

const customerSchema = z.object({ email: z.string().email('Enter a valid email address'), password: z.string().min(1, 'Enter your password') });
const adminSchema = z.object({ email: z.string().email('Enter a valid admin email address'), password: z.string().min(1, 'Enter your password') });
type Values = z.infer<typeof customerSchema>;

export function LoginPage({ admin = false }: { admin?: boolean }) {
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { register, handleSubmit, formState: { errors } } = useForm<Values>({ resolver: zodResolver(admin ? adminSchema : customerSchema) });
  const submit = handleSubmit(async values => {
    setError(''); setBusy(true);
    try {
      const result = await signIn(values.email, values.password);
      if (!result) throw new Error('Authentication is not configured yet. Add the Supabase URL and anon key to .env.local.');
      if (result.error) throw result.error;
      const role = await getProfileRole(result.data.user.id);
      if (role !== (admin ? 'admin' : 'customer')) {
        if (result.data.session) await signOut();
        throw new Error(admin ? 'This account does not have Owner/Admin access.' : 'This account is not a customer account.');
      }
      navigate(admin ? '/admin/dashboard' : (location.state as { from?: string } | null)?.from ?? '/home', { replace: true });
    } catch (err) { setError(err instanceof Error ? err.message : 'Unable to sign in. Please try again.'); }
    finally { setBusy(false); }
  });
  return <div className="mx-auto max-w-md py-4 sm:py-10"><Link to={admin?'/onboarding':'/'} className="inline-flex items-center gap-2 text-sm font-semibold text-stone-500"><ArrowLeft size={16}/> Back</Link><div className="animate-login-in mt-5 rounded-3xl border border-stone-100 bg-white p-5 shadow-soft sm:p-8"><div className="mb-6 text-center"><RestaurantLogo className="mx-auto h-24 w-28 object-contain"/><p className="mt-2 text-xs font-extrabold uppercase tracking-[.2em] text-brand-orange">{admin?'Owner access':'THE WOLF KAAFE'}</p><h1 className="mt-1 text-2xl font-black">{admin?'Owner Admin Login':'Welcome Back, Food Lover!'}</h1><p className="mt-2 text-sm text-stone-500">{admin?'Manage The Wolf Kaafe from your restaurant dashboard.':'Login to continue to The Wolf Kaafe'}</p></div>
    <div className="mb-6 grid grid-cols-2 rounded-xl bg-stone-100 p-1"><Link to="/login" className={`rounded-lg py-2.5 text-center text-xs font-bold ${!admin?'bg-white text-brand-burnt shadow-sm':'text-stone-500'}`}>Customer Login</Link><Link to="/admin/login" className={`rounded-lg py-2.5 text-center text-xs font-bold ${admin?'bg-white text-brand-burnt shadow-sm':'text-stone-500'}`}>Admin Login</Link></div>
    <form onSubmit={submit} noValidate className="space-y-4"><div><label htmlFor="email" className="mb-1.5 block text-xs font-bold">{admin?'Admin Email':'Email'}</label><input id="email" autoComplete="username" type="email" placeholder={admin?'Enter admin email':'Enter your email address'} {...register('email')} className="min-h-12 w-full rounded-xl border border-stone-200 px-4 text-sm outline-none focus:border-brand-orange"/>{errors.email&&<p className="mt-1 text-xs text-brand-error">{errors.email.message}</p>}</div><div><div className="mb-1.5 flex items-center justify-between"><label htmlFor="password" className="text-xs font-bold">Password</label><Link to="/forgot-password" className="text-xs font-bold text-brand-burnt">Forgot Password?</Link></div><div className="relative"><input id="password" autoComplete="current-password" type={showPassword?'text':'password'} placeholder={admin?'Enter admin password':'Enter your password'} {...register('password')} className="min-h-12 w-full rounded-xl border border-stone-200 px-4 pr-12 text-sm outline-none focus:border-brand-orange"/><button type="button" onClick={()=>setShowPassword(!showPassword)} aria-label={showPassword?'Hide password':'Show password'} className="absolute right-3 top-3.5 text-stone-400">{showPassword?<EyeOff size={18}/>:<Eye size={18}/>}</button></div>{errors.password&&<p className="mt-1 text-xs text-brand-error">{errors.password.message}</p>}</div>{error&&<p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-brand-error">{error}</p>}<button disabled={busy} className={`min-h-12 w-full rounded-xl py-3 text-sm font-extrabold text-white disabled:opacity-60 ${admin?'bg-brand-ink':'bg-brand-orange'}`}>{busy?'Signing in…':admin?'Login to Admin Panel':'Login as Customer'}</button></form>
    {!admin&&<p className="mt-5 text-center text-sm text-stone-500">Don't have an account? <Link to="/register" className="font-extrabold text-brand-burnt">Create Account</Link></p>}
  </div></div>;
}
