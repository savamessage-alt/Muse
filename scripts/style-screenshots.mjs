#!/usr/bin/env node
// Оформление скриншотов в стиле Telegram Dark для RuStore:
// тёмный фон, скруглённая рамка телефона, заголовок + описание под скриншотом.
// Из реальных скриншотов (500x935) собираем карточки 1080x1920.
import sharp from 'sharp';
import { mkdir, readdir } from 'node:fs/promises';

const SRC = 'store/rustore/real';
const OUT = 'store/rustore';
const W = 1080, H = 1920;

// Соответствие id -> подпись
const LABELS = {
  '01-home':      { title: 'Музыка не заканчивается',          sub: '«Моя волна» — бесконечный поток под ваш вкус' },
  '02-search':    { title: 'Весь каталог в поиске',             sub: 'Треки, альбомы, артисты и плейлисты' },
  '03-artist':    { title: 'Всё об исполнителе',                sub: 'Популярные треки, альбомы, похожие артисты' },
  '04-album':     { title: 'Альбомы целиком',                   sub: 'Слушайте альбомы или добавьте в очередь' },
  '05-radio':     { title: 'Радио на любой вкус',               sub: 'Станции, подборки и чарты' },
  '06-favorites': { title: 'Избранное всегда с вами',           sub: 'Лайки синхронизируются с аккаунтом' },
  '07-history':   { title: 'Вернитесь к любимому',              sub: 'История прослушиваний под рукой' },
  '08-playlists': { title: 'Свои плейлисты',                    sub: 'Создавайте и наполняйте коллекции' },
  '09-player':    { title: 'Полноценный плеер',                 sub: 'Перемотка, лайк, текст песни, очередь' },
  '10-queue':     { title: 'Очередь под контролем',             sub: 'Добавляйте треки и управляйте порядком' },
};

// Рисуем SVG-карточку 1080x1920 с телефонной рамкой
function cardSvg(id, imgBase64) {
  const { title, sub } = LABELS[id] ?? { title: id, sub: '' };
  return `
<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#15151c"/>
      <stop offset="100%" stop-color="#0a0a0f"/>
    </linearGradient>
  </defs>
  <rect width="${W}" height="${H}" fill="url(#bg)"/>

  <!-- скриншот внутри рамки телефона -->
  <rect x="290" y="120" width="500" height="935" rx="48" fill="#000"/>
  <rect x="300" y="130" width="480" height="915" rx="38" fill="#000"/>
  <image x="306" y="136" width="468" height="903" href="data:image/png;base64,${imgBase64}"/>
  <!-- вырез (камера) -->
  <rect x="480" y="150" width="120" height="10" rx="5" fill="#1a1a22"/>

  <!-- заголовок под телефоном -->
  <text x="540" y="1160" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="46" font-weight="bold" fill="#ffffff">${title}</text>
  <text x="540" y="1224" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="26" fill="#9a9aa8">${sub}</text>
</svg>`;
}

async function run() {
  await mkdir(OUT, { recursive: true });
  const files = (await readdir(SRC)).filter((f) => f.endsWith('.png'));
  console.log(`Оформляю ${files.length} скриншотов (1080x1920, стиль Telegram Dark):\n`);

  for (const f of files) {
    const id = f.replace('.png', '');
    try {
      // читаем PNG и конвертируем в base64
      const buf = await sharp(`${SRC}/${f}`).png().toBuffer();
      const b64 = buf.toString('base64');
      const svg = cardSvg(id, b64);
      await sharp(Buffer.from(svg)).png({ compressionLevel: 9 }).toFile(`${OUT}/${id}.png`);
      console.log(`   ✅ ${OUT}/${id}.png (${LABELS[id]?.title ?? id})`);
    } catch (e) {
      console.error(`   ❌ ${f}: ${e.message}`);
    }
  }
  console.log('\n🎉 Готово! Скриншоты в ' + OUT);
}

run().catch(console.error);