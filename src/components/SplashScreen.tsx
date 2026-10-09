import { useEffect, useState } from 'react';
import { RestaurantLogo } from './RestaurantLogo';

export function SplashScreen() {
  const [visible, setVisible] = useState(() => !sessionStorage.getItem('wolf-kaafe-splash-seen-v2'));
  useEffect(() => {
    if (!visible) return;
    const timer = window.setTimeout(() => {
      sessionStorage.setItem('wolf-kaafe-splash-seen-v2', 'true');
      setVisible(false);
    }, 4800);
    return () => window.clearTimeout(timer);
  }, [visible]);
  if (!visible) return null;
  return <div role="status" aria-label="The Wolf Kaafe loading" className="splash-screen fixed inset-0 z-[100] flex items-center justify-center overflow-hidden bg-brand-pale">
    <div className="splash-glow splash-glow-one"/><div className="splash-glow splash-glow-two"/>
    <div className="splash-orbit splash-orbit-one"/><div className="splash-orbit splash-orbit-two"/>
    <div className="splash-content relative z-10 flex flex-col items-center">
      <div className="splash-logo-halo"><RestaurantLogo className="splash-logo h-52 w-52 object-contain sm:h-64 sm:w-64"/></div>
      <p className="splash-tagline mt-2 text-[10px] font-extrabold uppercase tracking-[.28em] text-brand-burnt">Good food. Great moments.</p>
      <div className="mt-5 h-1 w-40 overflow-hidden rounded-full bg-brand-soft"><span className="splash-progress block h-full rounded-full bg-brand-orange"/></div>
    </div>
  </div>;
}
