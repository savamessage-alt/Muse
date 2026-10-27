# Протокол Ynison — синхронизация плееров (заметки для реализации)

> Суть: **WebSocket + JSON-фреймы** (хотя внутри сервиса protobuf, наружу — camelCase-JSON). Бинарный protobuf писать не нужно. Источник: `yandex_music/ynison/*` из MarshalX/yandex-music-api.

## Общая схема

```
1. wss://ynison.music.yandex.ru/redirector.YnisonRedirectService/GetRedirectToYnison
   (subprotocols: ['Bearer', 'v2', urlquote(JSON метаданных устройства)])
   → сервер присылает ОДИН JSON-фрейм и закрывает соединение:
     { "host": "...", "redirect_ticket": "...", "session_id": 123,
       "keep_alive_params": {"keep_alive_time_seconds": 15, "keep_alive_timeout_seconds": 5} }

2. wss://{host}/ynison_state.YnisonStateService/PutYnisonState
   (те же subprotocols, но в JSON метаданных добавляются
    Ynison-Redirect-Ticket и Ynison-Session-Id)
   заголовки: Origin: https://music.yandex.ru, Authorization: OAuth <music token>

3. Дальше обе стороны шлют JSON-фреймы (имена полей — camelCase).
```

## Метаданные устройства (subprotocol #3)

```json
{
  "Ynison-Device-Id": "12-hex-symbols",
  "Ynison-Device-Info": "{\"app_name\":\"YM Player\",\"type\":\"1\"}",
  "Ynison-Redirect-Ticket": "<из шага 1>",
  "Ynison-Session-Id": "123"
}
```
`type: "1"` = браузеры. `Ynison-Device-Info` — вложенный JSON-строка, так требует сервер.

## Формат исходящих запросов (PutYnisonStateRequest)

Общие поля каждого фрейма:

| Поле (camelCase) | Тип | Смысл |
|---|---|---|
| `rid` | string (uuid) | id запроса |
| `playerActionTimestampMs` | int (ms) | время действия |
| `activityInterceptionType` | enum-string | `DO_NOT_INTERCEPT_BY_DEFAULT` |
| `updateFullState` / `updatePlayerState` / `updatePlayingStatus` / `updateVolumeInfo` | message | что именно обновляем |

### updateFullState (регистрация устройства)
```json
{
  "playerState": {
    "playerQueue": {
      "currentPlayableIndex": -1,
      "options": { "repeatMode": "NONE" },
      "version": { "deviceId": "<deviceId>" },
      "entityId": "",
      "entityType": "VARIOUS",
      "entityContext": "BASED_ON_ENTITY_BY_DEFAULT",
      "fromOptional": ""
    },
    "status": {
      "paused": true,
      "playbackSpeed": 1,
      "version": { "deviceId": "<deviceId>", "timestampMs": 0 }
    }
  },
  "device": {
    "capabilities": { "canBePlayer": false, "canBeRemoteController": true, "volumeGranularity": 0 },
    "info": { "deviceId": "<deviceId>", "type": "WEB", "title": "YM Player", "appName": "ym-player" },
    "volumeInfo": { "volume": 0 }
  },
  "isCurrentlyActive": false
}
```

### updatePlayerState (текущая очередь/трек)
```json
{
  "playerState": {
    "playerQueue": {
      "currentPlayableIndex": 3,
      "version": { "deviceId": "<deviceId>", "version": 123, "timestampMs": 1690000000000 },
      "playableList": [ { "playableId": "123456", "albumIdOptional": "7890", "title": "..." } ],
      "entityId": "<id очереди/сущности>",
      "entityType": "VARIOUS",
      "entityContext": "BASED_ON_ENTITY_BY_DEFAULT",
      "fromOptional": ""
    },
    "status": { "progressMs": 0, "durationMs": 0, "paused": false, "playbackSpeed": 1,
                "version": { "deviceId": "<deviceId>", "version": 124, "timestampMs": 1690000000001 } }
  }
}
```

### updatePlayingStatus (прогресс/пауза)
```json
{ "playingStatus": { "progressMs": 120000, "durationMs": 200000, "paused": false,
                     "playbackSpeed": 1, "version": { "deviceId": "<deviceId>", "version": 125, "timestampMs": 1690000000002 } } }
```

### updateVolumeInfo (громкость другого устройства)
```json
{ "deviceId": "<target deviceId>", "volumeInfo": { "volume": 0.7,
  "version": { "deviceId": "<deviceId>", "version": 126, "timestampMs": 1690000000003 } } }
```

### Номера полей protobuf (если пригодится бинарный режим)
Сверены с `yandex_music/ynison/models/ynison_state.py`:

- `UpdateVersion`: device_id=1, version=2, timestamp_ms=3
- `PlayerQueue`: entity_id=1, entity_type=2, current_playable_index=3, playable_list=4, options=5, version=6, shuffle=7, entity_context=8, from=9, initial_entity=10, queue=12
- `Playable`: playable_id=1, album_id_optional=2, playable_type=3, from=4, title=5, cover_url_optional=6, additional_info=7/8
- `PlayerState`: player_queue=1, status=2
- `PlayingStatus`: progress_ms=1, duration_ms=2, paused=3, playback_speed=4, version=5
- `Device`: info=1, volume=2, capabilities=3, volume_info=4
- `UpdateFullState`: player_state=1, is_currently_active=2, device=3
- `PutYnisonStateRequest`: update_full_state=1 (и т.д. по порядку объявления), player_action_timestamp_ms предпоследним, activity_interception_type последним

## Входящие фреймы (PutYnisonStateResponse)

Из `_parse_state_frame` — JSON, поля camelCase. Полезные:
- `player_state.player_queue.playable_list[]: [{playable_id, album_id_optional, title, ...}]` — очередь на активном устройстве
- `player_state.player_queue.current_playable_index`
- `player_state.status: {paused, progress_ms?, duration_ms?, playback_speed}`
- `active_device_id` — чьё устройство сейчас ведущее
- `devices[]: [{device_id, info: {title, type}, volume_info: {volume}, capabilities}]`
- `timestamp_ms`

Логика обработки в YM Player (`src/core/ynison.ts`):
- если `active_device_id != наш` и сменился трек → подхватываем трек (`playable_id` / `album_id_optional`) и играем (с учётом `paused`);
- изменился `paused` → пауза/продолжение;
- `updateVolumeInfo` применяем только если цель — наше устройство.

## Keep-alive
- Браузерный WebSocket не умеет `ping()`. Решение: раз в N секунд (из `keep_alive_params`, минимум 8–15 с) переотправляем последний фрейм состояния. При разрыве — reconnect с экспоненциальной задержкой (3 с → 30 с), как в `_base.py` (`_backoff_ms`).

## Ошибки
- Сервер может вернуть фрейм `{"error": {...}}` — вложенные поля `ynison_error_code`, `extra_headers`, `ynison_backoff_millis`, `ynison_go_away_for_seconds` (`_base.py`/`errors.py`). При `ynison_backoff_millis` — увеличить паузу переподключения.
- HTTP 401/403 при handshake = токен отклонён → терминальная ошибка, нужен повторный вход.
