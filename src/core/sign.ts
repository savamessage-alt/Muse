// ============================================================
// Подпись запросов (HMAC-SHA256), как в Android-приложении
// Нужна для: получение текстов (tracks/{id}/lyrics),
// lossless (get-file-info) и др.
// Чистая JS-реализация — работает в браузере, Electron, Node.
// ============================================================

const K: number[] = [
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
]

const H0 = [0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19]

// ============================================================
// MD5 (чистая JS) — для подписи ссылок на треки: get-mp3
// sign = md5(SIGN_SALT + path[1:] + s)
// ============================================================

const MD5_S = [
  7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20,
  4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23, 6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21,
]
const MD5_K = new Array<number>(64)
for (let i = 0; i < 64; i++) MD5_K[i] = Math.floor(Math.abs(Math.sin(i + 1)) * 4294967296)

function md5Bytes(bytes: Uint8Array): Uint8Array {
  const bitLen = bytes.length * 8
  const rem = bytes.length % 64
  const padLen = rem < 56 ? 56 - rem : 120 - rem
  const msg = new Uint8Array(bytes.length + padLen + 8)
  msg.set(bytes)
  msg[bytes.length] = 0x80
  const dv = new DataView(msg.buffer)
  dv.setUint32(msg.length - 8, bitLen >>> 0, true)
  dv.setUint32(msg.length - 4, Math.floor(bitLen / 4294967296), true)

  let a0 = 0x67452301
  let b0 = 0xefcdab89
  let c0 = 0x98badcfe
  let d0 = 0x10325476

  for (let off = 0; off < msg.length; off += 64) {
    const M = new Array<number>(16)
    for (let j = 0; j < 16; j++) M[j] = dv.getUint32(off + j * 4, true)
    let A = a0
    let B = b0
    let C = c0
    let D = d0
    for (let i = 0; i < 64; i++) {
      let F: number
      let g: number
      if (i < 16) {
        F = (B & C) | (~B & D)
        g = i
      } else if (i < 32) {
        F = (D & B) | (~D & C)
        g = (5 * i + 1) % 16
      } else if (i < 48) {
        F = B ^ C ^ D
        g = (3 * i + 5) % 16
      } else {
        F = C ^ (B | ~D)
        g = (7 * i) % 16
      }
      F = (F + A + MD5_K[i] + M[g]) >>> 0
      A = D
      D = C
      C = B
      B = (B + ((F << MD5_S[i]) | (F >>> (32 - MD5_S[i])))) >>> 0
    }
    a0 = (a0 + A) >>> 0
    b0 = (b0 + B) >>> 0
    c0 = (c0 + C) >>> 0
    d0 = (d0 + D) >>> 0
  }
  const out = new Uint8Array(16)
  const odv = new DataView(out.buffer)
  odv.setUint32(0, a0, true)
  odv.setUint32(4, b0, true)
  odv.setUint32(8, c0, true)
  odv.setUint32(12, d0, true)
  return out
}

/** MD5-хеш строки (UTF-8), hex */
export function md5(input: string): string {
  const bytes = new TextEncoder().encode(input)
  return Array.from(md5Bytes(bytes), (b) => b.toString(16).padStart(2, '0')).join('')
}

function rotr(x: number, n: number): number {
  return ((x >>> n) | (x << (32 - n))) >>> 0
}

function sha256Bytes(bytes: Uint8Array): Uint8Array {
  const l = bytes.length
  const bitLen = l * 8
  // padding: 0x80 + zeros + 64-bit length
  const rem = l % 64
  const padLen = rem < 56 ? 56 - rem : 120 - rem
  const total = l + padLen + 8
  const msg = new Uint8Array(total)
  msg.set(bytes)
  msg[l] = 0x80
  const dv = new DataView(msg.buffer)
  dv.setUint32(total - 8, Math.floor(bitLen / 0x100000000), false)
  dv.setUint32(total - 4, (bitLen >>> 0), false)

  const h = H0.slice()
  for (let i = 0; i < total; i += 64) {
    const w = new Array<number>(64)
    const dv2 = new DataView(msg.buffer)
    for (let t = 0; t < 16; t++) w[t] = dv2.getUint32(i + t * 4, false)
    for (let t = 16; t < 64; t++) {
      const s0 = rotr(w[t - 15], 7) ^ rotr(w[t - 15], 18) ^ (w[t - 15] >>> 3)
      const s1 = rotr(w[t - 2], 17) ^ rotr(w[t - 2], 19) ^ (w[t - 2] >>> 10)
      w[t] = (w[t - 16] + s0 + w[t - 7] + s1) >>> 0
    }
    let [a, b, c, d, e, f, g, hh] = h
    for (let t = 0; t < 64; t++) {
      const S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25)
      const ch = (e & f) ^ (~e & g)
      const temp1 = (hh + S1 + ch + K[t] + w[t]) >>> 0
      const S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22)
      const maj = (a & b) ^ (a & c) ^ (b & c)
      const temp2 = (S0 + maj) >>> 0
      hh = g; g = f; f = e; e = (d + temp1) >>> 0
      d = c; c = b; b = a; a = (temp1 + temp2) >>> 0
    }
    h[0] = (h[0] + a) >>> 0; h[1] = (h[1] + b) >>> 0; h[2] = (h[2] + c) >>> 0; h[3] = (h[3] + d) >>> 0
    h[4] = (h[4] + e) >>> 0; h[5] = (h[5] + f) >>> 0; h[6] = (h[6] + g) >>> 0; h[7] = (h[7] + hh) >>> 0
  }

  const out = new Uint8Array(32)
  const dv3 = new DataView(out.buffer)
  for (let i = 0; i < 8; i++) dv3.setUint32(i * 4, h[i], false)
  return out
}

function toBytes(s: string): Uint8Array {
  return new TextEncoder().encode(s)
}

export function hmacSha256(key: string, message: string): Uint8Array {
  const blockSize = 64
  let keyBytes = toBytes(key)
  if (keyBytes.length > blockSize) keyBytes = sha256Bytes(keyBytes)
  const keyFull = new Uint8Array(blockSize)
  keyFull.set(keyBytes)
  const oKey = new Uint8Array(blockSize)
  const iKey = new Uint8Array(blockSize)
  for (let i = 0; i < blockSize; i++) {
    oKey[i] = keyFull[i] ^ 0x5c
    iKey[i] = keyFull[i] ^ 0x36
  }
  const inner = new Uint8Array(blockSize + toBytes(message).length)
  inner.set(iKey)
  inner.set(toBytes(message), blockSize)
  const innerHash = sha256Bytes(inner)
  const outer = new Uint8Array(blockSize + 32)
  outer.set(oKey)
  outer.set(innerHash, blockSize)
  return sha256Bytes(outer)
}

function base64url(bytes: Uint8Array, stripPadding = false): string {
  let bin = ''
  for (const b of bytes) bin += String.fromCharCode(b)
  let b64 = btoa(bin)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
  if (stripPadding) b64 = b64.replace(/=+$/, '')
  return b64
}

export interface Sign {
  timestamp: number
  value: string
}

/** Подпись для запроса текста песни (ключ Android-приложения) */
export function signRequest(trackId: string): Sign {
  const numeric = String(trackId).split(':')[0]
  const timestamp = Math.floor(Date.now() / 1000)
  const digest = hmacSha256('p93jhgh689SBReK6ghtw62', `${numeric}${timestamp}`)
  return { timestamp, value: base64url(digest) }
}

/** Подпись для get-file-info (lossless; ключ десктопного приложения) */
export function fileInfoSign(
  trackId: string,
  quality: string,
  codecs: string[],
  transport: string,
): Sign {
  const timestamp = Math.floor(Date.now() / 1000)
  const digest = hmacSha256('kzqU4XhfCaY6B6JTHODeq5', `${timestamp}${trackId}${quality}${codecs.join('')}${transport}`)
  return { timestamp, value: base64url(digest, true) }
}