// ============================================================
// OAuth Яндекс: Device Flow + обновление токена
// Точная логика — по исходникам MarshalX/yandex-music-api
// (yandex_music/_client/device_auth.py)
// ============================================================

import { ymFetch, YmApiError } from './transport'

export const YM_CLIENT_ID = '23cabbbdc6cd418abb4b39c32c41195d'
export const YM_CLIENT_SECRET = '53bc75238f0c4d08a118e51fe9203300'
const DEVICE_NAME = 'YandexMusicAPI'

export interface DeviceCodeData {
  deviceCode: string
  userCode: string
  verificationUrl: string
  expiresIn: number
  interval: number
  deviceId: string
}

export interface OAuthTokenData {
  accessToken: string
  refreshToken?: string
  expiresIn: number
  tokenType?: string
}

function randDeviceId(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  let out = ''
  for (let i = 0; i < 10; i++) out += chars[Math.floor(Math.random() * chars.length)]
  return out
}

/** Запрашиваем код устройства для входа */
export async function requestDeviceCode(): Promise<DeviceCodeData> {
  const deviceId = randDeviceId()
  const body = new URLSearchParams({
    client_id: YM_CLIENT_ID,
    device_id: deviceId,
    device_name: DEVICE_NAME,
  }).toString()

  const res = await ymFetch<Record<string, unknown>>('/oauth/device/code', {
    method: 'POST',
    absolute: true,
    headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=utf-8' },
    body,
    noAuth: true,
  })

  if (!res.device_code || !res.user_code) {
    throw new Error('Не удалось получить код устройства: ' + JSON.stringify(res))
  }
  return {
    deviceCode: String(res.device_code),
    userCode: String(res.user_code),
    verificationUrl: String(res.verification_url ?? 'https://passport.yandex.com/device'),
    expiresIn: Number(res.expires_in ?? 900),
    interval: Number(res.interval ?? 5),
    deviceId,
  }
}

/** Один опрос статуса подтверждения. Возвращает токен или null (если ещё ждём). */
async function pollOnce(deviceCode: string): Promise<OAuthTokenData | null> {
  const body = new URLSearchParams({
    grant_type: 'device_code',
    code: deviceCode,
    client_id: YM_CLIENT_ID,
    client_secret: YM_CLIENT_SECRET,
  }).toString()

  try {
    const res = await ymFetch<Record<string, unknown>>('/oauth/token', {
      method: 'POST',
      absolute: true,
      headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=utf-8' },
      body,
      noAuth: true,
    })

    if (res.access_token) {
      return {
        accessToken: String(res.access_token),
        refreshToken: res.refresh_token ? String(res.refresh_token) : undefined,
        expiresIn: Number(res.expires_in ?? 0),
        tokenType: res.token_type ? String(res.token_type) : 'bearer',
      }
    }
    return null
  } catch (e) {
    if (e instanceof YmApiError) {
      const msg = e.message
      if (msg.includes('authorization_pending')) return null
      if (msg.includes('access_denied')) throw new Error('Вы отклонили вход в приложении Яндекса')
      if (msg.includes('expired_token')) throw new Error('Код устройства истёк — начните вход заново')
      if (msg.includes('invalid_client')) throw new Error('Неверный client_id (устаревшие данные приложения)')
      throw new Error('Ошибка OAuth: ' + msg)
    }
    throw e
  }
}

/** Опрашиваем статус подтверждения входа */
export async function pollDeviceToken(
  deviceCode: string,
  interval: number,
  maxSeconds: number,
  onPollError?: (error: string) => void,
): Promise<OAuthTokenData> {
  const deadline = Date.now() + maxSeconds * 1000
  let pollInterval = Math.max(interval, 3) // сек
  let attempt = 0

  // Подсказка: HTTP 400 на /oauth/token до подтверждения — это штатное поведение Device Flow
  console.info(
    '[YM Player] Ожидаем подтверждение входа на Яндекс. Ошибки 400 (authorization_pending) в консоли — это нормальный опрос, а не сбой.',
  )

  while (Date.now() < deadline) {
    await sleep(pollInterval * 1000)
    attempt++
    const token = await pollOnce(deviceCode)
    if (token) return token
    onPollError?.('authorization_pending')
    console.info(`[YM Player] ...проверка №${attempt} — вход ещё не подтверждён`)
  }

  throw new Error('Время ожидания входа истекло')
}

/** Обновление токена по refresh_token (если Яндекс выдал refresh_token) */
export async function refreshOAuthToken(refreshToken: string): Promise<OAuthTokenData> {
  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
    client_id: YM_CLIENT_ID,
    client_secret: YM_CLIENT_SECRET,
  }).toString()

  const res = await ymFetch<Record<string, unknown>>('/oauth/token', {
    method: 'POST',
    absolute: true,
    headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=utf-8' },
    body,
    noAuth: true,
  })

  if (!res.access_token) {
    const err = String(res.error ?? 'unknown_error')
    if (err === 'invalid_grant' || err === 'invalid_token' || err === 'unauthorized_client') {
      throw new Error('REFRESH_REVOKED') // код: refresh-токен недействителен
    }
    throw new Error('Ошибка обновления токена: ' + err)
  }

  return {
    accessToken: String(res.access_token),
    refreshToken: res.refresh_token ? String(res.refresh_token) : refreshToken,
    expiresIn: Number(res.expires_in ?? 0),
    tokenType: res.token_type ? String(res.token_type) : 'bearer',
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}