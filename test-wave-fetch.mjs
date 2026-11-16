import { chromium } from 'playwright';

const browser = await chromium.connectOverCDP('http://localhost:9222');
const ctx = browser.contexts()[0];
const p = ctx.pages().find(pg => pg.url().includes('localhost:5173'));
await p.reload();
await p.waitForTimeout(4000);

const res = await p.evaluate(async () => {
  const out = { steps: [] };
  try {
    const wave = await import('/src/core/wave.ts');
    out.waveExports = Object.keys(wave);
    const client = await import('/src/core/client.ts');
    out.clientExports = Object.keys(client);

    const seeds = wave.buildSeeds ? wave.buildSeeds(undefined, undefined, null, undefined) : [];
    out.seeds = seeds;
    const tracks = await client.ymClient.radioTracks ? await client.ymClient.radioTracks(seeds).catch((e) => 'ERR ' + e.message) : 'no radioTracks';
    out.tracksType = Array.isArray(tracks) ? 'array:' + tracks.length : typeof tracks;
    out.tracksSample = Array.isArray(tracks) ? tracks.slice(0, 2).map((t) => t?.id) : String(tracks).slice(0, 200);
  } catch (e) {
    out.fatal = String(e && e.message ? e.message : e);
  }
  return out;
});

console.log(JSON.stringify(res, null, 2));
await browser.close();