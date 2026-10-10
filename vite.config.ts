import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { VitePWA } from 'vite-plugin-pwa'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

export default defineConfig({
  // Omise published key: the owner configured the exact name
  // `OMISE_PUBLISHED_API_KEY_TEST_MODE` (no VITE_ prefix). Vite only ships
  // VITE_* to the client by default, so whitelist exactly that one name while
  // keeping 'VITE_' first so every existing public var still works.
  envPrefix: ['VITE_', 'OMISE_PUBLISHED_API_KEY_TEST_MODE'],
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'robots.txt', 'apple-touch-icon.png'],
      // W3-D-7: Web Push requires a hand-written service worker (the `push` and
      // `notificationclick` handlers cannot be expressed through generateSW).
      // injectManifest keeps the existing offline precache behaviour and adds
      // the push handlers on top — see src/sw.ts.
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      injectRegister: 'auto',
      injectManifest: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
      },
      manifest: {
        name: 'Bite Me Baby - สั่งอาหารจัดส่งจันทบุรี',
        short_name: 'BMB',
        description: 'ร้านอาหารไทยจัดส่งถึงบ้านในรัศมี 5 กม. จากตัวเมืองจันทบุรี',
        theme_color: '#FF5E1E',
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
        // ignored in injectManifest mode — the values live under injectManifest above
        globPatterns: [],
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
    // TUNNEL (Owner 2026-10-08): เปิดให้เครื่องภายนอก (มือถือคนละวงเน็ต)
    // เข้า dev server ผ่าน ngrok / localtunnel ได้
    host: '0.0.0.0',      // รับ connection ทุก interface (ไม่ใช่แค่ 127.0.0.1)
    port: 3000,           // ล็อกพอร์ตคงที่ — tunnel ชี้ 3000 เสมอ
    strictPort: true,     // ถ้า 3000 ถูกใช้ → error ทันที ห้ามเลื่อนไป 3001/5173
                          // (การเลื่อนพอร์ต = สาเหตุ Bad Gateway เมื่อเข้าผ่าน tunnel)
    open: false,          // ปิด auto-open ตอนมี tunnel (ไม่จำเป็นต้องเปิดเบราว์เซอร์เครื่อง dev)
    allowedHosts: true,   // Vite 5.1+: อนุญาต Host ของ ngrok/loca.lt
                          // (ไม่งั้นเจอ "Blocked request. This host is not allowed")
    hmr: { clientPort: 443 }, // HMR websocket ผ่าน https ของ tunnel (กัน console ws error)
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