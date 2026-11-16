import { chromium } from 'playwright';

const browser = await chromium.connectOverCDP('http://localhost:9222');
const ctx = browser.contexts()[0];
const p = ctx.pages().find(pg => pg.url().includes('localhost:5173'));
await p.reload();
await p.waitForTimeout(4000);

// real click on hero play
await p.click('.wave-playbig', { timeout: 6000 });
await p.waitForTimeout(10000);

const s1 = await p.evaluate(async () => {
  const mod = await import('/src/core/player.ts');
  const snap = mod.player.snapshot();
  return {
    playing: snap.playing,
    currentId: snap.current?.track.id || null,
    title: snap.current?.track.title || '',
    durationMs: Math.round(snap.durationMs),
    positionMs: Math.round(snap.positionMs),
    queueLen: snap.queue.length,
  };
});
console.log('AFTER PLAY CLICK:', JSON.stringify(s1, null, 2));

// open expanded player
await p.click('.playerbar', { timeout: 5000 }).catch((e) => console.log('playerbar click:', String(e).slice(0, 100)));
await p.waitForTimeout(1500);

const hasBtn = await p.evaluate(() => {
  const b = [...document.querySelectorAll('.icon-btn')].find((x) => x.title === 'Текст песни');
  return { found: !!b, disabled: b ? !!b.disabled : null };
});
console.log('LYRICS BTN:', JSON.stringify(hasBtn));

if (hasBtn.found && !hasBtn.disabled) {
  await p.evaluate(() => {
    [...document.querySelectorAll('.icon-btn')].find((x) => x.title === 'Текст песни')?.click();
  });
  await p.waitForTimeout(15000);

  const panel = await p.evaluate(() => {
    const panel = document.querySelector('.pb-lyrics');
    if (!panel) return { noPanel: true };
    const body = panel.querySelector('.pb-lyrics-body');
    const lines = body?.querySelectorAll('.lyrics-plain-line');
    const st = body?.querySelector('.lyrics-state');
    const ld = body?.querySelector('.lyrics-loading');
    return {
      lines: lines?.length || 0,
      first: lines?.[0]?.textContent || '',
      second: lines?.[1]?.textContent || '',
      hasState: !!st,
      stateText: st?.querySelector('.lyrics-state-text')?.textContent || '',
      hasLoading: !!ld,
      bodyH: Math.round(body?.getBoundingClientRect().height || 0),
    };
  });
  console.log('LYRICS PANEL:', JSON.stringify(panel, null, 2));
}

await p.screenshot({ path: 'C:/Users/Va_Dar/Desktop/ym-player/lyrics-final.png' });
await browser.close();