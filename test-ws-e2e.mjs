import { chromium } from 'playwright';

const browser = await chromium.connectOverCDP('http://localhost:9222');
const ctx = browser.contexts()[0];
const p = ctx.pages().find(pg => pg.url().includes('localhost:5173'));
await p.reload();
await p.waitForTimeout(4000);

// warm up + play
await p.evaluate(async () => {
  const wave = await import('/src/core/wave.ts');
  const playerMod = await import('/src/core/player.ts');
  const tracks = await wave.fetchWaveTracks([]);
  await playerMod.player.playQueue(tracks.map((t) => ({ track: t, source: 'radio' })), 0, { type: 'genre', tag: 'pop' });
});
await p.waitForTimeout(4000);

// open wave settings with real click
await p.click('.wave-settings-btn', { timeout: 6000 });
await p.waitForTimeout(1200);

const tab1 = await p.evaluate(() => {
  const sheet = document.querySelector('.ws-sheet');
  const head = sheet?.querySelector('.ws-head');
  const close = head?.querySelector('.icon-btn');
  const body = sheet?.querySelector('.ws-body');
  const foot = sheet?.querySelector('.ws-footer');
  const hr = close?.getBoundingClientRect();
  return {
    hasSheet: !!sheet, hasHead: !!head, hasBody: !!body, hasFoot: !!foot,
    sheetH: Math.round(sheet?.getBoundingClientRect().height || 0),
    closeRect: hr ? { top: Math.round(hr.top), bottom: Math.round(hr.bottom), left: Math.round(hr.left), right: Math.round(hr.right) } : null,
    closeVisible: hr ? hr.top >= 0 && hr.bottom <= window.innerHeight && hr.left >= 0 && hr.right <= window.innerWidth : false,
  };
});
console.log('PARAMS TAB:', JSON.stringify(tab1));

// switch to Жанры
const tabs = await p.$$('.ws-tab');
await tabs[1].click();
await p.waitForTimeout(900);

const tab2 = await p.evaluate(() => {
  const sheet = document.querySelector('.ws-sheet');
  const head = sheet?.querySelector('.ws-head');
  const close = head?.querySelector('.icon-btn');
  const body = sheet?.querySelector('.ws-body');
  const hr = close?.getBoundingClientRect();
  return {
    chips: sheet?.querySelectorAll('.ws-chip--genre').length || 0,
    bodyScrollable: body ? body.scrollHeight > body.clientHeight : null,
    closeRect: hr ? { top: Math.round(hr.top), bottom: Math.round(hr.bottom) } : null,
    closeVisible: hr ? hr.top >= 0 && hr.bottom <= window.innerHeight : false,
  };
});
console.log('GENRE TAB:', JSON.stringify(tab2));

// scroll body to bottom
await p.evaluate(() => { const b = document.querySelector('.ws-body'); if (b) b.scrollTop = b.scrollHeight; });
await p.waitForTimeout(700);

const tab3 = await p.evaluate(() => {
  const sheet = document.querySelector('.ws-sheet');
  const head = sheet?.querySelector('.ws-head');
  const close = head?.querySelector('.icon-btn');
  const foot = sheet?.querySelector('.ws-footer');
  const hr = close?.getBoundingClientRect();
  const fr = foot?.getBoundingClientRect();
  return {
    headTop: head ? Math.round(head.getBoundingClientRect().top) : null,
    footTop: fr ? Math.round(fr.top) : null,
    closeRect: hr ? { top: Math.round(hr.top), bottom: Math.round(hr.bottom) } : null,
    closeVisible: hr ? hr.top >= 0 && hr.bottom <= window.innerHeight && hr.left >= 0 && hr.right <= window.innerWidth : false,
  };
});
console.log('AFTER SCROLL:', JSON.stringify(tab3));

await p.screenshot({ path: 'C:/Users/Va_Dar/Desktop/ym-player/wave-genres-final.png' });

// close via X
await p.click('.ws-head .icon-btn', { timeout: 4000 });
await p.waitForTimeout(700);
console.log('closed via X:', await p.evaluate(() => !document.querySelector('.ws-sheet')));

await browser.close();