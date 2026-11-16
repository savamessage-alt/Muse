import { chromium } from 'playwright';

const browser = await chromium.connectOverCDP('http://localhost:9222');
const ctx = browser.contexts()[0];
const p = ctx.pages().find(pg => pg.url().includes('localhost:5173'));
await p.reload();
await p.waitForTimeout(3500);

// Check current playing track
const playerState = await p.evaluate(async () => {
  const { player } = await import('/src/core/player.ts');
  const snap = player.snapshot();
  return { playing: snap.playing, currentId: snap.current?.track.id, currentTitle: snap.current?.track.title, durationMs: snap.durationMs };
});
console.log('CURRENT PLAYER:', JSON.stringify(playerState));

// Check if current track has lyrics via API
if (playerState.currentId) {
  const lyricsResult = await p.evaluate(async (trackId) => {
    const { ymClient } = await import('/src/core/client.ts');
    try {
      const res = await ymClient.trackLyrics(trackId);
      return { ok: true, len: String(res.lyric ?? '').length };
    } catch (e) {
      return { ok: false, err: String(e) };
    }
  }, playerState.currentId);
  console.log('CURRENT TRACK LYRICS:', JSON.stringify(lyricsResult));
}

// Test track 42360427 which definitely has lyrics
const lyrics423 = await p.evaluate(async () => {
  const { ymClient } = await import('/src/core/client.ts');
  try {
    const res = await ymClient.trackLyrics('42360427');
    return { ok: true, len: String(res.lyric ?? '').length, first: String(res.lyric ?? '').slice(0, 60) };
  } catch (e) {
    return { ok: false, err: String(e) };
  }
});
console.log('TRACK 42360427 LYRICS:', JSON.stringify(lyrics423));

await browser.close();