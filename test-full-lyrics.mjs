import { chromium } from 'playwright';

const browser = await chromium.connectOverCDP('http://localhost:9222');
const ctx = browser.contexts()[0];
const p = ctx.pages().find(pg => pg.url().includes('localhost:5173'));
await p.reload();
await p.waitForTimeout(3500);

// Play a track
await p.evaluate(() => {
  document.querySelector('.wave-playbig')?.click();
});
await p.waitForTimeout(8000);

// Check player state
const playerState = await p.evaluate(async () => {
  const { player } = await import('/src/core/player.ts');
  const snap = player.snapshot();
  return { playing: snap.playing, currentId: snap.current?.track.id, currentTitle: snap.current?.track.title, durationMs: snap.durationMs };
});
console.log('PLAYER STATE:', JSON.stringify(playerState));

if (playerState.currentId) {
  const lyricsCheck = await p.evaluate(async (id) => {
    const { ymClient } = await import('/src/core/client.ts');
    try {
      const res = await ymClient.trackLyrics(id);
      return { hasLyrics: true, len: String(res.lyric ?? '').length, preview: String(res.lyric ?? '').slice(0, 50) };
    } catch (e) {
      return { hasLyrics: false, err: String(e) };
    }
  }, playerState.currentId);
  console.log('LYRICS CHECK:', JSON.stringify(lyricsCheck));
}

// Open lyrics panel
await p.evaluate(() => {
  const bar = document.querySelector('.playerbar');
  bar?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
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
  const lines = body?.querySelectorAll('.lyrics-text-line');
  const state = body?.querySelector('.lyrics-state');
  const loading = body?.querySelector('.lyrics-loading');
  const error = body?.querySelector('.lyrics-error');
  return {
    linesCount: lines?.length || 0,
    firstLine: lines?.[0]?.innerText || '',
    secondLine: lines?.[1]?.innerText || '',
    hasState: !!state,
    stateText: state?.querySelector('.lyrics-state-text')?.innerText || '',
    hasLoading: !!loading,
    bodyInnerText: body?.innerText || '',
  };
});
console.log('PANEL:', JSON.stringify(panelInfo, null, 2));

await browser.close();