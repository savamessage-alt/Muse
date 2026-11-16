import { chromium } from 'playwright';

const browser = await chromium.connectOverCDP('http://localhost:9222');
const ctx = browser.contexts()[0];
const p = ctx.pages().find(pg => pg.url().includes('localhost:5173'));
await p.reload();
await p.waitForTimeout(3500);

// Direct API test for current track
const testResult = await p.evaluate(async () => {
  const { signRequest } = await import('/src/core/sign.ts');
  const tok = JSON.parse(localStorage.getItem('ym.oauth'));
  const token = tok.accessToken || tok.access_token || tok.token;
  const headers = {
    Authorization: 'OAuth ' + token,
    'X-Yandex-Music-Client': 'YandexMusicAndroid/24023621',
  };

  // Test track 42360427 which has lyrics
  const attempts = [];
  for (let i = 0; i < 5; i++) {
    const s = signRequest('42360427');
    const q = new URLSearchParams({ format: 'TEXT', timeStamp: String(s.timestamp), sign: s.value });
    try {
      const r = await fetch('/api/tracks/42360427/lyrics?' + q.toString(), { headers });
      const body = await r.text();
      attempts.push({ status: r.status, body: body.slice(0, 200) });
      if (r.status === 200) break;
    } catch (e) {
      attempts.push({ error: String(e) });
    }
    await new Promise(r => setTimeout(r, 300));
  }
  return attempts;
});

console.log('API ATTEMPTS:', JSON.stringify(testResult, null, 2));

await browser.close();