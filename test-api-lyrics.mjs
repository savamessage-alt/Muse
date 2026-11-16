import { chromium } from 'playwright';

const browser = await chromium.connectOverCDP('http://localhost:9222');
const ctx = browser.contexts()[0];
const p = ctx.pages().find(pg => pg.url().includes('localhost:5173'));
await p.reload();
await p.waitForTimeout(3500);

// Try to load lyrics directly via API for track 42360427
const apiResult = await p.evaluate(async () => {
  const { ymClient } = await import('/src/core/client.ts');
  try {
    const res = await ymClient.trackLyrics('42360427');
    return { ok: true, len: String(res.lyric ?? '').length, first: String(res.lyric ?? '').slice(0, 80) };
  } catch (e) {
    return { ok: false, err: String(e) };
  }
});

console.log('API LYRICS:', JSON.stringify(apiResult, null, 2));

await browser.close();