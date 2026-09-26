import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { VitePWA } from 'vite-plugin-pwa'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'robots.txt', 'apple-touch-icon.png'],
      manifest: {
        name: 'Bite Me Baby - สั่งอาหารจัดส่งจันทบุรี',
        short_name: 'BMB',
        description: 'ร้านอาหารไทยจัดส่งถึงบ้านในรัศมี 5 กม. จากตัวเมืองจันทบุรี',
        theme_color: '#F97316',
        background_color: '#FFF7ED',
        display: 'standalone',
        orientation: 'portrait',
        icons: [
          {
            src: '/pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: '/pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
          },
          {
            src: '/pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
      },
    }),
  ],
  resolve: {
    alias: {
      '@': join(__dirname, 'src'),
      // Bundle-size: realtime-js is dead code here (no .channel subscribers) —
      // point the package at a no-op stub instead of shipping ~100KB of Phoenix.
      '@supabase/realtime-js': join(__dirname, 'src/lib/stubs/realtimeStub.ts'),
    },
  },
  server: {
    port: 3000,
    open: true,
  },
  build: {
    target: 'es2019',
    // PWA-01: vendor splitting — keep the heavy supabase client + React out of the
    // index chunk so static caching is stable and the first paint stays small.
    rollupOptions: {
      output: {
        manualChunks(id: string) {
          if (id.includes('node_modules/@supabase')) return 'supabase-vendor'
          if (id.includes('node_modules/react')) return 'react-vendor'
          if (id.includes('node_modules/zustand')) return 'state-vendor'
          if (id.includes('node_modules/axios')) return 'http-vendor'
          return undefined
        },
      },
    },
  },
})