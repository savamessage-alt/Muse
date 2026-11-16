import { chromium } from 'playwright';

const browser = await chromium.connectOverCDP('http://localhost:9222');
const ctx = browser.contexts()[0];
const p = ctx.pages().find(pg => pg.url().includes('localhost:5173'));
await p.reload();
await p.waitForTimeout(4000);

// real user gesture: click somewhere harmless first
await p.mouse.click(250, 300);
await p.waitForTimeout(300);

const res = await p.evaluate(async () => {
  const out = {};
  try {
    const wave = await import('/src/core/wave.ts');
    const playerMod = await import('/src/core/player.ts');
    const tracks = await wave.fetchWaveTracks([]);
    out.count = tracks.length;
    out.firstId = tracks[0]?.id;

    const items = tracks.map((track) => ({ track, source: 'radio' }));
    const ok = await playerMod.player.playQueue(items, 0, { type: 'genre', tag: 'pop' });
    out.playQueueResult = ok;

    await new Promise((r) => setTimeout(r, 4000));
    const snap = playerMod.player.snapshot();
    out.after = {
      playing: snap.playing,
      currentId: snap.current?.track.id || null,
      title: snap.current?.track.title || '',
      durationMs: Math.round(snap.durationMs),
      positionMs: Math.round(snap.positionMs),
      error: snap.error,
    };
  } catch (e) {
    out.fatal = e && e.message ? e.message : String(e);
    out.stack = e && e.stack ? String(e.stack).slice(0, 400) : '';
  }
  return out;
});

console.log(JSON.stringify(res, null, 2));
await browser.close();