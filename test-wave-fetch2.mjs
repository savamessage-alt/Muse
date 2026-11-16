import { chromium } from 'playwright';

const browser = await chromium.connectOverCDP('http://localhost:9222');
const ctx = browser.contexts()[0];
const p = ctx.pages().find(pg => pg.url().includes('localhost:5173'));
await p.reload();
await p.waitForTimeout(4000);

const res = await p.evaluate(async () => {
  const out = {};
  try {
    const wave = await import('/src/core/wave.ts');
    const seeds = wave.buildSeeds(undefined, undefined, null, undefined);
    out.seeds = seeds;

    const t0 = performance.now();
    const tracks = await wave.fetchWaveTracks(seeds);
    out.ms = Math.round(performance.now() - t0);
    out.isArray = Array.isArray(tracks);
    out.count = Array.isArray(tracks) ? tracks.length : null;
    out.first = Array.isArray(tracks) && tracks[0] ? { id: tracks[0].id, title: tracks[0].title } : null;
    out.error = Array.isArray(tracks) ? null : String(tracks);
  } catch (e) {
    out.fatal = e && e.message ? e.message : String(e);
    out.stack = e && e.stack ? String(e.stack).slice(0, 300) : '';
  }
  return out;
});

console.log(JSON.stringify(res, null, 2));
await browser.close();