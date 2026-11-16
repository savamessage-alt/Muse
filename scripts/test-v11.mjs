import { chromium } from "playwright";
const b = await chromium.connectOverCDP("http://localhost:9222");
const ctx = b.contexts()[0];
const page = ctx.pages().find((p) => p.url().includes("localhost:5173"));
await page.reload();
await page.waitForTimeout(6000);

console.log("=== ВОЛНА: выбор настроения и запуск ===");
await page.locator(".wave-settings-btn").click();
await page.waitForTimeout(2500);
await page.locator(".ws-tile", { hasText: "Бодрое" }).click();
await page.waitForTimeout(500);
await page.locator(".ws-apply").click();
await page.waitForTimeout(8000);
const after = await page.evaluate(() => ({
  label: document.querySelector(".wave-label")?.textContent?.trim(),
  playing: window.__player.snapshot().playing,
  track: window.__player.snapshot().current?.track?.title,
  q: window.__player.snapshot().queue.length,
}));
console.log("после запуска:", JSON.stringify(after));
await b.close();
