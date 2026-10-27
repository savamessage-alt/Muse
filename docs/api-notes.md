# REST API Яндекс Музыки — заметки для реализации (TS)

Источник: исходники [`MarshalX/yandex-music-api`](https://github.com/MarshalX/yandex-music-api) (ветка main) и документация [ym.marshal.dev](https://ym.marshal.dev/). Порядок полей и пути сверены по коду библиотеки (папка `yandex_music/_client/`).

## Базовые факты

| Что | Значение |
|---|---|
| Базовый URL API | `https://api.music.yandex.net` |
| Базовый URL OAuth | `https://oauth.yandex.ru` |
| Заголовок клиента | `X-Yandex-Music-Client: YandexMusicAndroid/24023621` (значение по умолчанию из `yandex_music/utils/request_base.py`) |
| Авторизация | `Authorization: OAuth <access_token>` |
| Тело запросов | JSON, кроме OAuth (form-urlencoded) |
| CORS | API не отдаёт CORS-заголовки браузерам. Решения: Vite-прокси (dev), Electron main `net.fetch`, CapacitorHttp (Android), публичный CORS-прокси (собранный веб). |

## OAuth (Device Flow) — точные запросы

Взято из `yandex_music/_client/device_auth.py`. Никакого `scope` отправлять не нужно!

1. Получение кода устройства — `POST https://oauth.yandex.ru/device/code`
   теле: `client_id=23cabbbdc6cd418abb4b39c32c41195d`, `device_id=<10 случайных alnum>`, `device_name=YandexMusicAPI`
   ответ: `{ device_code, user_code, verification_url ("https://ya.ru/device"), expires_in (300), interval (5) }`
2. Опрос — `POST https://oauth.yandex.ru/token`
   теле: `grant_type=device_code`, `code=<device_code>` (именно `code`, не `device_code`), `client_id=...`, `client_secret=53bc75238f0c4d08a118e51fe9203300`
   ответ успеха: `{ access_token, refresh_token?, expires_in?, token_type }`
   ошибки (HTTP 400, JSON `{error, error_description}`): `authorization_pending` (ждём дальше), `slow_down`, `access_denied`, `expired_token`.

`client_id` и `client_secret` — публичные креды официального Android-приложения (захардкожены в библиотеке).

## Обновление токена (refresh)

- Поле `refresh_token` в ответе Device Flow — **опционально**; Яндекс не всегда его выдаёт.
- Если выдан: `POST https://oauth.yandex.ru/token` с `grant_type=refresh_token&refresh_token=...&client_id=...&client_secret=...` → новый `access_token` (+ новый `refresh_token`).
- Если `invalid_grant`/`invalid_token`/`unauthorized_client` — refresh-токен отозван, нужен повторный Device Flow.
- Библиотека НЕ обновляет токен сама: «Хранение токена — ответственность вызывающего кода» (README). В нашем приложении автообновление реализовано в `tokenManager`.

## Ключевые эндпоинты (сверено с путями в `_client/*.py`)

### Аккаунт
- `GET /me` — информация об аккаунте `{ account: {uid, login, displayName, ...} }` (fallback: `/account/status`)
- `GET /account/status` — `{ account, permissions, subscription, region, plus }`

### Треки
- `POST /tracks` — пакетное получение. Тело: `{"track-ids": ["id:albumId", ...], "with-positions": true}` (см. `_client/_batch.py`)
- `GET /tracks/{id}/download-info` — варианты загрузки: `{ items: [ { codec: 'mp3'|'aac'|'hls'|'flac', bitrateInKbps, directLink?, url? } ], s?, ts?, host?, path? }`. Если `directLink` нет — собираем ссылку сами: `https://<host><path>?s=<s>&ts=<ts>` (так делает `download_info.py`)
- `POST /tracks/{id}/supplement` (в исходниках — GET; сервер принимает оба, безопаснее GET) — доп. информация, тексты устарели
- `GET /tracks/{id}/lyrics?format=TEXT&timeStamp=<ts>&sign=<sign>` — текст песни. Подпись: `sign = b64(hmac_sha256(key='p93jhgh689SBReK6ghtw62', msg='<trackId><ts>'))` (см. `utils/sign_request.py`)
- `GET /tracks/{id}/similar` — похожие треки `{ similarTracks: [...] }`
- `GET /get-file-info?ts=&trackId=&quality=lossless|hq|nq&codecs=&transports=&sign=` — lossless. Заголовок `X-Yandex-Music-Client: YandexMusicDesktopAppWindows/5.95.0` + подпись ключом `kzqU4XhfCaY6B6JTHODeq5` (msg `'<ts><trackId><quality><codecs><transport>'`, b64 без `=`)

### Лайки
- `GET /users/{uid}/likes/tracks` → `{ library: { tracks: { items: [ {id, albumId, timestamp} ] } } }`
- `POST /users/{uid}/likes/tracks/add-multiple` тело `{"track-ids": [...]}`
- `POST /users/{uid}/likes/tracks/remove-multiple` тело `{"track-ids": [...]}`
- аналогично для albums/artists/playlists: `/users/{uid}/likes/{objectType}s[/{action}]`

### Плейлисты
- `GET /users/{uid}/playlists/list` — список `Playlist[]` (без полных треков)
- `GET /users/{uid}/playlists/{kind}` — плейлист с `tracks: TrackShort[] {id, albumId}`; разворачивать в полные треки через `POST /tracks`
- `POST /users/{uid}/playlists` тело `{"kinds": [...]}` — пакетно
- `POST /users/{uid}/playlists/create` тело `{"title", "visibility": "public"|"private"}`
- `POST /users/{uid}/playlists/{kind}/change` тело `{"diff": {"op_1": {"op": "insert"|"delete"|"move", ...}}}`

### Поиск
- `GET /search?text=...&type=all|track|album|artist|playlist&page=N` → `{ best, albums, artists, playlists, tracks: {total, perPage, items: TrackShort[]} }`
- `GET /search/suggest?part=...` — подсказки

### Каталог
- `GET /albums/{id}`, `GET /albums/{id}/with-tracks` (треки в `tracks.volumes[[]]`), `GET /albums/{id}/similar-entities`
- `GET /artists/{id}/brief-info` — `{ artist, albums, alsoTracks, similarArtists, counts }`
- `GET /artists/{id}/tracks?page&pageSize`, `GET /artists/{id}/direct-albums?page&pageSize`, `GET /artists/{id}/tracks/all`

### Лента
- `GET /feed` → `{ days: [{ day, events: [{type, track?, album?, playlist?, artist?}] }], canGetMoreEvents }`
- `GET /landing3` — большой лендинг (block'и); `GET /landing3/chart` — чарт

### Радио
- `GET /rotor/stations/dashboard` — станции `{ stations: [{station: {id: {type, tag}, name, icon}, id}] }` (внимание: **stations** во множественном числе)
- `GET /rotor/station/{type}:{tag}/tracks?shuffle=true` → `{ sequence: [{track: Track, type: 'track'}], batchId, ... }` — получаем порциями и добираем по мере проигрывания
- `POST /rotor/station/{type}:{tag}/feedback` тело `{"type": "radioStarted"|"radioFinished"|"like"|"dislike"|"skip"|"play"|"trackStarted"|"trackFinished", "timestamp": ISO, "from": trackId}`

### История
- `GET /music-history` → `{ history: { items: [{ id: {trackId, albumId, playlistId}, type, title, timestamp }] } }`

### Очередь
- `POST /queues` (индексация очереди для Ynison), `GET /queues/{id}`

### Ynison
- Ключи: `wss://ynison.music.yandex.ru/redirector.YnisonRedirectService/GetRedirectToYnison` → `{host, redirect_ticket, session_id, keep_alive_params}`; далее `wss://{host}/ynison_state.YnisonStateService/PutYnisonState` с subprotocols `['Bearer','v2', urlquote(JSON)]`. Подробный разбор — в `docs/ynison-protocol.md`.
