#!/usr/bin/env node
// Генератор скриншотов для RuStore в стиле Telegram
// Требует: npm i puppeteer sharp @puppeteer/browsers

import { mkdir, writeFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';

const OUT_DIR = 'store/rustore';
const WIDTH = 1080;
const HEIGHT = 1920; // 9:16

const SCREENS = [
  { id: '01-home', name: 'Главная — Моя волна', path: '/', wait: 2000 },
  { id: '02-search', name: 'Поиск', path: '/search', wait: 1000 },
  { id: '03-radio', name: 'Радио / Моя волна', path: '/radio', wait: 2000 },
  { id: '04-favorites', name: 'Избранное', path: '/likes', wait: 1000 },
  { id: '05-history', name: 'История прослушиваний', path: '/history', wait: 1000 },
  { id: '06-playlists', name: 'Мои плейлисты', path: '/playlists', wait: 1000 },
  { id: '07-artist', name: 'Страница артиста', path: '/artist/12345', wait: 1500 },
];

const BG_COLOR = '#0b0b10'; // тёмный фон как у Telegram
const FRAME_COLOR = '#1a1a22';
const ACCENT = '#ff3c00';

async function run() {
  await mkdir(OUT_DIR, { recursive: true });

  console.log('📱 Генерация скриншотов для RuStore...');
  console.log(`   Размер: ${WIDTH}x${HEIGHT} (9:16)`);
  console.log(`   Стиль: Telegram Dark\n`);

  // Используем adb для скриншотов с реального устройства
  for (const screen of SCREENS) {
    console.log(`📸 ${screen.id} — ${screen.name}`);
    
    try {
      // Скриншот с устройства
      const adbResult = await new Promise((resolve) => {
        const p = spawn('adb', ['exec-out', 'screencap', '-p'], { 
          timeout: 10000 
        });
        const chunks = [];
        p.stdout.on('data', (d) => chunks.push(d));
        p.on('close', () => resolve(Buffer.concat(chunks)));
        p.on('error', () => resolve(null));
      });

      if (adbResult && adbResult.length > 1000) {
        await writeFile(`${OUT_DIR}/${screen.id}.png`, adbResult);
        console.log(`   ✅ Сохранён с устройства: ${OUT_DIR}/${screen.id}.png`);
      } else {
        console.log(`   ⚠️ Не удалось получить скриншот с устройства, создаю макет`);
        await generateMockup(screen);
      }
    } catch (e) {
      console.log(`   ❌ Ошибка: ${e.message}`);
      await generateMockup(screen);
    }
  }

  console.log('\n✅ Готово! Скриншоты в', OUT_DIR);
}

async function generateMockup(screen) {
  // Создаём SVG-макет и конвертируем в PNG через sharp
  const svg = `
<svg width="${WIDTH}" height="${HEIGHT}" xmlns="http://www.w3.org/2000/svg">
  <!-- Фон -->
  <rect width="${WIDTH}" height="${HEIGHT}" fill="${BG_COLOR}"/>
  
  <!-- Рамка телефона (как в Telegram) -->
  <rect x="60" y="80" width="960" height="1760" rx="48" fill="${FRAME_COLOR}" stroke="#2a2a35" stroke-width="2"/>
  <rect x="64" y="84" width="952" height="1752" rx="44" fill="#0d0d12"/>
  
  <!-- Статус-бар -->
  <rect x="64" y="84" width="952" height="48" fill="#0d0d12"/>
  <text x="100" y="116" font-family="system-ui" font-size="18" fill="#fff" font-weight="600">Muse</text>
  <text x="900" y="116" font-family="system-ui" font-size="16" fill="#888" text-anchor="end">100%</text>
  
  <!-- Заголовок экрана -->
  <text x="120" y="180" font-family="system-ui" font-size="32" fill="#fff" font-weight="700">${screen.name}</text>
  <text x="120" y="220" font-family="system-ui" font-size="18" fill="#aaa">Превью интерфейса</text>
  
  <!-- Контентная область -->
  <rect x="100" y="260" width="880" height="1300" rx="16" fill="#121218" opacity="0.5"/>
  
  <!-- Активный плеер снизу (как в приложении) -->
  <rect x="80" y="1600" width="920" height="100" rx="20" fill="#17171f" stroke="#2a2a35" stroke-width="1"/>
  <circle cx="130" cy="1650" r="35" fill="#1a1a22" stroke="#2a2a35"/>
  <text x="130" y="1658" font-family="system-ui" font-size="24" fill="#ff3c00" text-anchor="middle">▶</text>
  <text x="190" y="1640" font-family="system-ui" font-size="18" fill="#fff" font-weight="600">Сейчас играет</text>
  <text x="190" y="1668" font-family="system-ui" font-size="15" fill="#aaa">Название трека — Артист</text>
  
  <!-- Навигация -->
  <rect x="80" y="1720" width="920" height="80" rx="20" fill="#121218"/>
  <text x="200" y="1770" font-family="system-ui" font-size="20" fill="#fff" text-anchor="middle">🏠</text>
  <text x="400" y="1770" font-family="system-ui" font-size="20" fill="#888" text-anchor="middle">🔍</text>
  <text x="600" y="1770" font-family="system-ui" font-size="20" fill="#888" text-anchor="middle">📻</text>
  <text x="800" y="1770" font-family="system-ui" font-size="20" fill="#888" text-anchor="middle">❤️</text>
  <text x="1000" y="1770" font-family="system-ui" font-size="20" fill="#888" text-anchor="middle">📜</text>
  
  <!-- Акцентная линия -->
  <line x1="64" y1="84" x2="64" y2="1836" stroke="${ACCENT}" stroke-width="3" opacity="0.3"/>
  <line x1="1016" y1="84" x2="1016" y2="1836" stroke="${ACCENT}" stroke-width="3" opacity="0.3"/>
</svg>
  `.trim();

  await writeFile(`${OUT_DIR}/${screen.id}.svg`, svg);
  console.log(`   📄 SVG сохранён: ${OUT_DIR}/${screen.id}.svg`);
}

run().catch(console.error);