import { ArrowRight, MapPin, Star } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { getProfileRole } from '../../services/authService';
import { RestaurantLogo } from '../../components/RestaurantLogo';

export function WelcomePage() {
  const navigate = useNavigate();
  const [checkingSession, setCheckingSession] = useState(Boolean(supabase));
  useEffect(() => {
    let active = true;
    async function checkSession() {
      if (!supabase) return;
      try {
        const { data } = await supabase.auth.getSession();
        const user = data.session?.user;
        if (user) {
          const role = await getProfileRole(user.id);
          if (active && role) navigate(role === 'admin' ? '/admin/dashboard' : '/home', { replace: true });
        }
      } catch {
        // Keep the welcome page available if the profile lookup needs attention.
      } finally {
        if (active) setCheckingSession(false);
      }
    }
    void checkSession();
    return () => { active = false; };
  }, [navigate]);

  if (checkingSession) return <main className="flex min-h-[calc(100dvh-40px)] items-center justify-center"><RestaurantLogo alt="Checking your Wolf Kaafe account" className="h-40 w-40 animate-soft-in object-contain"/></main>;
  return <main className="welcome-page animate-page-in relative isolate flex min-h-[calc(100dvh-40px)] flex-col items-center justify-center overflow-hidden rounded-[2rem] bg-brand-pale px-5 py-8 text-center sm:px-10 sm:py-12">
    <div className="welcome-glow welcome-glow-top"/><div className="welcome-glow welcome-glow-bottom"/>
    <div className="welcome-logo-wrap relative mb-5 grid place-items-center sm:mb-7">
      <div className="welcome-center-ring welcome-center-ring-one"/><div className="welcome-center-ring welcome-center-ring-two"/>
      <RestaurantLogo className="welcome-center-logo relative z-10 h-44 w-44 object-contain sm:h-56 sm:w-56" />
    </div>
    <div className="relative z-10 flex w-full max-w-2xl flex-col items-center">
      <p className="inline-flex items-center gap-2 rounded-full border border-brand-soft bg-white/85 px-4 py-2 text-xs font-bold text-brand-burnt"><MapPin size={14}/> Fresh from our kitchen</p>
      <h1 className="mt-5 text-4xl font-black leading-[1.05] tracking-tight text-brand-ink sm:text-5xl md:text-6xl">Good Food.<br/><span className="text-brand-orange">Great Moments.</span></h1>
      <p className="mt-5 max-w-xl text-base leading-relaxed text-brand-gray sm:text-lg">Discover delicious food, customize your order, and get your favorites delivered to your doorstep.</p>
      <div className="mt-8 flex w-full max-w-sm justify-center">
        <Link to="/onboarding" className="inline-flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl bg-brand-orange px-7 text-sm font-extrabold text-white shadow-lg shadow-orange-200 transition hover:-translate-y-1 hover:bg-brand-burnt hover:shadow-xl">Get Started <ArrowRight size={18}/></Link>
      </div>
      <div className="mt-8 flex items-center justify-center gap-2 text-xs font-semibold text-stone-600"><Star size={15} className="fill-amber-400 text-amber-400"/> Good food, made fresh every day</div>
    </div>
  </main>;
}
