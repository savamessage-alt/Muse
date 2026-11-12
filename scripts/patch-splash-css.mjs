// Точечная правка CSS: заменяем блок .splash на анимированную версию
import { readFileSync, writeFileSync } from 'node:fs'

const p = 'src/index.css'
let src = readFileSync(p, 'utf8')

const startMarker = '.splash {'
const start = src.indexOf(startMarker)
const endMarker = 'color: rgba(255, 255, 255, .48);\n}'
const end = src.indexOf(endMarker, start)
if (start < 0 || end < 0) { console.error('не найден блок .splash'); process.exit(1) }
const endIdx = end + endMarker.length

const replacement = `/* Заставка при входе в приложение: диск-логотип, волны, пульсирующий винил, гашение */
.splash {
  position: fixed; inset: 0; z-index: 2000;
  display: flex; align-items: center; justify-content: center;
  background: radial-gradient(120% 120% at 50% 0%, #2b0f17 0%, #131318 55%, #0a0a0f 100%);
  transition: opacity .55s ease, transform .55s ease, filter .55s ease;
  pointer-events: none;
  overflow: hidden;
}
.splash::before,
.splash::after {
  content: ''; position: absolute; width: 420px; height: 420px; border-radius: 50%;
  pointer-events: none;
}
.splash::before {
  border: 1px solid rgba(255, 92, 0, .18);
  animation: splashRipple 2.4s ease-out infinite;
}
.splash::after {
  border: 1px solid rgba(255, 60, 0, .10);
  animation: splashRipple 2.4s ease-out .8s infinite;
}
@keyframes splashRipple {
  0%   { transform: scale(.55); opacity: 0; }
  35%  { opacity: 1; }
  100% { transform: scale(1.25); opacity: 0; }
}
.splash.hide { opacity: 0; transform: scale(1.04); filter: blur(6px); }
.splash-inner {
  display: flex; flex-direction: column; align-items: center; position: relative;
  animation: splashEnter .75s cubic-bezier(.18, .89, .32, 1.18) both;
}
@keyframes splashEnter {
  from { opacity: 0; transform: translateY(18px) scale(.9); }
  to   { opacity: 1; transform: none; }
}
.splash-disc {
  position: relative;
  width: 104px; height: 104px; border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  font-size: 52px; color: #fff;
  background: linear-gradient(135deg, var(--accent), var(--accent-2));
  box-shadow: 0 0 0 16px rgba(255, 60, 0, .10), 0 26px 80px rgba(255, 60, 0, .42);
  animation: splashPulse 1.5s ease-in-out infinite, splashSpin 7s linear infinite;
}
.splash-disc::after {
  content: ''; position: absolute; inset: 12px; border-radius: 50%;
  border: 1px solid rgba(255, 255, 255, .22);
}
@keyframes splashPulse {
  0%, 100% { scale: 1;    box-shadow: 0 0 0 16px rgba(255, 60, 0, .10), 0 26px 80px rgba(255, 60, 0, .42); }
  50%      { scale: 1.07; box-shadow: 0 0 0 24px rgba(255, 60, 0, .16), 0 30px 90px rgba(255, 60, 0, .55); }
}
@keyframes splashSpin {
  from { rotate: 0deg; }
  to   { rotate: 360deg; }
}
.splash-name {
  margin-top: 24px; font-size: clamp(28px, 6vw, 36px); font-weight: 900;
  letter-spacing: .05em; color: #fff; text-shadow: 0 0 34px rgba(255, 90, 0, .4);
  animation: splashTextIn .7s cubic-bezier(.2, .8, .3, 1) .18s both;
}
@keyframes splashTextIn {
  from { opacity: 0; letter-spacing: .3em; filter: blur(4px); }
  to   { opacity: 1; letter-spacing: .05em; filter: blur(0); }
}
.splash-tag {
  margin-top: 8px; font-size: 13px; letter-spacing: .14em; text-transform: uppercase;
  color: rgba(255, 255, 255, .48);
  animation: splashTextIn .7s cubic-bezier(.2, .8, .3, 1) .34s both;
}`

src = src.slice(0, start) + replacement + src.slice(endIdx)
writeFileSync(p, src)
console.log('✅ .splash блок заменён')