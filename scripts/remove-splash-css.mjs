// Удаляем блок .splash* из src/index.css (заставка больше не используется)
import { readFileSync, writeFileSync } from 'node:fs'

const p = 'src/index.css'
let src = readFileSync(p, 'utf8')

const startMarker = '.splash {'
const start = src.indexOf(startMarker)
if (start < 0) { console.log('блок .splash не найден'); process.exit(0) }

// ищем конец последнего правила .splash-tag {...}
const tagIdx = src.indexOf('.splash-tag {', start)
if (tagIdx < 0) { console.error('не найден .splash-tag'); process.exit(1) }
const closeIdx = src.indexOf('\n}', tagIdx)
if (closeIdx < 0) { console.error('не найден конец .splash-tag'); process.exit(1) }
const end = closeIdx + 2

// также срезаем комментарий перед блоком, если он есть
let commentStart = start
const before = src.lastIndexOf('/*', start)
if (before >= 0 && before > start - 400) {
  const closeComment = src.indexOf('*/', before)
  const between = src.slice(closeComment + 2, start).trim()
  if (between === '') commentStart = before
}

const removed = src.slice(commentStart, end)
src = src.slice(0, commentStart) + src.slice(end)
writeFileSync(p, src)
console.log('✅ удалено', removed.split('\n').length, 'строк CSS заставки')