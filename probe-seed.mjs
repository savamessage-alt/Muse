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

  // Helper to probe seed combos on onyourwave
  const combos = [
    ['mood_fun', 'settingMoodEnergy:fun'],
    ['diversity_favorite', 'settingDiversity:favorite'],
    ['combo1', 'settingMoodEnergy:fun%26settingDiversity:favorite'],
    ['combo2', ['settingMoodEnergy:fun', 'settingDiversity:favorite']],
    ['combo3', 'settingMoodEnergy:fun,settingDiversity:favorite'],
    ['language_ru', 'settingLanguage:russian'],
    ['moodfun_langru', 'settingMoodEnergy:fun%26settingLanguage:russian'],
    ['energy3', 'settingMoodEnergy:energy-third'],
  ]
  const results = []
  for (const [label, seedVal] of combos) {
    const seedStr = Array.isArray(seedVal) ? seedVal.map((s, i) => 'seed=' + encodeURIComponent(s)).join('&') : 'seed=' + encodeURIComponent(seedVal)
    const url = '/rotor/station/user:onyourwave/tracks?shuffle=true&' + seedStr
    const r = await api(url)
    const seq = r.body && r.body.result && r.body.result.sequence
    const tracks = Array.isArray(seq) ? seq.filter((x) => x.type === 'track').length : 0
    results.push({
      label,
      seed: seedStr,
      status: r.status,
      trackCount: tracks,
      error: r.body && r.body.error ? (r.body.error.name + ' ' + r.body.error.message) : null,
      sample: Array.isArray(seq)
        ? (seq.filter((x) => x.type === 'track').map((x) => x.track && x.track.title).slice(0, 3))
        : null,
    })
  }
  out.combos = results

  // Check if batch param improves results
  const batchUrl = '/rotor/station/user:onyourwave/tracks?shuffle=true&batch-size=10&seed=' + encodeURIComponent('settingMoodEnergy:fun%26settingDiversity:favorite')
  const br = await api(batchUrl)
  const bseq = br.body && br.body.result && br.body.result.sequence
  out.batchResult = {
    status: br.status,
    trackCount: Array.isArray(bseq) ? bseq.filter((x) => x.type === 'track').length : 0,
  }
  return out
})
console.log(JSON.stringify(result, null, 2))
await browser.close()