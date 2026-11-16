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
  // Атмосферные/ситуационные станции (типы кроме genre/user)
  const typesAndTags = {
    rest: ['rest', 'afterparty', 'mood', 'party', 'focus', 'sleep', 'sport', 'kids', 'career', 'travel', 'study', 'work'],
    activity: ['rest', 'newyear', 'summer', 'winter'],
  }
  const results = {}
  for (const [ty, tags] of Object.entries(typesAndTags)) {
    for (const t of tags) {
      const r = await api('/rotor/station/' + ty + ':' + t + '/tracks?shuffle=true')
      const seq = r.body && r.body.result && r.body.result.sequence
      const n = Array.isArray(seq) ? seq.filter((x) => x.type === 'track').length : 0
      if (r.status === 200 && n > 0) results[ty + ':' + t] = n
    }
  }
  // Проверить системные волновые станции: user:memorywave, user:general, moodwave
  for (const t of ['memorywave', 'general', 'wave']) {
    const r = await api('/rotor/station/user:' + t + '/tracks?shuffle=true')
    const seq = r.body && r.body.result && r.body.result.sequence
    const n = Array.isArray(seq) ? seq.filter((x) => x.type === 'track').length : 0
    if (r.status === 200 && n > 0) results['user:' + t] = n
  }
  return results
})
console.log(JSON.stringify(result, null, 2))
await browser.close()