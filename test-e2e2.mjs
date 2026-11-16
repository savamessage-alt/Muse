import { chromium } from 'playwright';

const browser = await chromium.connectOverCDP('http://localhost:9222');
const ctx = browser.contexts()[0];
const p = ctx.pages().find(pg => pg.url().includes('localhost:5173'));
await p.reload();
await p.waitForTimeout(4000);

// warm up wave via direct API, then click the real button
await p.evaluate(async () => {
  const wave = await import('/src/core/wave.ts');
  const playerMod = await import('/src/core/player.ts');
  const tracks = await wave.fetchWaveTracks([]);
  await playerMod.player.playQueue(tracks.map((track) => ({ track, source: 'radio' })), 0, { type: 'genre', tag: 'pop' });
});
await p.waitForTimeout(4000);

const s1 = await p.evaluate(async () => {
  const m = await import('/src/core/player.ts');
  const s = m.player.snapshot();
  return { playing: s.playing, id: s.current?.track.id, pos: Math.round(s.positionMs), dur: Math.round(s.durationMs) };
});
console.log('AFTER WARMUP:', JSON.stringify(s1));

// Now the user clicks the big play button (should restart wave)
await p.evaluate(() => document.querySelector('.wave-playbig')?.click());
await p.waitForTimeout(6000);

const s2 = await p.evaluate(async () => {
  const m = await import('/src/core/player.ts');
  const s = m.player.snapshot();
  const toast = document.querySelector('.toast')?.innerText || '';
  return { playing: s.playing, id: s.current?.track.id, pos: Math.round(s.positionMs), error: s.error, toast };
});
console.log('AFTER PLAYBIG CLICK:', JSON.stringify(s2));

// open lyrics
await p.evaluate(() => document.querySelector('.playerbar')?.dispatchEvent(new MouseEvent('click', { bubbles: true })));
await p.waitForTimeout(1200);
await p.evaluate(() => [...document.querySelectorAll('.icon-btn')].find((b) => b.title === 'Текст песни')?.click());
await p.waitForTimeout(15000);

const panel = await p.evaluate(() => {
  const panel = document.querySelector('.pb-lyrics');
  if (!panel) return { noPanel: true };
  const body = panel.querySelector('.pb-lyrics-body');
  const lines = body?.querySelectorAll('.lyrics-plain-line');
  const st = body?.querySelector('.lyrics-state');
  const ld = body?.querySelector('.lyrics-loading');
  const er = body?.querySelector('.lyrics-error');
  return {
    lines: lines?.length || 0,
    first: lines?.[0]?.textContent || '',
    second: lines?.[1]?.textContent || '',
    hasState: !!st,
    stateText: st?.querySelector('.lyrics-state-text')?.textContent || '',
    hasLoading: !!ld,
    bodyH: Math.round(body?.getBoundingClientRect().height || 0),
    bodyText: body?.innerText.slice(0, 180) || '',
  };
});
console.log('LYRICS PANEL:', JSON.stringify(panel, null, 2));

await p.screenshot({ path: 'C:/Users/Va_Dar/Desktop/ym-player/lyrics-final.png' });
await browser.close();