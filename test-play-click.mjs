import { chromium } from 'playwright';

const browser = await chromium.connectOverCDP('http://localhost:9222');
const ctx = browser.contexts()[0];
const p = ctx.pages().find(pg => pg.url().includes('localhost:5173'));
await p.reload();
await p.waitForTimeout(4000);

const pre = await p.evaluate(async () => {
  const mod = await import('/src/core/player.ts');
  const snap = mod.player.snapshot();
  return {
    audio: mod.player.audio ? { src: String(mod.player.audio.src).slice(0, 60), paused: mod.player.audio.paused } : 'no audio prop',
    playing: snap.playing,
    queueLen: snap.queue.length,
    currentId: snap.current?.track.id || null,
  };
});
console.log('PRE-CLICK:', JSON.stringify(pre, null, 2));

const box = await p.evaluate(() => {
  const b = document.querySelector('.wave-playbig');
  if (!b) return null;
  const r = b.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width, h: r.height, disabled: !!b.disabled };
});
console.log('BTN BOX:', JSON.stringify(box));

if (box) {
  await p.mouse.click(box.x, box.y);
  await p.waitForTimeout(12000);
}

const post = await p.evaluate(async () => {
  const mod = await import('/src/core/player.ts');
  const snap = mod.player.snapshot();
  const toast = document.querySelector('.toast')?.innerText || '';
  return {
    playing: snap.playing,
    currentId: snap.current?.track.id || null,
    title: snap.current?.track.title || '',
    queueLen: snap.queue.length,
    durationMs: Math.round(snap.durationMs),
    toast,
    wavePlayBtnDisabled: !!document.querySelector('.wave-playbig')?.disabled,
  };
});
console.log('POST-CLICK:', JSON.stringify(post, null, 2));

await browser.close();