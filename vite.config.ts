import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
export default defineConfig({ plugins: [react(), VitePWA({ registerType: 'autoUpdate', includeAssets: ['images/wolf-kaafe-logo.png'], manifest: { name: 'The Wolf Kaafe', short_name: 'Wolf Kaafe', description: 'Fresh food delivered to your doorstep', theme_color: '#f97316', background_color: '#fff7ed', display: 'standalone', start_url: '/', icons: [{ src: '/images/wolf-kaafe-logo.png', sizes: '192x192', type: 'image/png' }, { src: '/images/wolf-kaafe-logo.png', sizes: '512x512', type: 'image/png' }] } })] });
