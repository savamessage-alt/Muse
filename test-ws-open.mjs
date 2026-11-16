import { chromium } from 'playwright';

const browser = await chromium.connectOverCDP('http://localhost:9222');
const ctx = browser.contexts()[0];
const p = ctx.pages().find(pg => pg.url().includes('localhost:5173'));
await p.reload();
await p.waitForTimeout(4000);

await p.screenshot({ path: 'C:/Users/Va_Dar/Desktop/ym-player/step1-home.png' });

const info = await p.evaluate(() => {
  const btn = document.querySelector('.wave-settings-btn');
  const label = document.querySelector('.wave-label');
  return {
    hasSettingsBtn: !!btn,
    labelText: label?.textContent?.slice(0, 80) || '',
    bodyClasses: document.body.className,
  };
});
console.log('HOME:', JSON.stringify(info, null, 2));

await p.evaluate(() => document.querySelector('.wave-settings-btn')?.click());
await p.waitForTimeout(1500);

const opened = await p.evaluate(() => {
  const sheet = document.querySelector('.ws-sheet');
  return {
    hasSheet: !!sheet,
    headText: sheet?.querySelector('.ws-head')?.textContent || '',
    tabs: [...document.querySelectorAll('.ws-tab')].map((b) => b.textContent.trim()),
  };
});
console.log('OPENED:', JSON.stringify(opened, null, 2));

await p.screenshot({ path: 'C:/Users/Va_Dar/Desktop/ym-player/step2-settings.png' });

await browser.close();