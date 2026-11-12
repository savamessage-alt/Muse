// ============================================================
// Скрипт: генерация PNG-иконок приложения (все плотности) из SVG.
// Запуск: node scripts/gen-icons.mjs
// ============================================================
import { mkdirSync, writeFileSync } from 'node:fs'
import sharp from 'sharp'

const SVG = 'icon-app.svg'
const RES = 'android/app/src/main/res'
const PUBLIC = 'public'
const ELECTRON = 'electron/build'

mkdirSync(PUBLIC, { recursive: true })

// Android: mipmap-* — квадратные PNG (система сама обрежет под adaptive-иконку)
const android = [
  ['mipmap-mdpi', 48],
  ['mipmap-hdpi', 72],
  ['mipmap-xhdpi', 96],
  ['mipmap-xxhdpi', 144],
  ['mipmap-xxxhdpi', 192],
]

for (const [dir, size] of android) {
  mkdirSync(`${RES}/${dir}`, { recursive: true })
  const buf = await sharp(SVG).resize(size, size).png().toBuffer()
  writeFileSync(`${RES}/${dir}/ic_launcher.png`, buf)
  writeFileSync(`${RES}/${dir}/ic_launcher_round.png`, buf)
  console.log(`  ✅ ${dir}/ic_launcher.png ${size}x${size}`)
}

// PWA / favicon
for (const [name, size] of [['icon-192', 192], ['icon-512', 512]]) {
  await sharp(SVG).resize(size, size).png().toFile(`${PUBLIC}/${name}.png`)
  console.log(`  ✅ public/${name}.png ${size}x${size}`)
}
await sharp(SVG).resize(64, 64).png().toFile(`${PUBLIC}/favicon.png`)
await sharp(SVG).resize(512, 512).png().toFile(`${ELECTRON}/icon.png`)
await sharp(SVG).resize(256, 256).png().toFile(`${ELECTRON}/icon-256.png`)
console.log('  ✅ public/favicon.png, electron/build/icon.png')

// .ico для Windows-сборки (несколько размеров в одном файле)
const icoSizes = [16, 24, 32, 48, 64, 128, 256]
const icoPngs = []
for (const s of icoSizes) icoPngs.push(await sharp(SVG).resize(s, s).png().toBuffer())
await sharp(icoPngs[icoPngs.length - 1]).toFile(`${ELECTRON}/icon.ico`)
console.log('  ✅ electron/build/icon.ico (через sharp, размеры: ' + icoSizes.join(', ') + ')')