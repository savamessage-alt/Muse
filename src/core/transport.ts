// ============================================================
// Транспорт: единый слой HTTP для разных сред исполнения
//  - Браузер (веб): относительные пути через Vite-прокси (dev)
//    или внешний CORS-прокси (prod build)
//  - Electron: fetch в main-процессе через preload-мост (нет CORS)
//  - Capacitor/Android: нативный CapacitorHttp (нет CORS)
// ============================================================

/** Обязательный заголовок клиента Яндекс Музыки (значение из библиотеки) */
export const YM_CLIENT_HEADER = 'YandexMusicAndroid/24023621'

/** Базовый адрес API Яндекса */
export const API_BASE = 'https://api.music.yandex.net'
/** Базовый адрес OAuth Яндекса */
export const OAUTH_BASE = 'https://oauth.yandex.ru'
/** Публичный CORS-прокси (используется только в собранной веб-версии) */
export const CORS_PROXY_BASE = 'https://yandex-music-cors-proxy.onrender.com'

export class YmApiError extends Error {
  status: number
  code?: string
  constructor(message: string, status: number, code?: string) {
    super(message)
    this.name = 'YmApiError'
    this.status = status
    this.code = code
  }
}

export interface YmRequestInit {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  body?: unknown
  headers?: Record<string, string>
  /** не добавлять заголовок авторизации */
  noAuth?: boolean
  /** абсолютный URL — не применять базовые адреса */
  absolute?: boolean
}

interface ElectronBridge {
  request: (url: string, init: {
    method?: string
    headers?: Record<string, string>
    body?: string
  }) => Promise<{ ok: boolean; status: number; body: string }>
}

declare global {
  interface Window {
    ymElectronAPI?: ElectronBridge
    Capacitor?: { isNativePlatform?: () => boolean; getPlatform?: () => string }
  }
}

/** Публичный CORS-прокси из переменной окружения (настраивается при сборке) */
const envCorsProxy = (import.meta as { env?: Record<string, string> }).env?.VITE_CORS_PROXY

/**
 * Получить XML по абсолютной ссылке (download_info_url → host/path/ts/s).
 * XML-хосты Яндекса не отдают CORS, поэтому:
 *  - браузер dev: через серверный помощник /__xml (Vite-middleware)
 *  - браузер prod: через публичный CORS-прокси
 *  - Electron/Capacitor: напрямую (CORS там не нужен)
 */
export async function ymFetchXml(url: string): Promise<string> {
  if (window.ymElectronAPI) {
    const res = await window.ymElectronAPI.request(url, { method: 'GET' })
    if (!res.ok) throw new YmApiError('Ссылка на XML трека недоступна (HTTP ' + res.status + ')', res.status)
    return res.body
  }
  if (isCapacitorNative()) {
    const mod = await import('@capacitor/core')
    const res = await mod.CapacitorHttp.request({ url, method: 'GET' })
    return String(res.data ?? '')
  }
  const dev = (import.meta as { env?: Record<string, string> }).env?.DEV
  if (dev) {
    const r = await fetch('/__xml?u=' + encodeURIComponent(url))
    if (!r.ok) throw new YmApiError('XML трека не загрузился (HTTP ' + r.status + ')', r.status)
    return r.text()
  }
  const proxy: string | undefined = envCorsProxy || CORS_PROXY_BASE
  if (proxy) {
    const sep = proxy.endsWith('/') ? '' : '/'
    const r = await fetch(proxy + sep + url.replace(/^https?:\/\//, ''))
    if (!r.ok) throw new YmApiError('XML трека не загрузился через CORS-прокси (HTTP ' + r.status + ')', r.status)
    return r.text()
  }
  throw new YmApiError('Нет способа получить XML трека', 0)
}

/** Достать значение тега из простого XML (без внешних библиотек) */
export function xmlTag(xml: string, tag: string): string | null {
  const open = '<' + tag + '>'
  const close = '</' + tag + '>'
  const i = xml.indexOf(open)
  if (i < 0) return null
  const j = xml.indexOf(close, i + open.length)
  if (j < 0) return null
  return xml.slice(i + open.length, j).trim()
}

function resolveUrl(url: string): string {
  const absolute = /^https?:\/\//.test(url)

  // Полный абсолютный URL — используем как есть.
  // Относительный — нормализуем под нужный хост:
  //   '/oauth/token'           → https://oauth.yandex.ru/token
  //   '/api/feed' / 'feed'     → https://api.music.yandex.net/feed
  const target = absolute
    ? url
    : url.startsWith('/oauth/')
      ? OAUTH_BASE + url.slice('/oauth'.length)
      : url.startsWith('/api/')
        ? API_BASE + url.slice('/api'.length)
        : API_BASE + (url.startsWith('/') ? url : '/' + url)

  // Нативные среды: CORS не применяется, идём по абсолютному адресу
  if (window.ymElectronAPI || isCapacitorNative()) return target

  // Браузер в dev-режиме: возвращаем относительный путь С префиксом /api/,
  // чтобы его подхватил Vite-прокси (иначе SPA-fallback отдаст index.html!)
  const dev = (import.meta as { env?: Record<string, string> }).env?.DEV
  if (!absolute && dev) {
    if (url.startsWith('/oauth/') || url.startsWith('/api/')) return url
    return '/api' + (url.startsWith('/') ? url : '/' + url)
  }

  // Браузер в собранной веб-версии: внешний CORS-прокси
  const proxy: string | undefined = envCorsProxy || CORS_PROXY_BASE
  if (!absolute && proxy) {
    const sep = proxy.endsWith('/') ? '' : '/'
    return proxy + sep + target.replace(/^https?:\/\//, '')
  }
  return target
}

export function isCapacitorNative(): boolean {
  try {
    const cap = window.Capacitor
    return !!(cap && (cap.isNativePlatform?.() || cap.getPlatform?.() !== 'web'))
  } catch {
    return false
  }
}

function parseBody(text: string) {
  if (!text) return {}
  try {
    return JSON.parse(text)
  } catch {
    return { raw: text }
  }
}

/** Таймаут сети: Яндекс-API может зависнуть (VPN/прокси) — не даём запросу висеть вечно */
const FETCH_TIMEOUT_MS = 20000

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new YmApiError('Сеть не отвечает (таймаут 20 сек)', 0, 'timeout')),
      ms,
    )
    promise.then(
      (v) => {
        clearTimeout(timer)
        resolve(v)
      },
      (e) => {
        clearTimeout(timer)
        reject(e)
      },
    )
  })
}

export async function ymFetch<T = unknown>(url: string, init: YmRequestInit = {}): Promise<T> {
  const method = init.method ?? 'GET'
  const headers: Record<string, string> = { ...init.headers }

  const hasRawBody = typeof init.body === 'string'
  if (init.body !== undefined && !hasRawBody && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json;charset=utf-8'
  }

  const run = async (): Promise<T> => {
    // 1) Electron: запрос через main-процесс
    if (window.ymElectronAPI) {
      const res = await window.ymElectronAPI.request(resolveUrl(url), {
        method,
        headers,
        body: init.body !== undefined ? (hasRawBody ? (init.body as string) : JSON.stringify(init.body)) : undefined,
      })
      const data = parseBody(res.body)
      if (!res.ok) throw new YmApiError(apiMessage(data, res.status), res.status)
      return data as T
    }

    // 2) Capacitor: нативный HTTP
    if (isCapacitorNative()) {
      // Динамический импорт, чтобы не тянуть @capacitor/core в веб-сборку
      try {
        const mod = await import('@capacitor/core')
        const res = await mod.CapacitorHttp.request({
          url: resolveUrl(url),
          method,
          headers,
          // CapacitorHttp отправляет body как string/object сам
          ...(init.body !== undefined ? { data: init.body } : {}),
        })
        const data = res.data as T
        const status = res.status ?? 200
        if (status < 200 || status >= 300) throw new YmApiError(apiMessage(data, status), status)
        return data
      } catch (e) {
        if (e instanceof YmApiError) throw e
        // Плагин недоступен — падаем с понятной ошибкой
        throw new YmApiError('Нативный HTTP-плагин Capacitor недоступен', 0)
      }
    }

    // 3) Браузер
    const finalUrl = resolveUrl(url)
    const controller = new AbortController()
    const abortTimer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
    try {
      const res = await fetch(finalUrl, {
        method,
        headers,
        body: init.body !== undefined ? (hasRawBody ? (init.body as string) : JSON.stringify(init.body)) : undefined,
        signal: controller.signal,
      })
      const text = await res.text()
      const data = parseBody(text)
      if (!res.ok) throw new YmApiError(apiMessage(data, res.status), res.status)
      return data as T
    } finally {
      clearTimeout(abortTimer)
    }
  }

  return withTimeout(run(), FETCH_TIMEOUT_MS)
}

export function apiMessage(data: unknown, status: number): string {
  const d = data as Record<string, unknown>
  const err = d?.error
  if (typeof err === 'string') {
    // OAuth-формат: {"error": "...", "error_description": "..."}
    const desc = typeof d?.error_description === 'string' ? ' ' + (d.error_description as string) : ''
    return err + desc
  }
  if (err && typeof err === 'object') {
    const e = err as { message?: string; name?: string }
    if (e.message) return e.message
    return e.name || `Ошибка запроса (HTTP ${status})`
  }
  if (typeof d?.message === 'string') return d.message as string
  return `Ошибка запроса (HTTP ${status})`
}