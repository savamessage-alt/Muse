import { chromium } from 'playwright';

const browser = await chromium.connectOverCDP('http://localhost:9222');
const context = browser.contexts()[0];
const page = context.pages().find((p) => p.url().includes('localhost:5173')) ?? context.pages()[0];
if (!page) { console.log('NO PAGE'); process.exit(1); }
const info = await page.evaluate(() => ({
  innerWidth: window.innerWidth,
  innerHeight: window.innerHeight,
  dpr: window.devicePixelRatio,
  screen: { w: screen.width, h: screen.height },
  scrollY: window.scrollY,
}));
console.log(JSON.stringify(info, null, 2));
await browser.close();