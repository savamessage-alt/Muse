import { chromium } from "playwright";
const browser = await chromium.connectOverCDP("http://localhost:9222");
const context = browser.contexts()[0];
const page = context.pages().find((p) => p.url().includes("localhost:5173"));
if (!page) { console.log("NO PAGE"); process.exit(1); }
const res = await page.evaluate(async () => {
  const tok = JSON.parse(localStorage.getItem("ym.oauth"));
  const token = tok.accessToken || tok.access_token;
  const H = { Authorization: "OAuth " + token, "X-Yandex-Music-Client": "YandexMusicAndroid/24023621" };
  const g = async (path) => { const r = await fetch("/api" + path, { headers: H }); return { status: r.status, json: await r.json().catch(() => null) }; };
  const str = (v) => (typeof v === "string" ? v.slice(0, 400) : v == null ? null : JSON.stringify(v).slice(0, 400));
  const out = {};
  const brief = await g("/artists/13905/brief-info");
  out.briefStatus = brief.status;
  const r = brief.json?.result ?? {};
  out.briefKeys = Object.keys(r);
  out.artistKeys = r.artist ? Object.keys(r.artist) : [];
  out.artist = {
    description: str(r.artist?.description),
    shortDescription: str(r.artist?.shortDescription),
    genres: r.artist?.genres,
    vanityUrls: r.artist?.vanityUrls,
    link: r.artist?.link,
    likesCount: r.artist?.likesCount,
    counts: r.artist?.counts,
  };
  out.alsoTracks = (r.alsoTracks ?? []).length;
  out.albums = (r.albums ?? []).length;
  out.similar = (r.similarArtists ?? []).length;
  out.playlists = (r.playlists ?? []).length;
  const tr = await g("/artists/13905/tracks?page=0&pageSize=50");
  out.tracksStatus = tr.status;
  out.tracksCount = (tr.json?.result?.tracks?.items ?? r.tracks ?? []).length;
  const al = await g("/artists/13905/direct-albums?page=0&pageSize=50");
  out.albumsStatus = al.status;
  out.albumsCount = (al.json?.result?.albums?.items ?? []).length;
  return out;
});
console.log(JSON.stringify(res, null, 2));
await browser.close();
