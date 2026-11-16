import { chromium } from 'playwright';

const browser = await chromium.connectOverCDP('http://localhost:9222');
const ctx = browser.contexts()[0];
const p = ctx.pages().find(pg => pg.url().includes('localhost:5173'));
await p.reload();
await p.waitForTimeout(3500);

// Check what track is playing
const playerState = await p.evaluate(async () => {
  const { player } = await import('/src/core/player.ts');
  const snap = player.snapshot();
  return { playing: snap.playing, currentId: snap.current?.track.id, currentTitle: snap.current?.track.title, durationMs: snap.durationMs };
});
console.log('PLAYER STATE:', JSON.stringify(playerState));

// Check if current track has lyrics
if (playerState.currentId) {
  const lyricsCheck = await p.evaluate(async (id) => {
    const { ymClient } = await import('/src/core/client.ts');
    try {
      const res = await ymClient.trackLyrics(id);
      return { hasLyrics: true, len: String(res.lyric ?? '').length };
    } catch (e) {
      return { hasLyrics: false, err: String(e) };
    }
  }, playerState.currentId);
  console.log('CURRENT TRACK LYRICS:', JSON.stringify(lyricsCheck));
}

await browser.close();