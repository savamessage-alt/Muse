import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // Относительные пути к ассетам — чтобы собранное приложение работало
  // в Electron из file:// (loadFile) и на Android-WebView
  base: './',
  server: {
    host: true, // доступ с телефона/других устройств по Wi-Fi
    port: 5173,
    proxy: {
      // В dev-режиме браузер ходит на относительные пути — Vite проксирует к Яндексу,
      // обходя CORS (см. src/core/transport.ts → resolveUrl)
      '/api/': {
        target: 'https://api.music.yandex.net',
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/api/, ''),
      },
      '/oauth/': {
        target: 'https://oauth.yandex.ru',
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/oauth/, ''),
      },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
  },
})