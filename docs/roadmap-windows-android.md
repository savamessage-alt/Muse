# Роадмап: веб → Windows (.exe) → Android (.apk)

Цель: один код React + TypeScript на все платформы. Сборки автономны: для ПК — свой `.exe`, для телефона — свой `.apk`, всё работает независимо (только интернет для музыки).

```
               ┌──────────  веб  ──────────┐
               │  npm run dev / build      │
               └────────────┬──────────────┘
                            │ один и тот же код
        ┌───────────────────┴───────────────────┐
   ┌────┴─────┐                           ┌─────┴──────┐
   │ Electron │                           │ Capacitor  │
   │ (Windows)│                           │ (Android)  │
   │ .exe     │                           │ .apk       │
   └──────────┘                           └────────────┘
```

## Этапы

### Сейчас сделано
- [x] Веб-версия полностью работает: вход, лента, поиск, плейлисты, альбомы, артисты, лайки, история, радио, настройки, очередь, качество.
- [x] Архитектура транспорта готова к нативу: браузер → `ymElectronAPI` (Electron) → `CapacitorHttp` (Android) — выбор в `src/core/transport.ts`.
- [x] Каркасы: `electron/main.mjs` + `electron/preload.cjs`, `capacitor.config.ts`, скрипты в package.json.

### Этап 1 — Windows .exe (Electron)
1. Установка Electron уже в dev-зависимостях.
2. Проверка dev-режима: `npm run electron:dev` (два окна: Vite + Electron; запросы идут через main-процесс, CORS не мешает).
3. Токен: перевести хранение с `localStorage` на `safeStorage` (шифрование системой) — продумано, TODO.
4. Сборка установщика: `npm run electron:build` → `electron-builder --win nsis` → `release/YM Player Setup *.exe`.
5. Иконка: положить `electron/build/icon.ico` (пока дефолтная).
6. Риски: при первом запуске Windows SmartScreen может ругнуться — «Выполнить в любом случае» (нет подписи кода).

### Этап 2 — Android .apk (Capacitor)
1. `npm run cap:add:android` — сгенерирует папку `android/` (нужен только Node; Android Studio не требуется на этом шаге).
2. `npm run cap:sync` — соберёт `dist/` и скопирует в нативное приложение.
3. Установить Android Studio + JDK 17 (импортировать папку `android/`), либо поставить SDK/JDK и собрать из консоли:
   - `cd android && gradlew assembleDebug` → `android/app/build/outputs/apk/debug/app-debug.apk` (можно ставить на телефон; для Google Play нужен release + подпись + aab).
4. Проверка: `npm run cap:open:android` (Android Studio) → Run.
5. Настройки обхода CORS уже в `capacitor.config.ts` (`CapacitorHttp.enabled`), транспорт выбирает нативный HTTP автоматически.
6. Риски: для **стабильного фонового воспроизведения** (экран заблокирован) нужен отдельный медиа-сервис — вынести воспроизведение в нативный слой или использовать WebView foreground service. Пока — воспроизведение при активном приложении.

### Этап 3 — Синхронизация (Ynison) — уже начата
- `src/core/ynison.ts` реализует: редирект-сервис → state-socket → JSON-фреймы (полный протокол в `docs/ynison-protocol.md`).
- В настройках есть кнопка «Подключить синхронизацию» (статус, id устройства, удалённое управление: play/pause/next/громкость).
- Дальше: автоматическое подключение при входе, экран «устройства» со списком из `devices[]`, синхронизация очереди.

### Этап 4 — Полировка
- Кэш/офлайн-скачивания (кэш stream'а в Electron/Capacitor на диск), тёмные/светлые темы переключатель, i18n (UI уже русский), пуш-уведомления «токен истекает».

## Решения по транспорту (важно)

| Среда | Способ запросов | Почему |
|---|---|---|
| Браузер (dev) | Vite-прокси `/api`, `/oauth` | обход CORS без внешних сервисов |
| Браузер (prod web) | CORS-прокси onrender (настраиваемый) | API Яндекса не отдаёт CORS |
| Electron | `net.fetch` в main-процессе (IPC) | вообще нет CORS, надёжно |
| Android/Capacitor | `CapacitorHttp` (нативный) | нет CORS в WebView |

Поток аудио: `<audio>` играет прямые ссылки `avatars.yandex.net/get-mp3/...` — медиа-элементу CORS не нужен (без атрибута crossorigin), работает во всех четырёх средах без изменений.