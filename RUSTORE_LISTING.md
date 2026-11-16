# Muse — Материалы для публикации в RuStore

> **Важно:** Это неофициальный клиент Яндекс Музыки. Название и бренд "Muse" используются для избежания проблем с товарными знаками Яндекса.

---

## 📱 Основные данные приложения

| Параметр | Значение |
|----------|----------|
| **Package ID** | `com.ymplayer.app` |
| **Название (RU)** | Muse — Музыка без границ |
| **Название (EN)** | Muse — Music Without Borders |
| **Краткое описание (RU)** | Плеер для Яндекс Музыки: потоковое воспроизведение, радио, плейлисты, история, фоновое воспроизведение |
| **Краткое описание (EN)** | Yandex Music player: streaming, radio, playlists, history, background playback |
| **Версия** | 1.0 (versionCode: 1) |
| **Min SDK** | 24 (Android 7.0) |
| **Target SDK** | 36 (Android 14) |
| **Категория** | Музыка и аудио → Плееры |
| **Возрастной рейтинг** | 3+ (для всех) |

---

## 📝 Полное описание (RU)

**Muse** — современный, быстрый и удобный плеер для Яндекс Музыки.

### 🎵 Основные возможности:

**Потоковое воспроизведение без компромиссов**
- Качественный звук (до 320 kbps / lossless при наличии подписки)
- Мгновенный запуск треков — никаких задержек
- Умная очередь с автодополнением похожими треками («Моя волна»)

**Радио и рекомендации**
- Персональные радиостанции на основе ваших вкусов
- Станции по жанрам, настроениям, исполнителям
- Обратная связь «Нравится / Не нравится» для улучшения рекомендаций

**Ваша музыкальная библиотека**
- Избранные треки (Лайки) — мгновенный доступ
- История прослушиваний с поиском
- Плейлисты: создание, редактирование, совместное прослушивание
- Альбомы и артисты — полная навигация по каталогу

**Удобный интерфейс**
- Тёмная тема, заточенная под AMOLED-экраны
- Жесты: свайп назад, свайп для очереди, pull-to-refresh
- Компактный плеер внизу экрана + развёрнутый режим
- Адаптивная иконка (Material You)

**Фоновое воспроизведение и системная интеграция**
- MediaStyle-уведомление с управлением (Play/Pause, Next/Prev, лайк)
- Управление с блокировки экрана и быстрых настроек
- Медиа-клавиши на наушниках / Bluetooth
- Android Auto (базовая поддержка)

**Приватность и автономность**
- Нет лишних разрешений (только Интернет, Фронт-сервис, Уведомления)
- Токен хранится локально, не уходит к третьим сторонам
- Работает без Google Play Services
- Кэширование обложек для экономии трафика

---

## 📝 Полное описание (EN)

**Muse** — a modern, fast, and convenient player for Yandex Music.

### 🎵 Key features:

**Seamless streaming**
- High-quality audio (up to 320 kbps / lossless with Plus subscription)
- Instant track start — zero latency
- Smart queue with auto-extend via similar tracks ("My Wave")

**Radio & recommendations**
- Personal radio stations based on your taste
- Genre, mood, and artist-based stations
- Like/Dislike feedback to improve recommendations

**Your music library**
- Liked tracks — instant access
- Listening history with search
- Playlists: create, edit, collaborative listening
- Full artist & album navigation

**Polished UI**
- True dark theme optimised for AMOLED
- Gestures: swipe back, swipe for queue, pull-to-refresh
- Compact bottom player + expanded fullscreen mode
- Adaptive icon (Material You)

**Background playback & system integration**
- MediaStyle notification with controls (Play/Pause, Next/Prev, Like)
- Lock screen & quick settings control
- Headset / Bluetooth media buttons
- Android Auto (basic support)

**Privacy & autonomy**
- Minimal permissions (Internet, Foreground Service, Notifications only)
- Token stored locally, never sent to third parties
- Works without Google Play Services
- Cover art caching to save bandwidth

---

## 🖼 Графические материалы

### Иконка приложения
- **Файл:** `store/rustore/icon-512.png` (512×512)
- **Стиль:** Тёмный винил + оранжевая кнопка Play, adaptive icon
- **Safe zone:** 66dp (иконка масштабируется корректно)

### Скриншоты (7 шт., 1080×1920, 9:16)
| Файл | Описание |
|------|----------|
| `01-home.png` | Главная — «Моя волна» с активным треком |
| `02-search.png` | Поиск треков, артистов, альбомов |
| `03-radio.png` | Персональное радио / Моя волна |
| `04-favorites.png` | Избранные треки (Лайки) |
| `05-history.png` | История прослушиваний |
| `06-playlists.png` | Мои плейлисты |
| `07-artist.png` | Страница артиста (треки, альбомы, похожие) |

**Стиль:** Telegram Dark — тёмный фон `#0b0b10`, телефон в скруглённой рамке, акцент `#ff3c00`.

### Feature Graphic (обложка в магазине)
- **Размер:** 1024×500
- **Файл:** `store/rustore/feature-graphic.png` (нужно создать на основе бренда)

---

## 📋 Чек-лист требований RuStore

### ✅ Обязательные (выполнено)
- [x] Подписанный Release APK / AAB (`app-release.apk`)
- [x] Package ID: `com.ymplayer.app`
- [x] Version Code: 1, Version Name: 1.0
- [x] Min SDK 24, Target SDK 36
- [x] Иконка 512×512 (PNG, без прозрачности по краям)
- [x] Минимум 2 скриншота (готов 7 шт. 1080×1920)
- [x] Название приложения (RU/EN)
- [x] Краткое описание (до 80 символов)
- [x] Полное описание (до 4000 символов)
- [x] Категория: Музыка и аудио → Плееры
- [x] Возрастной рейтинг: 3+
- [x] Политика конфиденциальности (см. ниже)

### ⚠️ Требуют ваших данных
- [ ] **Политика конфиденциальности** — нужно разместить на вебе (GitHub Pages / свой сайт) и дать ссылку
- [ ] **Контакты разработчика** — email для поддержки (обязательно для RuStore)
- [ ] **Feature Graphic** 1024×500 — обложка в каталоге

### 📄 Политика конфиденциальности (шаблон)
```
Приложение Muse не собирает персональные данные.
Используется только токен авторизации Яндекс (OAuth), который хранится локально на устройстве.
Сетевые запросы идут только на api.music.yandex.net и music.yandex.net.
Нет аналитики, трекеров, рекламы.
Полный текст: [ВАША_ССЫЛКА_НА_ПОЛИТИКУ]
```

---

## 🚀 Команды для сборки

```bash
# Полная сборка релиза
cd ym-player
npm run build
npx cap sync android
cd android
./gradlew assembleRelease
# APK: android/app/build/outputs/apk/release/app-release.apk
# AAB: android/app/build/outputs/bundle/release/app-release.aab
```

---

## ⚠️ Важные примечания

1. **Неофициальный клиент** — в описании НЕ используйте логотип Яндекса, фразу «Официальный клиент» и т.п. RuStore может отклонить за нарушение ТЗ.
2. **Подпись** — keystore: `android/app/muse-release.keystore`, пароль: `muse2026`. **Сохраните файл ключа** — без него обновления невозможны.
3. **ADB установка** — `adb install -r app-release.apk` (флаг `-r` для переустановки).
4. **Тестирование на устройстве** — проверено на физическом смартфоне (RFCRA1PED6D): иконка применяется, сплэш-скрина нет, артисты кликабельны.

---

## 📞 Следующие шаги (ваша зона ответственности)

1. Разместите **политику конфиденциальности** в сети (GitHub Pages / свой домен).
2. Укажите **email поддержки** для консоли RuStore.
3. (Опционально) Создайте **Feature Graphic 1024×500** в брендовом стиле.
4. Зайдите в [RuStore Console](https://console.rustore.ru/) → «Создать приложение» → загрузите APK + материалы.
5. После модерации (1–3 дня) приложение будет доступно для установки.

---

**Файлы готовы к загрузке:**
- `android/app/build/outputs/apk/release/app-release.apk` — релизный APK
- `store/rustore/*.png` — 7 скриншотов 1080×1920
- `store/rustore/icon-512.png` — иконка для магазина
- `RUSTORE_LISTING.md` — этот файл (скопируйте тексты в консоль)