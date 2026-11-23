# Muse (ym-player) — инструкции для ИИ-агентов

> Рабочая папка: `C:\Users\Va_Dar\Desktop\ym-player`
> Проект: неофициальный клиент Яндекс Музыки «Muse». Один код → три платформы:
> Web (Vite), Windows `.exe` (Electron 38), Android `.apk` (Capacitor 8).

## 1. Что это (кратко)

- `appId`: `com.ymplayer.app`, `productName`: `Muse`, версия из `package.json` (`0.1.0`).
- UI **полностью на русском**, тёмная тема, бренд «Muse».
- ⚠️ В UI **нельзя** упоминать «Яндекс Музыка» как бренд приложения — только как источник данных в юридическом подвале. В коде/комментариях/API-путях упоминания Яндекса допустимы.
- Клиент API Яндекс Музыки написан вручную на TS (аналог MarshalX/yandex-music-api). API не документировано и может меняться.

## 2. Стек

| Слой | Технология |
|---|---|
| UI | React 19 + TypeScript, HashRouter (`react-router-dom` 7) |
| Состояние | Zustand 5 (`src/state/store.ts`), singleton-плеер вне React |
| Сборка | Vite 8 (`base: './'` — важно для `file://` и WebView) |
| Иконки | `lucide-react`, обёрнуты в `src/components/icons.tsx` |
| Android | Capacitor 8 + `@capacitor/device` + кастомный нативный плагин `BackgroundPlayback` |
| Windows | Electron 38 + electron-builder (NSIS) |
| Стили | Один файл `src/index.css` (~1600 строк), CSS-переменные в `:root`, без CSS-in-JS |

Тестов нет (ни jest/vitest). Единственная автоматическая проверка — `npx tsc -b`. `e2e/` — разовые отладочные скрипты (.mjs, playwright/CDP), не CI, не трогать без плана.

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

# установка на телефон (устройство RFCRA1PED6D)
C:\Users\Va_Dar\AppData\Local\Android\Sdk\platform-tools\adb.exe install -r `
  "android\app\build\outputs\apk\release\app-release.apk"
```

Жёсткие требования окружения:
- **Java 21 обязательна.** Java 25 ломает Gradle 8.13 — всегда `$env:JAVA_HOME` к JDK 21.
- Подпись release уже настроена: `android/keystore.properties` (alias `muse`). **Не коммить секреты** (ключ/пароли).

## 4. Архитектура: где что лежит

```
src/
├─ main.tsx                 точка входа (React root)
├─ App.tsx                  роутинг + гейты (BootGate / RequireAuth / WelcomeGate) + ReauthWatcher
├─ core/                    ← вся «модель», без React
│  ├─ transport.ts          выбор транспорта (fetch / CapacitorHttp), resolveUrl для dev-прокси
│  ├─ client.ts             клиент API Яндекс Музыки: лента, поиск, альбомы, плейлисты, лайки
│  ├─ sign.ts               подпись запросов (MD5, timestamp) — самая хрупкая часть
│  ├─ stream.ts             получение прямой ссылки на поток (MP3/HLS, качество 320/192/128)
│  ├─ player.ts             singleton-плеер: очередь, автопереход, радио, sleep-timer,
│  │                        Media Session, восстановление состояния
│  ├─ auth.ts               OAuth Device Flow
│  ├─ tokenManager.ts       хранение/обновление токена, событие onReauthNeeded
│  ├─ background.ts         мост к нативному foreground-сервису (Android)
│  ├─ mediaControl.ts       Media Session / системные клавиши
│  ├─ wave.ts               «Моя волна» (радио по seed-настройкам)
│  ├─ ynison.ts             протокол синхронизации с другими устройствами
│  └─ types.ts              модели данных API
├─ state/                   store.ts (Zustand)
├─ components/              страницы и UI-компоненты (LoginPage, Layout, HomePage, …)
├─ hooks/                   useSwipeNav, useSwipeBack
└─ index.css                один файл стилей (~1600 строк)

electron/                   main.cjs, preload.cjs, build/ (иконки, NSIS)
android/                    Capacitor-проект (gradle, keystore.properties)
docs/                       api-notes, auth-notes, ynison-protocol, roadmap, SCHEMES
scripts/                    разовые отладочные .mjs / .ps1
store/rustore               скриншоты для маркетинга
```

## 5. Правила работы агентов

1. **После каждой правки кода** — запускать `npx tsc -b --pretty false`,目标 0 ошибок.
2. **Не ломать существующее поведение:** свайпы (`useSwipeNav`/`useSwipeBack`), восстановление очереди (`player.restore()`), Media Session, таймер сна, фоновое воспроизведение Android.
3. **Крупные изменения — сначала план, потом код.** Владелец любит итеративные «круги» с коротким отчётом «что сделано».
4. **В UI не упоминать «Яндекс Музыка» как бренд приложения.**
5. **Секреты не коммитить:** `android/keystore.properties` и любые токены/ключи.
6. **e2e/ — отладочный хлам**, не часть CI. Не полагаться на него как на защиту от регрессов.
7. Перед релизом (сборка APK / EXE) — визуальная проверка на устройстве: главная, поиск, избранное, `/settings`, `/about`.

## 6. Чек-лист перед сдачей (из CHECKLIST.md)

```
[ ] npx tsc -b --pretty false   → 0 ошибок
[ ] npm run build               → CSS ≈ 50+ КБ (если 2 КБ — сломан index.css)
[ ] npx cap sync android        → плагины найдены
[ ] gradlew assembleRelease     → BUILD SUCCESSFUL
[ ] adb install -r …            → Success
[ ] визуальная проверка на устройстве: главная, поиск, избранное, /settings, /about
```

## 7. Ветки иリリース (GitHub)

- Работа ведётся в изолированных рабочих деревьях (`.agents/worktrees/…`).
- Перед пушем на GitHub нужно согласовать: URL репозитория, remote и способ аутентификации (токен / credential manager). В текущей проверке `gh` не установлен, remote не настроен — пуш делается вручную или после настройки удалённого репозитория.
