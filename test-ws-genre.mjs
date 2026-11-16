import { chromium } from 'playwright';

const browser = await chromium.connectOverCDP('http://localhost:9222');
const ctx = browser.contexts()[0];
const p = ctx.pages().find(pg => pg.url().includes('localhost:5173'));
await p.reload();
await p.waitForTimeout(4000);

await p.evaluate(() => document.querySelector('.wave-settings-btn')?.click());
await p.waitForTimeout(1200);

const open = await p.evaluate(() => {
  const sheet = document.querySelector('.ws-sheet');
  const head = sheet?.querySelector('.ws-head');
  const close = head?.querySelector('.icon-btn');
  const body = sheet?.querySelector('.ws-body');
  const foot = sheet?.querySelector('.ws-footer');
  const hr = close?.getBoundingClientRect();
  return {
    hasSheet: !!sheet,
    hasHead: !!head,
    hasBody: !!body,
    hasFoot: !!foot,
    sheetH: sheet ? Math.round(sheet.getBoundingClientRect().height) : null,
    closeRect: hr ? { top: Math.round(hr.top), bottom: Math.round(hr.bottom), left: Math.round(hr.left), right: Math.round(hr.right) } : null,
    vw: window.innerWidth, vh: window.innerHeight,
  };
});
console.log('SETTINGS TAB:', JSON.stringify(open, null, 2));

await p.evaluate(() => {
  [...document.querySelectorAll('.ws-tab')].find((b) => b.textContent.trim() === 'Жанры')?.click();
});
await p.waitForTimeout(900);

const genreTop = await p.evaluate(() => {
  const sheet = document.querySelector('.ws-sheet');
  const head = sheet?.querySelector('.ws-head');
  const close = head?.querySelector('.icon-btn');
  const body = sheet?.querySelector('.ws-body');
  const hr = close?.getBoundingClientRect();
  return {
    chips: sheet?.querySelectorAll('.ws-chip--genre').length || 0,
    bodyScrollable: body ? body.scrollHeight > body.clientHeight : null,
    bodyScrollH: body?.scrollHeight ?? null,
    bodyClientH: body?.clientHeight ?? null,
    closeRect: hr ? { top: Math.round(hr.top), bottom: Math.round(hr.bottom) } : null,
    closeVisible: hr ? hr.top >= 0 && hr.bottom <= window.innerHeight && hr.left >= 0 && hr.right <= window.innerWidth : false,
  };
});
console.log('GENRE TAB:', JSON.stringify(genreTop, null, 2));

// scroll the BODY (not the sheet) to the bottom
await p.evaluate(() => {
  const body = document.querySelector('.ws-body');
  if (body) body.scrollTop = body.scrollHeight;
});
await p.waitForTimeout(700);

const after = await p.evaluate(() => {
  const sheet = document.querySelector('.ws-sheet');
  const head = sheet?.querySelector('.ws-head');
  const close = head?.querySelector('.icon-btn');
  const body = sheet?.querySelector('.ws-body');
  const foot = sheet?.querySelector('.ws-footer');
  const hr = close?.getBoundingClientRect();
  const fr = foot?.getBoundingClientRect();
  return {
    bodyScrollTop: body?.scrollTop,
    headTop: head ? Math.round(head.getBoundingClientRect().top) : null,
    closeRect: hr ? { top: Math.round(hr.top), bottom: Math.round(hr.bottom) } : null,
    footTop: fr ? Math.round(fr.top) : null,
    closeVisible: hr ? hr.top >= 0 && hr.bottom <= window.innerHeight && hr.left >= 0 && hr.right <= window.innerWidth : false,
    vh: window.innerHeight,
  };
});
console.log('AFTER SCROLL BODY:', JSON.stringify(after, null, 2));

// close via X
await p.evaluate(() => document.querySelector('.ws-head .icon-btn')?.dispatchEvent(new MouseEvent('click', { bubbles: true })));
await p.waitForTimeout(600);
console.log('closed:', await p.evaluate(() => !document.querySelector('.ws-sheet')));

await p.screenshot({ path: 'C:/Users/Va_Dar/Desktop/ym-player/wave-genres.png' });
await browser.close();