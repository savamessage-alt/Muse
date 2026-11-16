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
      body = { raw: (await res.text()).slice(0, 300) }
    }
    return { status: res.status, body }
  }
  const out = {}

  // Full raw dashboard structure per type
  const dash = await api('/rotor/stations/dashboard')
  const stations = (dash.body && dash.body.result && dash.body.result.stations) || []
  out.dashStatus = dash.status
  const byType = {}
  for (const s of stations) {
    const id = (s.station && s.station.id) || s.id || {}
    const ty = id.type || 'none'
    byType[ty] = byType[ty] || []
    byType[ty].push({
      tag: (s.station && s.station.id && s.station.id.tag) || (s.id && s.id.tag),
      name: (s.station && s.station.name) || s.name,
      context: s.context || s.station ? (s.context || (s.station && s.station.context)) : null,
      icon: ((s.station && s.station.icon) || s.icon || {}).uri || null,
    })
  }
  out.byType = byType

  // Seed variants to discover valid mood/energy/language/diversity seeds
  const seedVariants = [
    'settingMoodEnergy:fun', 'settingMoodEnergy:active', 'settingMoodEnergy:calm', 'settingMoodEnergy:sad',
    'settingMood:M1', 'settingMood:M2', 'settingMood:M3', 'settingMood:M4',
    'settingEnergy:E1', 'settingEnergy:E2', 'settingEnergy:E3', 'settingEnergy:E4',
    'settingMoodEnergy:calm', 'settingMoodEnergy:active',
  ]
  const seedOk = []
  for (const s of seedVariants) {
    const r = await api('/rotor/station/user:onyourwave/tracks?shuffle=true&seed=' + encodeURIComponent(s))
    const seq = r.body && r.body.result && r.body.result.sequence
    const n = Array.isArray(seq) ? seq.filter((x) => x.type === 'track').length : 0
    if (r.status === 200 && n > 0) seedOk.push(s + '  ->  ' + n)
  }
  out.seedValid = seedOk

  // Genre (genre station from dashboard: alternative) + mood seed + diversity combo
  const genreTags = ['alternative', 'phonkgenre', 'metal']
  const genreCombos = []
  for (const g of genreTags) {
    const r1 = await api('/rotor/station/genre:' + g + '/tracks?shuffle=true&seed=' + encodeURIComponent('settingMoodEnergy:fun'))
    const s1 = r1.body && r1.body.result && r1.body.result.sequence
    genreCombos.push({
      genre: g,
      withMood: Array.isArray(s1) ? s1.filter((x) => x.type === 'track').length : 0,
      status1: r1.status,
      sample: Array.isArray(s1) ? s1.filter((x) => x.type === 'track').map((x) => x.track && x.track.title).slice(0, 2) : null,
    })
  }
  out.genreCombos = genreCombos

  return out
})
console.log(JSON.stringify(result, null, 2))
await browser.close()