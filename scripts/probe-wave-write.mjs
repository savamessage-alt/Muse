// Последняя проверка: seed-параметры и жанровые станции
import { chromium } from 'playwright';

const browser = await chromium.connectOverCDP('http://localhost:9222');
const context = browser.contexts()[0];
const page = context.pages().find((p) => p.url().includes('localhost:5173'));
if (!page) { console.log('NO PAGE'); process.exit(1); }

const res = await page.evaluate(async () => {
  const tok = JSON.parse(localStorage.getItem('ym.oauth'));
  const token = tok.accessToken || tok.access_token;
  const H = { Authorization: 'OAuth ' + token, 'X-Yandex-Music-Client': 'YandexMusicAndroid/24023621' };

  const probe = async (label, path) => {
    try {
      const r = await fetch(path, { headers: H });
      const j = await r.json();
      const seq = j?.result?.sequence ?? [];
      const tracks = seq.filter((x) => x.type === 'track').map((x) => x.track);
      const artists = tracks.slice(0, 3).map((t) => (t.artists || []).map((a) => a.name).join(','));
      return { label, status: r.status, n: tracks.length, firstArtists: artists };
    } catch (e) { return { label, status: -1, err: String(e).slice(0, 80) }; }
  };

  const out = [];
  out.push(await probe('seed favorite', '/api/rotor/station/user:onyourwave/tracks?shuffle=true&seed=settingDiversity%3Afavorite'));
  out.push(await probe('seed active', '/api/rotor/station/user:onyourwave/tracks?shuffle=true&seed=settingMoodEnergy%3Aactive'));
  out.push(await probe('genre alternative', '/api/rotor/station/genre:alternative/tracks?shuffle=true'));
  out.push(await probe('genre metal', '/api/rotor/station/genre:metal/tracks?shuffle=true'));
  return out;
});

for (const r of res) {
  console.log(`\n--- ${r.label} → ${r.status} | треков: ${r.n ?? '?'}`);
  if (r.firstArtists) console.log('   артисты: ' + r.firstArtists.join(' | '));
  if (r.err) console.log('   err: ' + r.err);
}
await browser.close();
