#!/usr/bin/env node
// Конвертация SVG в PNG для RuStore
import sharp from 'sharp';
import { readdir, writeFile } from 'node:fs/promises';

const INPUT_DIR = 'store/rustore';
const WIDTH = 1080;
const HEIGHT = 1920;

async function run() {
  const files = await readdir(INPUT_DIR);
  const svgs = files.filter(f => f.endsWith('.svg'));
  
  console.log(`🔄 Конвертация ${svgs.length} SVG в PNG (${WIDTH}x${HEIGHT})...\n`);
  
  for (const svg of svgs) {
    const input = `${INPUT_DIR}/${svg}`;
    const output = `${INPUT_DIR}/${svg.replace('.svg', '.png')}`;
    
    try {
      await sharp(input)
        .resize(WIDTH, HEIGHT)
        .png({ compressionLevel: 9 })
        .toFile(output);
      console.log(`   ✅ ${svg} → ${output}`);
    } catch (e) {
      console.error(`   ❌ ${svg}: ${e.message}`);
    }
  }
  
  console.log('\n✅ Конвертация завершена!');
}

run().catch(console.error);