import { useEffect, useMemo } from 'react'
import { IconMusicNote } from './icons'

/** Форматирует строку текста песни: пустые строки пропускаем. */
export function useLyricLines(lyric: string): string[] {
  return useMemo(() => {
    if (!lyric) return []
    return lyric
      .replace(/\r\n?/g, '\n')
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.length > 0)
  }, [lyric])
}

export function LyricsPanel({ lyric }: { lyric: string }) {
  const lines = useLyricLines(lyric)

  useEffect(() => {
    // прокрутка не нужна — панель сама скроллится через .pb-lyrics-body
  }, [lines.length])

  if (!lines.length) {
    return (
      <div className="lyrics-state">
        <IconMusicNote size={34} />
        <div className="lyrics-state-text">Для этого трека текст пока недоступен</div>
      </div>
    )
  }

  return (
    <div className="lyrics-plain">
      {lines.map((line, i) => (
        <div key={i} className="lyrics-plain-line">
          {line}
        </div>
      ))}
    </div>
  )
}