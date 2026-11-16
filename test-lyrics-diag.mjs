import { chromium } from 'playwright';

const browser = await chromium.connectOverCDP('http://localhost:9222');
const ctx = browser.contexts()[0];
const p = ctx.pages().find(pg => pg.url().includes('localhost:5173'));
await p.reload();
await p.waitForTimeout(4000);

const diag = await p.evaluate(async () => {
  const { signRequest } = await import('/src/core/sign.ts');
  const tok = JSON.parse(localStorage.getItem('ym.oauth'));
  const token = tok.accessToken || tok.access_token || tok.token;
  const headers = {
    Authorization: 'OAuth ' + token,
    'X-Yandex-Music-Client': 'YandexMusicAndroid/24023621',
  };

  const id = '42360427';
  const out = { sign: signRequest(id), attempts: [] };

  for (let i = 0; i < 6; i++) {
    const s = signRequest(id);
    const q = new URLSearchParams({ format: 'TEXT', timeStamp: String(s.timestamp), sign: s.value });
    const url = '/api/tracks/' + id + '/lyrics?' + q.toString();
    const t0 = performance.now();
    const res = await fetch(url, { headers });
    const bodyText = await res.text();
    out.attempts.push({
      i,
      status: res.status,
      ms: Math.round(performance.now() - t0),
      body: bodyText.slice(0, 180),
      signUsed: s.value.slice(0, 18),
    });
    if (res.status === 200) break;
    await new Promise((r) => setTimeout(r, 400));
  }

  // also test via the app client (which does retries + error wrapping)
  try {
    const { ymClient } = await import('/src/core/client.ts');
    const t1 = performance.now();
    const r = await ymClient.trackLyrics(id);
    out.clientOk = true;
    out.clientMs = Math.round(performance.now() - t1);
    out.clientLen = String(r.lyric ?? '').length;
  } catch (e) {
    out.clientOk = false;
    out.clientErr = e && e.message ? e.message : String(e);
    out.clientCode = e && e.code ? e.code : null;
    out.clientName = e && e.name ? e.name : null;
  }

  return out;
});

console.log(JSON.stringify(diag, null, 2));
await browser.close();