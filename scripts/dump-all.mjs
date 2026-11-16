// Дамп реальной структуры всех экранов для спецификации
import { chromium } from 'playwright';

const browser = await chromium.connectOverCDP('http://localhost:9222');
const context = browser.contexts()[0];
const page = context.pages().find((p) => p.url().includes('localhost:5173')) ?? context.pages()[0];
if (!page) { console.log('NO PAGE'); process.exit(1); }

const routes = [
  ['01-home', '/'],
  ['02-search', '/search'],
  ['03-artist', '/artist/13905'],
  ['04-album', '/album/2319819'],
  ['05-radio', '/radio'],
  ['06-favorites', '/likes'],
  ['07-history', '/history'],
  ['08-playlists', '/playlists'],
];

for (const [id, hash] of routes) {
  await page.evaluate((h) => { window.location.hash = h; }, hash).catch(() => {});
  await page.waitForTimeout(4000);
  const info = await page.evaluate(() => {
    const q = (sel) => [...document.querySelectorAll(sel)].map((n) => (n.textContent || '').trim()).filter(Boolean).slice(0, 12);
    return {
      path: location.hash,
      headings: q('h1, h2, .page-title, .entity-title, .section-title').slice(0, 6),
      cards: q('.card-title').slice(0, 6),
      rows: q('.tc-name, .trackrow .tc-name').slice(0, 6),
      playerBar: q('.pb-title, .pb-artist').slice(0, 2),
    };
  });
  console.log(`\n### ${id} ${hash}`);
  console.log(JSON.stringify(info, null, 1));
}

// развёрнутый плеер и очередь
await page.evaluate(() => { window.location.hash = '/'; }).catch(() => {});
await page.waitForTimeout(2000);
const bar = page.locator('.pb-meta, .playerbar .pb-meta').first();
if (await bar.count()) { await bar.click({ timeout: 3000 }).catch(() => {}); await page.waitForTimeout(1500); }
console.log('\n### 09-player (развёрнутый)', JSON.stringify(await page.evaluate(() => ({
  path: location.hash,
  headings: [...document.querySelectorAll('.psheet-title, .psheet-artist, h2, .section-title')].map((n) => (n.textContent || '').trim()).slice(0, 6),
  controls: [...document.querySelectorAll('button')].map((n) => n.getAttribute('title')).filter(Boolean).slice(0, 14),
})), null, 1));
const qb = page.locator('button[title="Очередь"]').first();
if (await qb.count()) { await qb.click({ timeout: 3000 }).catch(() => {}); await page.waitForTimeout(1200); }
console.log('\n### 10-queue (очередь)', JSON.stringify(await page.evaluate(() => ({
  panel: document.querySelector('.queue-panel')?.textContent?.trim().slice(0, 300) ?? 'нет панели',
})), null, 1));

await browser.close();