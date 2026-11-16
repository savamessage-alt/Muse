import { chromium } from 'playwright';

const browser = await chromium.connectOverCDP('http://localhost:9222');
const ctx = browser.contexts()[0];
const p = ctx.pages().find(pg => pg.url().includes('localhost:5173'));
await p.reload();
await p.waitForTimeout(4500);

console.log('URL:', p.url());

const pre = await p.evaluate(() => ({
  hasSettingsBtn: !!document.querySelector('.wave-settings-btn'),
  hasHome: !!document.querySelector('.wave'),
  bodyText: document.body.innerText.slice(0, 120),
}));
console.log('BEFORE:', JSON.stringify(pre));

// click via real Playwright click so React handlers definitely fire
try {
  await p.click('.wave-settings-btn', { timeout: 5000 });
} catch (e) {
  console.log('click error:', String(e).slice(0, 200));
}
await p.waitForTimeout(1500);

const opened = await p.evaluate(() => ({
  hasOverlay: !!document.querySelector('.ws-overlay'),
  hasSheet: !!document.querySelector('.ws-sheet'),
  head: document.querySelector('.ws-head')?.textContent?.slice(0, 60) || '',
}));
console.log('AFTER CLICK:', JSON.stringify(opened, null, 2));

await browser.close();