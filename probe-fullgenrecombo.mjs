import { chromium } from 'playwright'

const browser = await chromium.connectOverCDP('http://localhost:9222')
const ctx = browser.contexts()[0]
const p = ctx.pages().find((pg) => pg.url().includes('localhost:5173'))
if (!p) {
  console.log('NO PAGE')
  await browser.close()
  process.exit(0)
}
const result = await p.evaluate(async () => {
  const tok = JSON.parse(localStorage.getItem('ym.oauth'))
  const token = tok.accessToken || tok.access_token || tok.token
  const api = async (path, opts = {}) => {
    const headers = {
      Authorization: 'OAuth ' + token,
      'X-Yandex-Music-Client': 'YandexMusicAndroid/24023621',
      ...(opts.headers || {}),
    }
    const res = await fetch('/api' + path, { method: opts.method || 'GET', headers, body: opts.body })
    let body = {}
    try {
      body = await res.json()
    } catch {
      body = {}
    }
    return { status: res.status, body }
  }
  const count = async (station, seeds) => {
    const q = 'shuffle=true' + seeds.map((s) => '&seed=' + encodeURIComponent(s)).join('')
    const r = await api('/rotor/station/' + station + '/tracks?' + q)
    const seq = r.body && r.body.result && r.body.result.sequence
    return { status: r.status, n: Array.isArray(seq) ? seq.filter((x) => x.type === 'track').length : 0 }
  }
  const out = {}
  // Genre + full settings combo
  out.genreFull = await count('genre:rock', [
    'settingMood:M3',
    'settingEnergy:E2',
    'settingDiversity:favorite',
    'settingLanguage:russian',
  ])
  // Genre + moodenergy+language
  out.genreAlt = await count('genre:indie', [
    'settingMoodEnergy:calm',
    'settingLanguage:not-russian',
  ])
  return out
})
console.log(JSON.stringify(result, null, 2))
await browser.close()