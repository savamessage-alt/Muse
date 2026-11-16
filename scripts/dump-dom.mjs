import { chromium } from 'playwright';

const browser = await chromium.connectOverCDP('http://localhost:9222');
const context = browser.contexts()[0];
const page = context.pages().find((p) => p.url().includes('localhost:5173')) ?? context.pages()[0];
if (!page) { console.log('NO PAGE'); process.exit(1); }

async function dump(hash, label) {
  await page.evaluate((h) => { window.location.hash = h; }, hash).catch(() => {});
  await page.waitForTimeout(2500);
  const info = await page.evaluate(() => ({
    path: location.hash,
    trackrows: document.querySelectorAll('.trackrow').length,
    cards: document.querySelectorAll('.card').length,
    imgs: [...document.querySelectorAll('img')].filter((i) => i.complete && i.naturalWidth > 10).length,
    h1: document.querySelector('h1, .page-title, .entity-title')?.textContent?.trim()?.slice(0, 60) ?? '',
    bodyText: (document.body.innerText || '').slice(0, 200).replace(/\n+/g, ' | '),
  }));
  console.log(`\n=== ${label} ${hash} ===`);
  console.log(JSON.stringify(info, null, 1));
}

await dump('#/home', 'HOME');
await dump('#/search', 'SEARCH');
await dump('#/likes', 'LIKES');
await dump('#/history', 'HISTORY');
await dump('#/playlists', 'PLAYLISTS');

await browser.close();