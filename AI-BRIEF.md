# Muse — бриф для AI-агента (аудит проекта)

> Передаточный документ. Прочитай целиком перед первой правкой кода.
> Дата составления: 2026-11-23. Рабочая папка: `C:\Users\Va_Dar\Desktop\ym-player`

---

## 1. Что это

**Muse** — неофициальный клиент Яндекс Музыки. Один код → три платформы: Web (Vite dev/prod),
Windows `.exe` (Electron), Android `.apk` (Capacitor 8).

- `appId`: `com.ymplayer.app`, `productName`: `Muse`, версия берётся из `package.json` (`0.1.0`)
- UI **полностью на русском**, тёмная тема, бренд «Muse»
- ⚠️ **В UI нельзя упоминать «Яндекс Музыка» как бренд приложения** — только как источник данных
  в юридическом подвале («неофициальный клиент… товарные знаки принадлежат правообладателям»).
  В коде/комментариях/API-путях упоминания Яндекса допустимы и неизбежны.

---

## 2. Стек

| Слой | Технология |
|---|---|
| UI | React 19 + TypeScript 7, HashRouter (`react-router-dom` 7) |
| Состояние | Zustand 5 (`src/state/store.ts`), singleton-плеер вне React |
| Сборка | Vite 8 (`base: './'` — важно для `file://` и WebView) |
| Иконки | `lucide-react`, обёрнуты в `src/components/icons.tsx` |
| Android | Capacitor 8 + `@capacitor/device` + кастомный нативный плагин `BackgroundPlayback` |
| Windows | Electron 38 + electron-builder (NSIS) |
| Стили | Один файл `src/index.css` (~1600 строк), CSS-переменные в `:root`, без CSS-in-JS и препроцессоров |

Тестов **нет** (ни jest/vitest). Единственная автоматическая проверка — `npx tsc -b`.
В корне и `e2e/` лежат разовые скрипты `.mjs` (playwright/CDP) — это отладочный хлам, не CI.

---

## 3. Обязательные команды

```powershell
# типы (быстро, запускать после каждой правки)
npx tsc -b --pretty false

# dev-сервер (проксирует API Яндекса, обходя CORS)
npm run dev            # http://localhost:5173

# прод-сборка
npm run build

# Android: синк + сборка release APK
npx cap sync android
$env:JAVA_HOME = "C:\Program Files\Eclipse Adoptium\jdk-21.0.11.10-hotspot"
cd android; .\gradlew.bat assembleRelease; cd ..

# установка на телефон
C:\Users\Va_Dar\AppData\Local\Android\Sdk\platform-tools\adb.exe install -r `
  "android\app\build\outputs\apk\release\app-release.apk"
```

**Жёсткие требования окружения:**
- **Java 21 обязательна.** Java 25 ломает Gradle 8.13 — всегда выставляй `$env:JAVA_HOME` (путь выше).
- Устройство: `RFCRA1PED6D`; ADB лежит по пути `C:\Users\Va_Dar\AppData\Local\Android\Sdk\platform-tools\adb.exe`.
- Подпись release уже настроена: `android/keystore.properties` (alias `muse`). Не коммить секреты.

---

## 4. Архитектура: где что лежит

```
src/
├─ main.tsx                 точка входа (React root)
├─ App.tsx                  роутинг + гейты (BootGate / RequireAuth / WelcomeGate) + ReauthWatcher
├─ core/                    ← вся «модель», без React
│  ├─ transport.ts          выбор транспорта (fetch / CapacitorHttp), resolveUrl для dev-прокси
│  ├─ client.ts             (534 стр.) клиент API Яндекс Музыки: лента, поиск, альбомы, плейлисты, лайки
│  ├─ sign.ts               подпись запросов (MD5, timestamp) — самая хрупкая часть
│  ├─ stream.ts             получение прямой ссылки на поток (MP3/HLS, качество 320/192/128)
│  ├─ player.ts             (744 стр.) singleton-плеер: очередь, автопереход, радио, sleep-timer,
│  │                        Media Session, восстановление состояния
│  ├─ auth.ts               OAuth Device Flow
│  ├─ tokenManager.ts       хранение/обновление токена, событие onReauthNeeded
│  ├─ background.ts         мост к нативному foreground-сервису (Android)
│  ├─ mediaControl.ts       Media Session / системные клавиши
│  ├─ wave.ts               «Моя волна» (радио по seed-настройкам)
│  ├─ ynison.ts             протокол синхронизации между устройствами (WebSocket)
│  ├─ format.ts             formatMs, coverUrl, trackKey, PLACEHOLDER_COVER — общие утилиты
│  ├─ diag.ts, types.ts, tracks.ts
├─ state/store.ts           Zustand: boot/auth/user/playlists/likedKeys/toasts/listeningStats
├─ components/              страницы и виджеты (см. таблицу ниже)
├─ hooks/                   useSwipeBack, useSwipeNav (жесты)
└─ index.css                ЕДИНЫЙ файл всех стилей
```

### Страницы (все в `src/components/`)
| Файл | Роль |
|---|---|
| `WelcomePage` | заставка до входа (анимация винила/волн) |
| `LoginPage` | OAuth Device Flow + ручной ввод токена |
| `Layout` | каркас: сайдбар/нижняя навигация + `PlayerBar` (живёт здесь всегда) |
| `HomePage` | лента, новинки, чарты |
| `SearchPage` | поиск (треки/альбомы/артисты/плейлисты) |
| `PlaylistsPage`, `PlaylistPage` | плейлисты, CRUD |
| `AlbumPage`, `ArtistPage` | альбом, артист |
| `FavoritesPage` («Избранное») | плейлисты + лайкнутые треки |
| `HistoryPage` | история прослушивания |
| `RadioPage` | «Моя волна» + станции |
| `SettingsPage` | настройки; раздел «О приложении» = одна кнопка → `/about` |
| `AboutPage` | **новое**: винил, версия, статистика прослушивания, инфо об устройстве, технологии, API |
| `PlayerBar` + `ExpandedPlayer` | мини-плеер и развёрнутый bottom-sheet (текст, похожие, очередь, таймер) |
| `TrackList`, `cards.tsx` | переиспользуемые списки и карточки |
| `EmptyState` | **новое**: единый компонент пустых состояний |
| `Toasts`, `ErrorBoundary` | уведомления и перехват ошибок |

---

## 5. Текущее состояние (важно!)

- **HEAD — detached, коммит `d4884b1`** («BACKUP: Pre-feature-implementation baseline»).
  Ветка `master` указывает на тот же коммит.
- **~30 файлов изменены и НЕ закоммичены** — это и есть вся текущая работа (круги улучшений).
  Список: `git status --short`.
- В `stash@{0}` (`wip-features-rollback-2026-11-16`) лежит старый срез (10 файлов) — **не применять
  вслепую**, он конфликтует с текущим деревом.
- ✅ `npx tsc -b` проходит чисто, `npm run build` проходит (CSS ≈ 54 КБ, JS ≈ 429 КБ).
- APK последней сборки собран и установлен на `RFCRA1PED6D`.

**Первое, что стоит сделать:** закоммитить текущее дерево как осмысленный коммит
(например `feat: about page + listening stats + UI polish`), чтобы дальнейшая работа шла от
известной точки. Не делай это без явного разрешения владельца.

---

## 6. Что сделано в последних итерациях

1. **`AboutPage`** — переписана: шапка с винилом и версией, сетка статистики (сегодня/неделя/месяц/
   всё время), карточка «Устройство» (модель/производитель/ОС/UID через `@capacitor/device`),
   карточка «Технологии», карточка «API и поток», очистка кэша, юридический подвал.
2. **Статистика прослушивания** — `store.listeningStats {today, week, month, all}` +
   `addListeningTime(ms)`, персист в `localStorage` (ключи `stats:today`, `stats:week:…`,
   `stats:month:…`, `stats:all`).
   Начисление в `PlayerBar.tsx`: `useEffect` по `snap.positionMs`, считает дельту позиции при
   `snap.playing`, отбрасывает перемотки > 2 с, начисляет `Math.min(dp, dt)`.
   ⚠️ Это эвристика на фронтенде: если `PlayerBar` размонтируется или WebView троттлит таймеры,
   возможны потери/недоначисления. Кандидат на перенос в `player.ts` (там события `timeupdate`).
3. **`SettingsPage`** упрощена: раздел «О приложении» → одна кнопка «О Muse» → `/about`.
4. Восстановлен `src/index.css` и добавлены `.about-*` стили.

---

## 7. Грабли, на которые уже наступали (не повторять)

### 7.1. `src/index.css` — только через `edit`/`write`!
Файл в UTF-8. **Никогда не дописывай его через PowerShell `Add-Content` / `>>`** — кодировка
ломается, Vite падает с `stream did not contain valid UTF-8`, а CSS в сборке схлопывается до
2 КБ (стили «исчезают»). Симптом: приложение выглядит «голым».
Лечение: `git checkout -- src/index.css`, затем правка через `edit`.
> Один раз уже пришлось откатывать файл — не используй шелл для правки этого файла.

### 7.2. Циклические импорты
`store.ts` импортирует `player.ts`. Обратный импорт (`player.ts` → `store`) **создаст цикл**.
Поэтому побочные эффекты (статистика, тосты) вешаются в компонентах, а не в движке плеера.
Если очень нужно из движка — выноси общий модуль (например `core/listeningStats.ts`) без React.

### 7.3. Vite dev-прокси
В dev браузер ходит на относительные `/api/...` и `/oauth/...` — Vite проксирует к Яндексу и
снимает `Origin`/`Referer` (иначе API режет POST). В прод-сборке на Android работает
`CapacitorHttp` (`capacitor.config.ts`). Пути резолвятся в `transport.ts → resolveUrl`.
Не «упрощай» это до абсолютных URL — сломается CORS и на устройстве, и в Electron.

### 7.4. HashRouter обязателен
`file://` в Electron и WebView не умеют history-роутинг. Не переходи на `BrowserRouter`.

### 7.5. `mediaControl` / `player` — синглтоны
`player` живёт вне React. Читать состояние — `player.snapshot()` + `player.onChange(fn)`.
Не дублируй состояние плеера в Zustand.

---

## 8. Технический долг / известные слабые места

| # | Проблема | Комментарий |
|---|---|---|
| 1 | Нет тестов и линтера | `eslint` не настроен, `vitest` нет. Стоит начать хотя бы с `vitest` для `format.ts`, `store.ts`, `sign.ts` |
| 2 | Мусор в корне | ~40 файлов `test-*.mjs`, `probe-*.mjs`, скриншоты PNG. Предложить перенос в `e2e/` + `.gitignore` |
| 3 | `client.ts` (534) и `player.ts` (744) разрослись | Кандидаты на декомпозицию по доменам |
| 4 | Статистика времени на фронтенде | Эвристика в `PlayerBar`; лучше считать в `player.ts` по `timeupdate` |
| 5 | `docs/` в основном описывает API | `docs/SCHEMES.md`, `docs/api-notes.md`, `docs/auth-notes.md`, `docs/ynison-protocol.md` — читать перед работой с API |
| 6 | README частично устарел | Обещает «каркас готов» для Electron/Android — фактически всё работает |
| 7 | `sign.ts` — хрупкий | Любое изменение подписи ломает воспроизведение; менять только с проверкой на устройстве |
| 8 | Нет CI | Сборка/установка только вручную по командам из §3 |

---

## 9. Правила работы (соблюдать)

1. **Сначала типы:** после каждой правки `npx tsc -b --pretty false`. Красный tsc — не сдавать.
2. **Стили** — только в `src/index.css`, через переменные (`--bg-panel`, `--border`, `--accent`,
   `--text-dim`, `--radius`…). Не вводить inline-стили и новые цветовые хардкоды, если есть переменная.
3. **Мобильный-first:** проверять `<= 480px` и `<= 640px`. У приложения есть bottom-sheet плеер и
   нижняя навигация — не перекрывать их.
4. **Русский UI**, тон — нейтральный, без англицизмов в кнопках.
5. **Не ломать существующее поведение:** свайпы (`useSwipeNav`/`useSwipeBack`), восстановление
   очереди (`player.restore()`), Media Session, таймер сна.
6. **После UI-правки** — собрать APK и поставить на телефон (команды §3), затем проверить визуально.
7. Крупные изменения — сначала план, потом код. Владелец любит итеративные «круги» улучшений
   с коротким отчётом «что сделано».

---

## 10. Быстрый чек-лист перед сдачей

```
[ ] npx tsc -b --pretty false   → 0 ошибок
[ ] npm run build               → CSS ≈ 50+ КБ (если 2 КБ — сломан index.css, см. §7.1)
[ ] npx cap sync android        → плагины найдены
[ ] gradlew assembleRelease     → BUILD SUCCESSFUL
[ ] adb install -r …            → Success
[ ] визуальная проверка на устройстве: главная, поиск, избранное, /settings, /about
```
