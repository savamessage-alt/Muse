import { chromium } from 'playwright';

const browser = await chromium.connectOverCDP('http://localhost:9222');
const ctx = browser.contexts()[0];
const p = ctx.pages().find(pg => pg.url().includes('localhost:5173'));
await p.reload();
await p.waitForTimeout(4000);

// open settings with a real click
await p.click('.wave-settings-btn', { timeout: 6000 });
await p.waitForTimeout(1200);

const settings = await p.evaluate(() => {
  const sheet = document.querySelector('.ws-sheet');
  const head = sheet?.querySelector('.ws-head');
  const close = head?.querySelector('.icon-btn');
  const body = sheet?.querySelector('.ws-body');
  const foot = sheet?.querySelector('.ws-footer');
  const hr = close?.getBoundingClientRect();
  const sr = sheet?.getBoundingClientRect();
  return {
    hasSheet: !!sheet,
    hasHead: !!head,
    hasBody: !!body,
    hasFoot: !!foot,
    sheetH: Math.round(sr?.height || 0),
    closeRect: hr ? { top: Math.round(hr.top), bottom: Math.round(hr.bottom), left: Math.round(hr.left), right: Math.round(hr.right) } : null,
    vw: window.innerWidth,
    vh: window.innerHeight,
  };
});
console.log('PARAMS TAB:', JSON.stringify(settings, null, 2));

// switch to Жанры via real click
const tabs = await p.$$('.ws-tab');
await tabs[1].click();
await p.waitForTimeout(900);

const genre = await p.evaluate(() => {
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
    sheetScrollable: sheet ? sheet.scrollHeight > sheet.clientHeight : null,
    closeRect: hr ? { top: Math.round(hr.top), bottom: Math.round(hr.bottom) } : null,
    closeVisible: hr ? hr.top >= 0 && hr.bottom <= window.innerHeight : false,
  };
});
console.log('GENRE TAB:', JSON.stringify(genre, null, 2));

// scroll body to bottom
await p.evaluate(() => {
  const body = document.querySelector('.ws-body');
  if (body) body.scrollTop = body.scrollHeight;
});
await p.waitForTimeout(700);

const scrolled = await p.evaluate(() => {
  const sheet = document.querySelector('.ws-sheet');
  const head = sheet?.querySelector('.ws-head');
  const close = head?.querySelector('.icon-btn');
  const foot = sheet?.querySelector('.ws-footer');
  const body = sheet?.querySelector('.ws-body');
  const hr = close?.getBoundingClientRect();
  const fr = foot?.getBoundingClientRect();
  return {
    bodyScrollTop: body?.scrollTop,
    headTop: head ? Math.round(head.getBoundingClientRect().top) : null,
    footTop: fr ? Math.round(fr.top) : null,
    closeRect: hr ? { top: Math.round(hr.top), bottom: Math.round(hr.bottom) } : null,
    closeVisible: hr ? hr.top >= 0 && hr.bottom <= window.innerHeight && hr.left >= 0 && hr.right <= window.innerWidth : false,
    vh: window.innerHeight,
  };
});
console.log('AFTER SCROLL:', JSON.stringify(scrolled, null, 2));

await p.screenshot({ path: 'C:/Users/Va_Dar/Desktop/ym-player/wave-genres.png' });

// close via X
await p.click('.ws-head .icon-btn', { timeout: 4000 });
await p.waitForTimeout(700);
console.log('closed via X:', await p.evaluate(() => !document.querySelector('.ws-sheet')));

await browser.close();