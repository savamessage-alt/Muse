// Проверка restrictions2 и способа применения настроек «Моей волны»
import { chromium } from 'playwright';

const browser = await chromium.connectOverCDP('http://localhost:9222');
const context = browser.contexts()[0];
const page = context.pages().find((p) => p.url().includes('localhost:5173'));
if (!page) { console.log('NO PAGE'); process.exit(1); }

const res = await page.evaluate(async () => {
  const tok = JSON.parse(localStorage.getItem('ym.oauth'));
  const token = tok.accessToken || tok.access_token;
  const H = { Authorization: 'OAuth ' + token, 'X-Yandex-Music-Client': 'YandexMusicAndroid/24023621' };

  const d = await (await fetch('/api/rotor/stations/dashboard', { headers: H })).json();
  const wave = (d?.result?.stations ?? []).map((s) => s.station ?? s).find((s) => s?.id?.tag === 'onyourwave');

  const out = { restrictions2: wave?.restrictions2 ?? null };

  // Проверяем GET настроек станции
  try {
    const r1 = await fetch('/api/rotor/station/user:onyourwave/settings', { headers: H });
    out.settingsGet = { status: r1.status, body: (await r1.text()).slice(0, 700) };
  } catch (e) { out.settingsGet = { status: -1, body: String(e).slice(0, 150) }; }

  // Проверяем POST feedback с type=settings (как шлёт официальный клиент)
  try {
    const r2 = await fetch('/api/rotor/station/user:onyourwave/feedback', {
      method: 'POST',
      headers: { ...H, 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'settings', timestamp: new Date().toISOString(), settings: { language: 'any', mood: 3, energy: 3, diversity: 'default' } }),
    });
    out.settingsPost = { status: r2.status, body: (await r2.text()).slice(0, 700) };
  } catch (e) { out.settingsPost = { status: -1, body: String(e).slice(0, 150) }; }

  return out;
});

console.log('=== restrictions2 ===');
console.log(JSON.stringify(res.restrictions2, null, 2).slice(0, 1800));
console.log('\n=== GET /settings ===');
console.log(res.settingsGet.status, res.settingsGet.body);
console.log('\n=== POST feedback type=settings ===');
console.log(res.settingsPost.status, res.settingsPost.body);

await browser.close();
