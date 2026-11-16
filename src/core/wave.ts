// ============================================================
// «Моя волна»: настройки станции и подбор жанров/настроений.
// Запись настроек через API Яндекса закрыта для сторонних клиентов
// (405 method-not-allowed), но список seed-параметров и жанровые станции
// принимаются — передаём их в запросе треков и реально управляем выдачей.
// Все настройки комбинируются: можно передать несколько seed одновременно.
// ============================================================

import { ymClient } from './client'
import type { Track } from './types'

export const WAVE = { type: 'user', tag: 'onyourwave' } as const

/** Пресеты настроения — через seed-параметр settingMoodEnergy */
export const MOOD_PRESETS = [
  { value: 'fun', name: 'Весёлое', seed: 'settingMoodEnergy:fun', icon: '😄' },
  { value: 'active', name: 'Бодрое', seed: 'settingMoodEnergy:active', icon: '⚡' },
  { value: 'calm', name: 'Спокойное', seed: 'settingMoodEnergy:calm', icon: '🌙' },
  { value: 'sad', name: 'Грустное', seed: 'settingMoodEnergy:sad', icon: '💧' },
] as const

/** Уровни энергии — независимая шкала 1..4, комбинируется с настроением */
export const ENERGY_LEVELS = [
  { value: 1, name: 'Минимум', seed: 'settingEnergy:E1' },
  { value: 2, name: 'Спокойно', seed: 'settingEnergy:E2' },
  { value: 3, name: 'Активно', seed: 'settingEnergy:E3' },
  { value: 4, name: 'Максимум', seed: 'settingEnergy:E4' },
] as const

/** Язык треков */
export const LANGUAGE_PRESETS = [
  { value: 'any', name: 'Любой', seed: null },
  { value: 'russian', name: 'Русский', seed: 'settingLanguage:russian' },
  { value: 'not-russian', name: 'Иностранный', seed: 'settingLanguage:not-russian' },
  { value: 'without-words', name: 'Без слов', seed: 'settingLanguage:without-words' },
] as const

/** Характер / разнообразие выдачи */
export const DIVERSITY_PRESETS = [
  { value: 'favorite', name: 'Любимое', seed: 'settingDiversity:favorite' },
  { value: 'popular', name: 'Популярное', seed: 'settingDiversity:popular' },
  { value: 'discover', name: 'Незнакомое', seed: 'settingDiversity:discover' },
] as const

export const LANGUAGE_LABELS: Record<string, string> = {
  russian: 'русский',
  'not-russian': 'иностранный',
  'without-words': 'без слов',
}

/** Нормализованная станция (RadioStation приходит с вложенным .station) */
export interface SimpleStation {
  id: { type: string; tag: string }
  name: string
  icon?: { uri?: string } | null
}

/** Сырая станция из дашборда (с вложенным .station или плоская) */
interface RawStation {
  id?: { type?: string; tag?: string }
  name?: string
  icon?: { uri?: string } | null
}

/** Привести элементы дашборда к плоскому виду */
function flattenStations(stations: unknown[]): RawStation[] {
  const out: RawStation[] = []
  for (const s of stations) {
    if (!s || typeof s !== 'object') continue
    const obj = s as { station?: RawStation }
    const flat = obj.station ?? (s as RawStation)
    if (flat) out.push(flat)
  }
  return out
}

/** Найти станцию «Моя волна» в дашборде */
export async function findWaveStation(): Promise<SimpleStation | null> {
  const r = await ymClient.radioDashboard()
  const list = flattenStations((r.stations ?? []) as unknown[])
  const pick =
    list.find((s) => s.id?.type === 'user' && s.id?.tag === 'onyourwave') ??
    list.find((s) => s.id?.type === 'user') ??
    null
  if (!pick?.id?.type || !pick.id.tag) return null
  return {
    id: { type: pick.id.type, tag: pick.id.tag },
    name: pick.name ?? 'Моя волна',
    icon: pick.icon ?? null,
  }
}

/** Текущие сохранённые настройки аккаунта (только чтение) */
export function fetchWaveSettings(): Promise<{
  language?: string
  mood?: number
  energy?: number
  diversity?: string
}> {
  return ymClient.radioStationSettings(WAVE.type, WAVE.tag)
}

/** Жанр */
export interface Genre {
  tag: string
  name: string
}

/** Категория жанров */
export interface GenreCategory {
  id: string
  name: string
  genres: Genre[]
}

/** Категории жанров для удобного UI */
export const GENRE_CATEGORIES: GenreCategory[] = [
  {
    id: 'popular',
    name: 'Популярное',
    genres: [
      { tag: 'pop', name: 'Поп' },
      { tag: 'rock', name: 'Рок' },
      { tag: 'hip-hop', name: 'Хип-хоп' },
      { tag: 'rap', name: 'Рэп' },
      { tag: 'rnb', name: 'R&B' },
      { tag: 'indie', name: 'Инди' },
      { tag: 'alternative', name: 'Альтернатива' },
      { tag: 'kpop', name: 'K-Pop' },
    ],
  },
  {
    id: 'electronic',
    name: 'Электронная',
    genres: [
      { tag: 'electronic', name: 'Электроника' },
      { tag: 'techno', name: 'Техно' },
      { tag: 'house', name: 'Хаус' },
      { tag: 'trance', name: 'Транс' },
      { tag: 'dubstep', name: 'Дабстеп' },
      { tag: 'phonkgenre', name: 'Фонк' },
      { tag: 'disco', name: 'Диско' },
      { tag: 'funk', name: 'Фанк' },
      { tag: 'soul', name: 'Соул' },
    ],
  },
  {
    id: 'rock_metal',
    name: 'Рок и метал',
    genres: [
      { tag: 'metal', name: 'Метал' },
      { tag: 'hardrock', name: 'Хард-рок' },
      { tag: 'postrock', name: 'Пост-рок' },
      { tag: 'punk', name: 'Панк' },
      { tag: 'deathmetal', name: 'Дэт-метал' },
      { tag: 'blackmetal', name: 'Блэк-метал' },
      { tag: 'postmetal', name: 'Пост-метал' },
      { tag: 'grunge', name: 'Гранж' },
      { tag: 'postpunk', name: 'Пост-панк' },
      { tag: 'newwave', name: 'Новая волна' },
    ],
  },
  {
    id: 'chill',
    name: 'Чилл и эмбиент',
    genres: [
      { tag: 'ambient', name: 'Эмбиент' },
      { tag: 'chillout', name: 'Чиллаут' },
      { tag: 'lofi', name: 'Lo-Fi' },
      { tag: 'downtempo', name: 'Даунтемпо' },
      { tag: 'trip-hop', name: 'Трип-хоп' },
      { tag: 'newage', name: 'Нью-эйдж' },
      { tag: 'meditation', name: 'Медитация' },
      { tag: 'jazz', name: 'Джаз' },
      { tag: 'blues', name: 'Блюз' },
    ],
  },
  {
    id: 'classical',
    name: 'Классика и акустика',
    genres: [
      { tag: 'classical', name: 'Классика' },
      { tag: 'folk', name: 'Фолк' },
      { tag: 'country', name: 'Кантри' },
      { tag: 'celtic', name: 'Кельтика' },
      { tag: 'world', name: 'Этно-музыка' },
      { tag: 'opera', name: 'Опера' },
      { tag: 'videogame', name: 'Видеоигры' },
    ],
  },
  {
    id: 'latin_dance',
    name: 'Латина и танцы',
    genres: [
      { tag: 'reggaeton', name: 'Реггетон' },
      { tag: 'reggae', name: 'Регги' },
      { tag: 'ska', name: 'Ска' },
      { tag: 'hardcore', name: 'Хардкор' },
      { tag: 'industrial', name: 'Индастриал' },
    ],
  },
]

/** Плоский список всех жанров для обратной совместимости */
export const GENRES: Genre[] = GENRE_CATEGORIES.flatMap(c => c.genres)

/** Собрать список seed-параметров из выборки пользователя */
export function buildSeeds(moodSeed?: string, energySeed?: string, langSeed?: string | null, divSeed?: string): string[] {
  const seeds: string[] = []
  if (moodSeed) seeds.push(moodSeed)
  if (energySeed) seeds.push(energySeed)
  if (langSeed) seeds.push(langSeed)
  if (divSeed) seeds.push(divSeed)
  return seeds
}

/** Получить треки «Моей волны» с учётом списка seed (настроение/энергия/язык/характер) */
export async function fetchWaveTracks(seeds: string[]): Promise<Track[]> {
  const res = await ymClient.radioStationTracksSeed(WAVE.type, WAVE.tag, seeds)
  return (res.sequence ?? [])
    .filter((x) => x.type === 'track' && x.track)
    .map((x) => x.track as Track)
}

/** Получить треки жанровой станции с учётом списка seed */
export async function fetchGenreTracks(tag: string, seeds: string[]): Promise<Track[]> {
  const res = await ymClient.radioStationTracksSeed('genre', tag, seeds)
  return (res.sequence ?? [])
    .filter((x) => x.type === 'track' && x.track)
    .map((x) => x.track as Track)
}