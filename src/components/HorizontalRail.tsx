import type { ReactNode } from 'react';

export function HorizontalRail({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`hide-scrollbar -mx-4 flex min-w-0 snap-x snap-mandatory gap-3 overflow-x-auto overflow-y-hidden overscroll-x-contain scroll-smooth px-4 pb-2 sm:mx-0 sm:px-0 ${className}`}>
    {children}
  </div>;
}
