import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'

// Диагностика: приложение шлёт POST /__diag с состоянием токена —
// логируем на сервер, чтобы видеть причину «не пускает в плеер»
const diagLogger = (): Plugin => ({
  name: 'diag-logger',
  configureServer(server) {
    server.middlewares.use('/__diag', (req, res) => {
      let body = ''
      req.on('data', (c: Buffer) => (body += c.toString()))
      req.on('end', () => {
        console.log('[DIAG]', body)
        res.statusCode = 200
        res.end('ok')
      })
    })
    // Серверный помощник: скачивает XML параметров трека (host/path/ts/s) —
    // браузер не может напрямую из-за CORS
    server.middlewares.use('/__xml', async (req, res) => {
      try {
        const u = new URL(req.url ?? '', 'http://localhost').searchParams.get('u')
        if (!u) {
          res.statusCode = 400
          res.end('no url')
          return
        }
        const r = await fetch(u, { headers: { 'User-Agent': 'Mozilla/5.0', Accept: '*/*' } })
        const text = await r.text()
        res.statusCode = r.status
        res.setHeader('Content-Type', 'text/plain; charset=utf-8')
        res.end(text)
      } catch (e) {
        res.statusCode = 502
        res.end('xml proxy error: ' + String(e))
      }
    })
    // Проверка прямой ссылки на трек: качаем начало файла С ЗАГОЛОВКАМИ клиента —
    // узнаём, отдаёт ли сервер mp3 или 403/HTML (проверка, почему не играет)
    server.middlewares.use('/__probe', async (req, res) => {
      try {
        const u = new URL(req.url ?? '', 'http://localhost').searchParams.get('u')
        const client = new URL(req.url ?? '', 'http://localhost').searchParams.get('c') ?? 'YandexMusicAndroid/24023621'
        if (!u) {
          res.statusCode = 400
          res.end(JSON.stringify({ error: 'no url' }))
          return
        }
        const r = await fetch(u, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/156.0.0.0',
            'X-Yandex-Music-Client': client,
            Range: 'bytes=0-1023',
          },
        })
        const chunk = (await r.arrayBuffer()).slice(0, 200)
        const head = Array.from(new Uint8Array(chunk))
          .map((b) => String.fromCharCode(b))
          .join('')
        res.setHeader('Content-Type', 'application/json')
        res.end(
          JSON.stringify({
            status: r.status,
            contentType: r.headers.get('content-type') || '',
            contentRange: r.headers.get('content-range') || '',
            contentLength: r.headers.get('content-length') || '',
            head: head.replace(/[^\x20-\x7E]/g, '.'),
          }),
        )
      } catch (e) {
        res.statusCode = 502
        res.end(JSON.stringify({ error: String(e) }))
      }
    })
  },
})

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), diagLogger()],
  // Относительные пути к ассетам — чтобы собранное приложение работало
  // в Electron из file:// (loadFile) и на Android-WebView
  base: './',
  server: {
    host: true, // доступ с телефона/других устройств по Wi-Fi
    port: 5173,
    watch: {
      ignored: ['**/node_modules/**', '**/dist/**', '**/release/**', '**/android/**', '**/.research-marshalx/**'],
    },
    proxy: {
      // В dev-режиме браузер ходит на относительные пути — Vite проксирует к Яндексу,
      // обходя CORS (см. src/core/transport.ts → resolveUrl)
      '/api/': {
        target: 'https://api.music.yandex.net',
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/api/, ''),
        configure: (proxy) => {
          // Яндекс-API может резать POST (записи) с чужого Origin/Referer —
          // снимаем их (браузер шлёт Origin: localhost даже при same-origin POST)
          proxy.on('proxyReq', (proxyReq, req) => {
            proxyReq.removeHeader('origin')
            proxyReq.removeHeader('referer')
            // отладка: что реально уходит в POST-запросах лайков
            if (req.method === 'POST' && String(req.url).includes('likes')) {
              let body = ''
              req.on('data', (c: Buffer) => (body += c.toString()))
              req.on('end', () => console.log('[PROXY]', req.method, req.url, 'body=', body))
            }
          })
          proxy.on('proxyRes', (proxyRes, req) => {
            if (req.method === 'POST' && String(req.url).includes('likes')) {
              let body = ''
              proxyRes.on('data', (c: Buffer) => (body += c.toString()))
              proxyRes.on('end', () => console.log('[PROXY-RES]', proxyRes.statusCode, body.slice(0, 300)))
            }
          })
        },
      },
      '/oauth/': {
        target: 'https://oauth.yandex.ru',
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/oauth/, ''),
        configure: (proxy) => {
          proxy.on('proxyReq', (proxyReq) => {
            proxyReq.removeHeader('origin')
            proxyReq.removeHeader('referer')
          })
        },
      },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
  },
})