// Точечный фикс: создать плейлист и переснять 08-playlists
import { chromium } from 'playwright';
import { writeFile } from 'node:fs/promises';

const browser = await chromium.connectOverCDP('http://localhost:9222');
const context = browser.contexts()[0];
const page = context.pages().find((p) => p.url().includes('localhost:5173')) ?? context.pages()[0];
if (!page) { console.log('NO PAGE'); process.exit(1); }
const cdp = await context.newCDPSession(page);
const log = (m) => console.log(m);

const nav = async (h) => { await page.evaluate((x) => { window.location.hash = x; }, h).catch(() => {}); await page.waitForTimeout(1000); };
const fonts = async () => { await page.evaluate(() => document.fonts?.ready?.catch?.(() => {})).catch(() => {}); await page.waitForTimeout(300); };

await nav('/playlists');
await page.waitForTimeout(1500);

let cards = await page.evaluate(() => document.querySelectorAll('.card').length).catch(() => 0);
log('Карточек до: ' + cards);

if (cards === 0) {
  // клик по кнопке-переключателю
  await page.evaluate(() => {
    const btns = [...document.querySelectorAll('button')];
    const b = btns.find((x) => (x.textContent || '').includes('Создать плейлист'));
    if (b) b.click();
    return !!b;
  });
  await page.waitForTimeout(900);

  // ввод названия
  await page.evaluate(() => {
    const el = document.querySelector('input');
    if (!el) return false;
    el.focus();
    return true;
  });
  await cdp.send('Input.insertText', { text: 'Любимое · Muse' });
  await page.waitForTimeout(500);

  // сабмит — кнопка внутри .create-box
  const clicked = await page.evaluate(() => {
    const box = document.querySelector('.create-box');
    if (!box) return false;
    const btns = [...box.querySelectorAll('button')];
    const b = btns.find((x) => (x.textContent || '').trim() === 'Создать');
    if (b) { b.click(); return true; }
    return false;
  });
  log('Сабмит клик: ' + clicked);
  await page.waitForTimeout(2500);
}

// ждём карточку
const t0 = Date.now();
while (Date.now() - t0 < 15000) {
  cards = await page.evaluate(() => document.querySelectorAll('.card').length).catch(() => 0);
  if (cards > 0) break;
  await page.waitForTimeout(500);
}
log('Карточек после: ' + cards);

// перезагружаем страницу, чтобы список подтянулся с сервера
await page.reload({ waitUntil: 'domcontentloaded' }).catch(() => {});
await page.waitForTimeout(3500);
await nav('/playlists');
await page.waitForTimeout(2500);

await fonts();
await page.evaluate(() => window.scrollTo(0, 0)).catch(() => {});
await page.waitForTimeout(300);
const { data } = await cdp.send('Page.captureScreenshot', { format: 'png', fromSurface: true });
await writeFile('store/rustore/real/08-playlists.png', Buffer.from(data, 'base64'));
log('✅ 08-playlists.png переснят');

await browser.close();