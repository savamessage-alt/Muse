import { chromium } from 'playwright';

const browser = await chromium.connectOverCDP('http://localhost:9222');
const ctx = browser.contexts()[0];
const p = ctx.pages().find(pg => pg.url().includes('localhost:5173'));
await p.reload();
await p.waitForTimeout(3500);

// Directly load lyrics for a known-good track through the app's client
const clientTest = await p.evaluate(async () => {
  const { ymClient } = await import('/src/core/client.ts');
  const out = [];
  for (const id of ['42360427', '153570351']) {
    const t0 = performance.now();
    try {
      const res = await ymClient.trackLyrics(id);
      out.push({ id, ok: true, len: String(res.lyric ?? '').length, ms: Math.round(performance.now() - t0) });
    } catch (e) {
      out.push({ id, ok: false, err: String(e.message), ms: Math.round(performance.now() - t0) });
    }
  }
  return out;
});
console.log('CLIENT LYRICS:', JSON.stringify(clientTest, null, 2));

// Now start playback and open the panel through the UI
await p.evaluate(() => document.querySelector('.wave-playbig')?.click());
await p.waitForTimeout(8000);

await p.evaluate(() => {
  document.querySelector('.playerbar')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
});
await p.waitForTimeout(1200);

await p.evaluate(() => {
  [...document.querySelectorAll('.icon-btn')].find((b) => b.title === 'Текст песни')?.click();
});
await p.waitForTimeout(12000);

const panelInfo = await p.evaluate(() => {
  const panel = document.querySelector('.pb-lyrics');
  if (!panel) return { noPanel: true };
  const body = panel.querySelector('.pb-lyrics-body');
  const plain = body?.querySelectorAll('.lyrics-plain-line');
  const state = body?.querySelector('.lyrics-state');
  const loading = body?.querySelector('.lyrics-loading');
  return {
    lines: plain?.length || 0,
    firstLine: plain?.[0]?.textContent || '',
    secondLine: plain?.[1]?.textContent || '',
    hasState: !!state,
    stateText: state?.querySelector('.lyrics-state-text')?.textContent || '',
    hasLoading: !!loading,
    bodyText: body?.innerText.slice(0, 200) || '',
    bodyRect: body ? { w: Math.round(body.getBoundingClientRect().width), h: Math.round(body.getBoundingClientRect().height) } : null,
  };
});
console.log('PANEL:', JSON.stringify(panelInfo, null, 2));

await p.screenshot({ path: 'C:/Users/Va_Dar/Desktop/ym-player/lyrics-check.png' });
await browser.close();