import { chromium } from 'playwright';

const browser = await chromium.connectOverCDP('http://localhost:9222');
const ctx = browser.contexts()[0];
const p = ctx.pages().find(pg => pg.url().includes('localhost:5173'));
await p.reload();
await p.waitForTimeout(4000);

// start playback so a current track exists
await p.click('.wave-playbig', { timeout: 6000 }).catch((e) => console.log('play click err:', String(e).slice(0, 120)));
await p.waitForTimeout(9000);

const state = await p.evaluate(async () => {
  const mod = await import('/src/core/player.ts');
  const snap = mod.player.snapshot();
  return {
    playing: snap.playing,
    currentId: snap.current?.track.id || null,
    title: snap.current?.track.title || '',
    durationMs: Math.round(snap.durationMs),
  };
});
console.log('PLAYER:', JSON.stringify(state));

// open expanded player, then lyrics
await p.click('.playerbar', { timeout: 5000 }).catch(() => {});
await p.waitForTimeout(1200);
const btn = await p.$('.icon-btn[title="Текст песни"]');
if (btn) await btn.click();
else console.log('lyrics button not found');
await p.waitForTimeout(14000);

const panel = await p.evaluate(() => {
  const panel = document.querySelector('.pb-lyrics');
  if (!panel) return { noPanel: true };
  const body = panel.querySelector('.pb-lyrics-body');
  const lines = body?.querySelectorAll('.lyrics-plain-line');
  const stateEl = body?.querySelector('.lyrics-state');
  const loading = body?.querySelector('.lyrics-loading');
  return {
    lines: lines?.length || 0,
    first: lines?.[0]?.textContent || '',
    second: lines?.[1]?.textContent || '',
    hasState: !!stateEl,
    stateText: stateEl?.querySelector('.lyrics-state-text')?.textContent || '',
    hasLoading: !!loading,
    bodyText: body?.innerText.slice(0, 160) || '',
    bodyH: Math.round(body?.getBoundingClientRect().height || 0),
  };
});
console.log('LYRICS PANEL:', JSON.stringify(panel, null, 2));

await p.screenshot({ path: 'C:/Users/Va_Dar/Desktop/ym-player/lyrics-check.png' });
await browser.close();