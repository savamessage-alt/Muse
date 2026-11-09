# 🎵 YM Player — плеер Яндекс Музыки на TypeScript

Неофициальный клиент Яндекс Музыки. **Один код** → три платформы:

| Платформа | Технология | Статус |
|---|---|---|
| Веб | React + Vite + TypeScript | ✅ работает |
| Windows (`.exe`) | Electron | 🔶 каркас готов, сборка по шагам ниже |
| Android (`.apk`) | Capacitor | 🔶 каркас готов, сборка в Android Studio |

Основано на обратном инжиниринге API из проекта [MarshalX/yandex-music-api](https://github.com/MarshalX/yandex-music-api) (OpenAPI-спека, документация [ym.marshal.dev](https://ym.marshal.dev/)). Подробности — в [docs/](docs/) и [CHECKLIST.md](CHECKLIST.md).

## Возможности

- ✅ **Вход через Яндекс** (OAuth Device Flow): код на экране → подтверждение на ya.ru/device. Ручной ввод токена — запасной путь.
- ✅ **Токен больше не ломает плеер**: автообновление по `refresh_token`, при истечении/отзыве — повторный вход (см. [docs/auth-notes.md](docs/auth-notes.md)).
- ✅ Поиск (треки/альбомы/артисты/плейлисты), лента, новинки, чарты.
- ✅ Плейлисты: просмотр, создание.
- ✅ Лайки «Мне нравится», история прослушивания.
- ✅ Альбомы, артисты (популярные треки, альбомы).
- ✅ Радио: «Моя волна» и станции с обратной связью (лайк/скип).
- ✅ Очередь, повтор, перемешивание, перемотка, громкость, Media Session (системные клавиши).
- ✅ Выбор качества: MP3 320 / 192 / 128.
- ✅ Тёмная тема, русский интерфейс.
- 🟡 **Синхронизация Ynison** (управление с других устройств: пауза/следующий трек/громкость) — раздел «Настройки → Синхронизация» (см. [docs/ynison-protocol.md](docs/ynison-protocol.md)).

## Быстрый старт

```bash
npm install
npm run dev          # http://localhost:5173 (доступен и с телефона по Wi-Fi)
```

Откройте адрес, нажмите «Войти через Яндекс», введите показанный код на ya.ru/device — и слушайте музыку.

## Сборка приложений

### Windows .exe

```bash
npm run electron:build      # создаст release/YM Player Setup *.exe
npm run electron:dev       # (опционально) запуск Electron в dev-режиме
```

### Android .apk

```bash
npm run cap:add:android     # один раз: сгенерировать android/
npm run cap:sync            # собрать веб и синхронизировать в нативное приложение
npm run cap:open:android    # открыть в Android Studio → Run
# или из консоли (нужны JDK 17 + Android SDK):
cd android && gradlew assembleDebug   # → app/build/outputs/apk/debug/app-debug.apk
```

## Структура

```
src/
  core/        # транспорт, OAuth, токен-менеджер, REST-клиент, плеер, стриминг, Ynison, подписи
  state/       # глобальное состояние (zustand)
  components/  # страницы и компоненты UI
electron/      # main-процесс и preload (Windows)
electron/roadmap → docs/roadmap-windows-android.md
docs/          # api-notes, auth-notes, ynison-protocol, roadmap
CHECKLIST.md   # чек-лист функций: что сделано, что дальше
```

## Предупреждение

Проект неофициальный, API Яндекса не документировано и может меняться. Без подписки Яндекс Плюс часть треков недоступна (30-секундные превью). Неофициальность означает: возможны изменения без предупреждения, следите за [CHANGES](https://github.com/MarshalX/yandex-music-api/blob/main/CHANGES.md).

Лицензия кода-основы: LGPL-3.0 (MarshalX/yandex-music-api).