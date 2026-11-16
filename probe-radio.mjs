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
  const all = await api('/rotor/stations')
  out.stationsStatus = all.status
  const results = all.body && all.body.result
  if (Array.isArray(results)) {
    const counts = {}
    for (const s of results) {
      const id = (s.station && s.station.id) || s.id || {}
      const ty = id.type || 'none'
      counts[ty] = (counts[ty] || 0) + 1
    }
    out.stationCounts = counts
    const genres = results.filter((s) => {
      const id = (s.station && s.station.id) || s.id || {}
      return id.type === 'genre'
    })
    out.genreFull = genres.map((s) => ({
      tag: (s.station && s.station.id && s.station.id.tag) || (s.id && s.id.tag),
      name: (s.station && s.station.name) || s.name,
    }))
    const moods = results.filter((s) => {
      const id = (s.station && s.station.id) || s.id || {}
      return id.type === 'mood'
    })
    out.moodStations = moods.map((s) => ({
      tag: (s.station && s.station.id && s.station.id.tag) || (s.id && s.id.tag),
      name: (s.station && s.station.name) || s.name,
    }))
  } else {
    out.raw = JSON.stringify(all.body).slice(0, 500)
  }
  const postSettings = await api('/rotor/station/user:onyourwave/settings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ languages: ['russian'], mood: 2, energy: 3, diversity: 'default' }),
  })
  out.postSettingsStatus = postSettings.status
  out.postSettingsBody = JSON.stringify(postSettings.body).slice(0, 400)
  return out
})
console.log(JSON.stringify(result, null, 2))
await browser.close()