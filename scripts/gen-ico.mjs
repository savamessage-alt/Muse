// Сборка настоящего многоразмерного .ico для Windows из SVG
import sharp from 'sharp'
import ico from 'png-to-ico'
import { writeFileSync } from 'node:fs'

const sizes = [16, 24, 32, 48, 64, 128, 256]
const bufs = []
for (const s of sizes) bufs.push(await sharp('icon-app.svg').resize(s, s).png().toBuffer())
const out = await ico(bufs)
writeFileSync('electron/build/icon.ico', out)
console.log('✅ electron/build/icon.ico', out.length, 'байт, размеры:', sizes.join(', '))