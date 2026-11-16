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
  // Большой набор известных жанровых тегов Яндекс Музыки
  const tags = [
    'rock', 'pop', 'hip-hop', 'electronic', 'classical', 'jazz', 'indie',
    'alternative', 'metal', 'phonkgenre', 'rap', 'rnb', 'reggae', 'punk',
    'blues', 'country', 'folk', 'latin', 'kpop', 'jpop', 'anime',
    'videogame', 'schlager', 'chanson', 'disco', 'funk', 'soul',
    'ambient', 'techno', 'house', 'trance', 'dubstep', 'drumandbass',
    'synthpop', 'postrock', 'grunge', 'hardrock', 'deathmetal', 'blackmetal',
    'progressive', 'newage', 'meditation', 'holiday', 'rocknroll',
    'ska', 'garage', 'shoegaze', 'idm', 'downtempo', 'trip-hop',
    'deephouse', 'techhouse', 'minimal', 'progressive-house', 'edm',
    'bigroom', 'futurehouse', 'hands-up', 'hardstyle', 'hardcore',
    'gabber', 'breakbeat', 'breaks', 'jumpstyle', 'psytrance', 'goa',
    'complextro', 'electro', 'electrohouse', 'electropop', 'futurepop',
    'darkwave', 'ebm', 'industrial', 'aggrotech', 'newwave', 'postpunk',
    'coldwave', 'ethereal', 'gothic', 'goticrock', 'doom', 'sludge',
    'stoner', 'postmetal', 'mathrock', 'noise', 'drone', 'darkambient',
    'tribal', 'world', 'ethnic', 'celtic', 'medieval', 'baroque',
    'romantic', 'impressionism', 'modernclassical', 'minimalism',
    'opera', 'vivaldi', 'bach', 'mozart', 'beethoven', 'chopin',
    'street', 'trap', 'cloudrap', 'driIl', 'mumble', 'ukhiphop',
    'afrobeats', 'amapiano', 'afrohouse', 'dancehall', 'reggaeton',
    'cumbia', 'salsa', 'bachata', 'merengue', 'samba', 'bossa',
    'tango', 'flamenco', 'chillout', 'lofi', 'chillhop', 'lo-fi',
    'sleep', 'study', 'focus', 'workout', 'running', 'gym', 'party',
    'love', 'summer', 'winter', 'retro', 'kids', 'cartoons',
  ]
  const good = []
  const bad = []
  for (const t of tags) {
    const r = await api('/rotor/station/genre:' + t + '/tracks?shuffle=true')
    const seq = r.body && r.body.result && r.body.result.sequence
    const n = Array.isArray(seq) ? seq.filter((x) => x.type === 'track').length : 0
    if (r.status === 200 && n > 0) good.push({ tag: t, n })
    else bad.push(t)
    await new Promise((res) => setTimeout(res, 60))
  }
  return { good, goodCount: good.length, badCount: bad.length, bad }
})
console.log(JSON.stringify(result, null, 2))
await browser.close()