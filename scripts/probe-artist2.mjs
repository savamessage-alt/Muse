import { chromium } from "playwright";
const browser = await chromium.connectOverCDP("http://localhost:9222");
const context = browser.contexts()[0];
const page = context.pages().find((p) => p.url().includes("localhost:5173"));
if (!page) { console.log("NO PAGE"); process.exit(1); }
const res = await page.evaluate(async () => {
  const tok = JSON.parse(localStorage.getItem("ym.oauth"));
  const token = tok.accessToken || tok.access_token;
  const H = { Authorization: "OAuth " + token, "X-Yandex-Music-Client": "YandexMusicAndroid/24023621" };
  const r = await fetch("/api/artists/13905/brief-info", { headers: H });
  const j = await r.json();
  const d = j?.result ?? {};
  const pt = d.popularTracks ?? [];
  const rel = d.lastReleases ?? [];
  return {
    popularType: Array.isArray(pt) ? "array" : typeof pt,
    popularCount: pt.length,
    firstPopular: pt[0] ? { keys: Object.keys(pt[0]), title: pt[0].title, id: pt[0].id } : null,
    links: d.links,
    artistLinks: d.artist?.links,
    lastReleasesCount: rel.length,
    firstRelease: rel[0] ? { keys: Object.keys(rel[0]), title: rel[0].title, id: rel[0].id } : null,
    stats: d.stats,
    concerts: (d.concerts ?? []).length,
    videos: (d.videos ?? []).length,
    clips: (d.clips ?? []).length,
    customWave: d.customWave,
    playlistIds: d.playlistIds?.length ?? 0,
    playlists: (d.playlists ?? []).map(p => ({ kind: p.kind, title: p.title, uid: p.owner?.uid })),
    albumsCount: (d.albums ?? []).length,
    alsoAlbumsCount: (d.alsoAlbums ?? []).length,
  };
});
console.log(JSON.stringify(res, null, 2));
await browser.close();
