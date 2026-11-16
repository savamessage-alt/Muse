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
  const count = async (seeds) => {
    const q = 'shuffle=true' + seeds.map((s) => '&seed=' + encodeURIComponent(s)).join('')
    const r = await api('/rotor/station/user:onyourwave/tracks?' + q)
    const seq = r.body && r.body.result && r.body.result.sequence
    return { status: r.status, n: Array.isArray(seq) ? seq.filter((x) => x.type === 'track').length : 0 }
  }
  const out = {}
  // Language variants
  out.language = {}
  for (const l of ['russian', 'not-russian', 'without-words', 'any']) {
    out.language[l] = await count(['settingLanguage:' + l])
  }
  // Diversity variants
  out.diversity = {}
  for (const d of ['favorite', 'discover', 'popular', 'default', 'new']) {
    out.diversity[d] = await count(['settingDiversity:' + d])
  }
  // Full combo: mood(2) + energy(E3) + diversity(favorite) + language(russian)
  out.fullCombo = await count([
    'settingMood:M2',
    'settingEnergy:E3',
    'settingDiversity:favorite',
    'settingLanguage:russian',
  ])
  // mood+energy combo
  out.moodEnergyCombo = await count(['settingMoodEnergy:fun', 'settingDiversity:favorite'])
  // genre on onyourwave? try various
  out.genreOnWave = {}
  for (const g of ['genre:rock', 'settingGenre:rock', 'rock']) {
    out.genreOnWave[g] = await count([g])
  }
  return out
})
console.log(JSON.stringify(result, null, 2))
await browser.close()