import { chromium } from 'playwright';

const browser = await chromium.connectOverCDP('http://localhost:9222');
const ctx = browser.contexts()[0];
const p = ctx.pages().find(pg => pg.url().includes('localhost:5173'));
await p.reload();
await p.waitForTimeout(3500);

// Try to play track 42360427 which has lyrics
await p.evaluate(async () => {
  const { ymClient } = await import('/src/core/client.ts');
  const { player } = await import('/src/core/player.ts');
  // Search for the track or just try to play it directly
  try {
    const track = await ymClient.trackInfo('42360427');
    console.log('Track info:', JSON.stringify(track?.track?.title || track?.title || 'unknown'));
  } catch (e) {
    console.log('trackInfo error:', String(e));
  }
  
  // Try to play via playQueue
  try {
    await player.playQueue([{ id: '42360427' }], 0, false);
    console.log('playQueue called');
  } catch (e) {
    console.log('playQueue error:', String(e));
  }
});
await p.waitForTimeout(5000);

// Check player state
const playerState = await p.evaluate(async () => {
  const { player } = await import('/src/core/player.ts');
  const snap = player.snapshot();
  return { playing: snap.playing, currentId: snap.current?.track.id, durationMs: snap.durationMs };
});
console.log('PLAYER:', JSON.stringify(playerState));

// Open lyrics panel
await p.evaluate(() => {
  const bar = document.querySelector('.playerbar');
  bar?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
});
await p.waitForTimeout(1200);

await p.evaluate(() => {
  [...document.querySelectorAll('.icon-btn')].find((b) => b.title === 'Текст песни')?.click();
});
await p.waitForTimeout(10000);

const panelInfo = await p.evaluate(() => {
  const panel = document.querySelector('.pb-lyrics');
  if (!panel) return { noPanel: true };
  const body = panel.querySelector('.pb-lyrics-body');
  const lines = body?.querySelectorAll('.lyrics-text-line');
  const state = body?.querySelector('.lyrics-state');
  const loading = body?.querySelector('.lyrics-loading');
  return {
    linesCount: lines?.length || 0,
    firstLine: lines?.[0]?.innerText || '',
    secondLine: lines?.[1]?.innerText || '',
    hasState: !!state,
    stateText: state?.querySelector('.lyrics-state-text')?.innerText || '',
    hasLoading: !!loading,
    bodyTextLength: body?.innerText.length || 0,
  };
});
console.log('PANEL:', JSON.stringify(panelInfo, null, 2));

await browser.close();