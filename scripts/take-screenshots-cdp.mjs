#!/usr/bin/env node
// Реальные скриншоты всех экранов. Размер окна НЕ меняем — как открыт браузер.
import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';

const CDP_URL = 'http://localhost:9222';
const OUT_DIR = 'store/rustore/real';
const SEARCH_QUERY = 'Daft Punk';

const log = (m) => console.log(m);

async function fontsReady(page) {
  await page.evaluate(() => document.fonts?.ready?.catch?.(() => {})).catch(() => {});
  await page.waitForTimeout(300);
}

async function shoot(page, cdp, id) {
  await fontsReady(page);
  await page.evaluate(() => window.scrollTo(0, 0)).catch(() => {});
  await page.waitForTimeout(300);
  const { data } = await cdp.send('Page.captureScreenshot', { format: 'png', fromSurface: true });
  await writeFile(`${OUT_DIR}/${id}.png`, Buffer.from(data, 'base64'));
  log(`   ✅ ${id}.png`);
}

async function nav(page, hash) {
  await page.evaluate((h) => { window.location.hash = h; }, hash).catch(() => {});
  await page.waitForTimeout(900);
}

async function waitCount(page, sel, min = 1, timeout = 25000) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    const n = await page.locator(sel).count();
    if (n >= min) return n;
    await page.waitForTimeout(300);
  }
  return await page.locator(sel).count();
}

async function typeViaKeys(page, cdp, selector, text) {
  const focused = await page.evaluate((sel) => {
    const el = document.querySelector(sel);
    if (!el) return false;
    el.focus();
    return document.activeElement === el;
  }, selector).catch(() => false);
  if (!focused) return false;
  await cdp.send('Input.insertText', { text });
  await page.waitForTimeout(300);
  return true;
}

async function playerState(page) {
  try {
    return await page.evaluate(() => {
      const p = window.__player;
      if (!p) return 'no-__player';
      const s = p.snapshot();
      return JSON.stringify({ playing: s.playing, title: s.current?.track?.title, index: s.index, q: s.queue?.length });
    });
  } catch { return 'eval-fail'; }
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true });
  log('🔌 Подключение к Chrome...');
  const browser = await chromium.connectOverCDP(CDP_URL);
  const context = browser.contexts()[0];
  const page = context.pages().find((p) => p.url().includes('localhost:5173')) ?? context.pages()[0];
  if (!page) { log('❌ Вкладка не найдена'); await browser.close(); return; }
  log(`✅ Вкладка: ${page.url()}`);

  const cdp = await context.newCDPSession(page);
  const vp = await page.evaluate(() => ({ w: innerWidth, h: innerHeight, dpr: devicePixelRatio }));
  log(`📱 Окно: ${vp.w}x${vp.h} CSS, DPR ${vp.dpr} → PNG ${Math.round(vp.w * vp.dpr)}x${Math.round(vp.h * vp.dpr)} px`);

  // ===== 1. ГЛАВНАЯ: включаем музыку =====
  log('\n▶ 01 — Главная: включаю «Мою волну»');
  await nav(page, '/');
  await page.waitForTimeout(2500);
  const before = await playerState(page);
  log(`   До: ${before}`);
  const playBig = page.locator('.wave-playbig').first();
  if (await playBig.count()) {
    await playBig.click({ timeout: 4000 }).catch(() => {});
    await page.waitForTimeout(6000);
  }
  const after = await playerState(page);
  log(`   После: ${after}`);
  if (!after.includes('"playing":true')) {
    const disc = page.locator('.wave-disc').first();
    if (await disc.count()) { await disc.click({ timeout: 4000 }).catch(() => {}); await page.waitForTimeout(5000); }
    log(`   Fallback: ${await playerState(page)}`);
  }
  await shoot(page, cdp, '01-home');

  // ===== 2. ПОИСК =====
  log('\n🔍 02 — Поиск: "' + SEARCH_QUERY + '"');
  await nav(page, '/search');
  await page.waitForTimeout(1200);
  await typeViaKeys(page, cdp, '.search-input', SEARCH_QUERY);
  const nTracks = await waitCount(page, '.trackrow', 1, 20000);
  log(`   Результатов-строк: ${nTracks}`);
  await page.waitForTimeout(1500);
  await shoot(page, cdp, '02-search');

  // ===== 3. АРТИСТ =====
  log('\n🎤 03 — Артист');
  const artTab = page.locator('.tab', { hasText: 'Артисты' }).first();
  if (await artTab.count()) await artTab.click({ timeout: 4000 }).catch(() => {});
  await page.waitForTimeout(2500);
  const artistHref = await page.evaluate(() => {
    const a = document.querySelector('a[href*="/artist/"]');
    return a ? a.getAttribute('href') : null;
  }).catch(() => null);
  if (artistHref) {
    log(`   ➡ ${artistHref}`);
    await nav(page, artistHref.replace(/^#/, ''));
    await waitCount(page, '.entity-title', 1, 12000);
    await page.waitForTimeout(1500);
  } else log('   ⚠️ Артист не найден');
  await shoot(page, cdp, '03-artist');

  // ===== 4. АЛЬБОМ =====
  log('\n💿 04 — Альбом');
  await nav(page, '/search');
  await page.waitForTimeout(800);
  await typeViaKeys(page, cdp, '.search-input', SEARCH_QUERY);
  await waitCount(page, '.trackrow', 1, 15000);
  const albTab = page.locator('.tab', { hasText: 'Альбомы' }).first();
  if (await albTab.count()) { await albTab.click({ timeout: 4000 }).catch(() => {}); await page.waitForTimeout(2500); }
  const albumHref = await page.evaluate(() => {
    const a = document.querySelector('a[href*="/album/"]');
    return a ? a.getAttribute('href') : null;
  }).catch(() => null);
  if (albumHref) {
    log(`   ➡ ${albumHref}`);
    await nav(page, albumHref.replace(/^#/, ''));
    await waitCount(page, '.entity-title', 1, 12000);
    await page.waitForTimeout(1500);
  } else log('   ⚠️ Альбом не найден');
  await shoot(page, cdp, '04-album');

  // ===== 5. РАДИО =====
  log('\n📻 05 — Радио');
  await nav(page, '/radio');
  await waitCount(page, '.radio-card, .card', 1, 15000);
  await page.waitForTimeout(1500);
  await shoot(page, cdp, '05-radio');

  // ===== 6. ИЗБРАННОЕ =====
  log('\n❤️ 06 — Избранное (ждём строки треков)');
  await nav(page, '/likes');
  const likes = await waitCount(page, '.trackrow', 1, 30000);
  log(`   Строк: ${likes}`);
  await page.waitForTimeout(1500);
  await shoot(page, cdp, '06-favorites');

  // ===== 7. ИСТОРИЯ =====
  log('\n🕘 07 — История (ждём строки треков)');
  await nav(page, '/history');
  const hist = await waitCount(page, '.trackrow, [class*="history-row"]', 1, 30000);
  log(`   Строк: ${hist}`);
  await page.waitForTimeout(1500);
  await shoot(page, cdp, '07-history');

  // ===== 8. ПЛЕЙЛИСТЫ: создаём если пусто, ждём карточку =====
  log('\n📚 08 — Плейлисты (создаю, если пусто)');
  await nav(page, '/playlists');
  await page.waitForTimeout(1500);
  let plCards = await page.evaluate(() => document.querySelectorAll('.card').length).catch(() => 0);
  log(`   Карточек до: ${plCards}`);
  if (plCards === 0) {
    const addBtn = page.locator('button:has-text("Создать плейлист")').first();
    if (await addBtn.count()) {
      await addBtn.click({ timeout: 4000 }).catch(() => {});
      await page.waitForTimeout(800);
      await typeViaKeys(page, cdp, 'input[placeholder*="Название"]', 'Любимое · Muse');
      const createBtn = page.locator('button:has-text("Создать")').first();
      if (await createBtn.count()) { await createBtn.click({ timeout: 4000 }).catch(() => {}); log('   ➕ Клик «Создать»'); }
    }
    // ждём появления карточки
    const t0 = Date.now();
    while (Date.now() - t0 < 20000) {
      plCards = await page.evaluate(() => document.querySelectorAll('.card').length).catch(() => 0);
      if (plCards > 0) break;
      await page.waitForTimeout(500);
    }
    log(`   Карточек после: ${plCards}`);
    await page.reload({ waitUntil: 'domcontentloaded' }).catch(() => {});
    await page.waitForTimeout(3000);
    await nav(page, '/playlists');
    await page.waitForTimeout(2500);
  }
  await shoot(page, cdp, '08-playlists');

  // ===== 9. РАЗВЁРНУТЫЙ ПЛЕЕР + ПЕРЕМОТКА =====
  log('\n🎛 09 — Развёрнутый плеер, перемотка');
  await nav(page, '/');
  await page.waitForTimeout(1000);
  const bar = page.locator('.pb-meta, .playerbar .pb-meta').first();
  if (await bar.count()) {
    await bar.click({ timeout: 4000 }).catch(() => {});
    await page.waitForTimeout(1800);
  }
  await page.evaluate(() => {
    const p = window.__player;
    if (p && typeof p.seek === 'function') p.seek(45000);
  }).catch(() => {});
  await page.waitForTimeout(1500);
  log(`   Плеер: ${await playerState(page)}`);
  await shoot(page, cdp, '09-player');

  // ===== 10. ОЧЕРЕДЬ =====
  log('\n🔄 10 — Очередь');
  const qb = page.locator('button[title="Очередь"]').first();
  if (await qb.count()) {
    await qb.click({ timeout: 4000 }).catch(() => {});
    await page.waitForTimeout(1800);
  }
  await shoot(page, cdp, '10-queue');

  await browser.close();
  log('\n🎉 Готово! Скриншоты в ' + OUT_DIR);
}

main().catch((e) => { console.error('FATAL:', e); process.exit(1); });