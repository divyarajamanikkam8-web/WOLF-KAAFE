# The Wolf Kaafe

Mobile-first React, TypeScript and Vite PWA foundation for The Wolf Kaafe. It uses React Router, Zustand for the local cart/favorites, TanStack Query defaults, Tailwind CSS, Lucide, and a Supabase client that stays disabled until public environment values are supplied.

## Run locally

1. Install Node.js 20 or newer.
2. Copy `.env.example` to `.env.local` and set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` from the Supabase project. Never put a service role key in a Vite environment variable.
3. Run `npm install` and `npm run dev`.

The demo menu is local data when Supabase is not configured. Checkout currently records a demo confirmation in the browser; it does not submit an order unless the Supabase integration and authenticated checkout flow are completed. COD is the only payment method represented.

## Supabase foundation

Apply `supabase/migrations/202609300001_initial_schema.sql` to a new Supabase project. The migration creates the relational schema, customer/admin policies, image buckets, and order realtime publication. Promote the restaurant owner's profile to `admin` using a trusted SQL editor after that user has registered; never expose role editing to a client. Configure email auth and allowed redirect URLs in Supabase before enabling live authentication.

Before production, complete and validate a server-side transactional order creation flow, live address and auth screens, admin CRUD screens, storage upload UX, logo assets and install icon set, operational notifications, and real device/accessibility checks. Seed the menu and restaurant settings in the Supabase project. The provided official logo should be added unchanged to the public brand asset location once supplied.

## Deployment

Build with `npm run build`, serve the `dist` directory over HTTPS, then validate the installed PWA on Android. TWA packaging and Play publication are a later milestone; this repository does not contain an Android/React Native app.
