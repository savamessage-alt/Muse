import { chromium } from 'playwright';

const browser = await chromium.connectOverCDP('http://localhost:9222');
const ctx = browser.contexts()[0];
const p = ctx.pages().find(pg => pg.url().includes('localhost:5173'));
await p.reload();
await p.waitForTimeout(3500);

// wave: open settings
await p.evaluate(() => [...document.querySelectorAll('.wave-settings-btn')][0]?.click());
await p.waitForTimeout(1500);

// switch to Жанры tab
await p.evaluate(() => {
  [...document.querySelectorAll('.ws-tab')].find((b) => b.textContent.trim() === 'Жанры')?.click();
});
await p.waitForTimeout(800);

const before = await p.evaluate(() => {
  const sheet = document.querySelector('.ws-sheet');
  const head = sheet?.querySelector('.ws-head');
  const close = head?.querySelector('.icon-btn');
  const r = close?.getBoundingClientRect();
  return {
    scrollTop: sheet?.scrollTop,
    headRect: head ? { top: Math.round(head.getBoundingClientRect().top), bottom: Math.round(head.getBoundingClientRect().bottom) } : null,
    closeRect: r ? { left: Math.round(r.left), top: Math.round(r.top), right: Math.round(r.right), bottom: Math.round(r.bottom) } : null,
    vw: window.innerWidth,
    vh: window.innerHeight,
  };
});

// scroll the sheet to the bottom to stress the sticky header
await p.evaluate(() => {
  const sheet = document.querySelector('.ws-sheet');
  if (sheet) sheet.scrollTop = sheet.scrollHeight;
});
await p.waitForTimeout(600);

const after = await p.evaluate(() => {
  const sheet = document.querySelector('.ws-sheet');
  const head = sheet?.querySelector('.ws-head');
  const close = head?.querySelector('.icon-btn');
  const r = close?.getBoundingClientRect();
  const sr = sheet?.getBoundingClientRect();
  return {
    scrollTop: sheet?.scrollTop,
    headTop: head ? Math.round(head.getBoundingClientRect().top) : null,
    sheetTop: sr ? Math.round(sr.top) : null,
    closeRect: r ? { left: Math.round(r.left), top: Math.round(r.top), right: Math.round(r.right), bottom: Math.round(r.bottom) } : null,
    vw: window.innerWidth,
    vh: window.innerHeight,
    closeVisible: r ? r.left >= 0 && r.top >= 0 && r.right <= window.innerWidth && r.bottom <= window.innerHeight : false,
  };
});

console.log('GENRE TAB (top):', JSON.stringify(before, null, 2));
console.log('GENRE TAB (scrolled):', JSON.stringify(after, null, 2));

// click the close X and confirm the sheet closes
await p.evaluate(() => {
  document.querySelector('.ws-head .icon-btn')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
});
await p.waitForTimeout(600);
const closed = await p.evaluate(() => !document.querySelector('.ws-sheet'));
console.log('closed after X click:', closed);

await browser.close();