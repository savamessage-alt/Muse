import { chromium } from 'playwright';

const browser = await chromium.connectOverCDP('http://localhost:9222');
const ctx = browser.contexts()[0];
const p = ctx.pages().find(pg => pg.url().includes('localhost:5173'));
await p.reload();
await p.waitForTimeout(3500);

await p.evaluate(() => {
  document.querySelector('.wave-playbig')?.click();
});
await p.waitForTimeout(7000);

// Open lyrics panel
await p.evaluate(() => {
  const bar = document.querySelector('.playerbar');
  bar?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
});
await p.waitForTimeout(1200);

await p.evaluate(() => {
  [...document.querySelectorAll('.icon-btn')].find((b) => b.title === 'Текст песни')?.click();
});
await p.waitForTimeout(10000);

// Check the full panel DOM
const panelInfo = await p.evaluate(() => {
  const panel = document.querySelector('.pb-lyrics');
  if (!panel) return { noPanel: true };
  
  const head = panel.querySelector('.pb-lyrics-head');
  const body = panel.querySelector('.pb-lyrics-body');
  
  // Check all possible content in body
  const loading = body?.querySelector('.lyrics-loading');
  const state = body?.querySelector('.lyrics-state');
  const lines = body?.querySelectorAll('.lyrics-text-line');
  
  return {
    hasPanel: true,
    headVisible: !!head,
    headText: head?.querySelector('b')?.innerText || '',
    bodyInnerHTML: body?.innerHTML || '(no body)',
    bodyChildrenCount: body?.children.length || 0,
    hasLoading: !!loading,
    hasState: !!state,
    stateText: state?.querySelector('.lyrics-state-text')?.innerText || '',
    linesCount: lines?.length || 0,
    firstLine: lines?.[0]?.innerText || '',
  };
});

console.log('PANEL INFO:', JSON.stringify(panelInfo, null, 2));

await browser.close();