import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ymClient } from '../core/client'
import { coverUrl, formatCount, PLACEHOLDER_COVER } from '../core/format'
import type { Album, Artist, BriefInfo, Track } from '../core/types'
import TrackList, { playTracks } from './TrackList'
import { AlbumCard, ArtistCard, Grid, Section } from './cards'
import { IconBack, IconChevronDown, IconChevronUp, IconExternal, IconHeart, IconHeartFilled, IconMusicNote, IconPlay, IconShuffle, IconSpinner } from './icons'
import EmptyState from './EmptyState'

/** Описание артиста приходит строкой или объектом {text, uri} */
function descriptionText(d: unknown): string {
  if (!d) return ''
  if (typeof d === 'string') return d
  if (typeof d === 'object' && d !== null && 'text' in d) {
    const t = (d as { text?: unknown }).text
    return typeof t === 'string' ? t : ''
  }
  return ''
}

export default function ArtistPage() {
  const { id } = useParams<{ id: string }>()
  const nav = useNavigate()
  const [info, setInfo] = useState<BriefInfo | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [liked, setLiked] = useState(false)
  const [likedReady, setLikedReady] = useState(false)
  const [likeBusy, setLikeBusy] = useState(false)
  const [allTracks, setAllTracks] = useState<Track[] | null>(null)
  const [loadingTracks, setLoadingTracks] = useState(false)
  const [allAlbums, setAllAlbums] = useState<Album[] | null>(null)
  const [loadingAlbums, setLoadingAlbums] = useState(false)
  const [descOpen, setDescOpen] = useState(false)

  useEffect(() => {
    if (!id) return
    setInfo(null)
    setErr(null)
    setLiked(false)
    setLikedReady(false)
    setAllTracks(null)
    setAllAlbums(null)
    setDescOpen(false)
    ymClient
      .artistBriefInfo(id)
      .then((b) => setInfo(b))
      .catch((e) => setErr('Не удалось загрузить артиста: ' + (e as Error).message))
    ymClient
      .usersLikesArtists()
      .then((s) => {
        setLiked(s.has(String(id)))
        setLikedReady(true)
      })
      .catch(() => setLikedReady(true))
  }, [id])

  const toggleArtistLike = async () => {
    if (likeBusy || !id) return
    setLikeBusy(true)
    const next = !liked
    setLiked(next)
    try {
      if (next) await ymClient.artistsLikeAdd([id])
      else await ymClient.artistsLikeRemove([id])
    } catch {
      setLiked(!next)
    } finally {
      setLikeBusy(false)
    }
  }

  const loadAllTracks = async () => {
    if (!id || loadingTracks) return
    setLoadingTracks(true)
    try {
      const res = await ymClient.artistAllTracks(id, 0, 100)
      setAllTracks(res.tracks?.items ?? [])
    } catch {
      setAllTracks([])
    } finally {
      setLoadingTracks(false)
    }
  }

  const loadAllAlbums = async () => {
    if (!id || loadingAlbums) return
    setLoadingAlbums(true)
    try {
      const results = await Promise.allSettled([ymClient.artistAlbums(id, 0, 50), ymClient.artistAlbums(id, 1, 50)])
      const items: Album[] = []
      for (const r of results) {
        if (r.status === 'fulfilled') items.push(...(r.value.albums?.items ?? []))
      }
      const seen = new Set<string>()
      setAllAlbums(items.filter((a) => (seen.has(a.id) ? false : (seen.add(a.id), true))))
    } catch {
      setAllAlbums([])
    } finally {
      setLoadingAlbums(false)
    }
  }

  if (err) {
    return (
      <div className="error-box">
        <p>{err}</p>
      </div>
    )
  }
  if (!info) return <div className="spinner" />

  const artist = info.artist
  const popular: Track[] = (info.popularTracks?.length ? info.popularTracks : info.alsoTracks) ?? []
  const albums: Album[] = info.albums ?? []
  const similar: Artist[] = info.similarArtists ?? []
  const desc = descriptionText(artist?.description)
  const links = (info.links ?? []).filter((l) => l.url)
  const listeners = info.stats?.lastMonthListeners
  const delta = info.stats?.lastMonthListenersDelta
  const trackCount = artist?.counts?.tracks ?? info.counts?.tracks
  const albumCount = artist?.counts?.albums ?? info.counts?.directAlbums
  const genres = artist?.genres ?? []

  return (
    <div className="entity-page">
      <div className="entity-head">
        <img
          className="entity-cover round"
          src={coverUrl(artist?.cover?.uri, '300x300') ?? PLACEHOLDER_COVER}
          alt=""
          onError={(e) => ((e.target as HTMLImageElement).src = PLACEHOLDER_COVER)}
        />
        <div className="entity-info">
          <div className="entity-type">Артист</div>
          <h1 className="entity-title">{artist?.name ?? 'Артист'}</h1>

          {listeners != null && (
            <div className="artist-listeners">
              {formatCount(listeners)} слушателей за месяц
              {delta != null && delta !== 0 && (
                <span className={'artist-delta' + (delta > 0 ? ' up' : ' down')}>
                  {delta > 0 ? <IconChevronUp size={12} fill="currentColor" /> : <IconChevronDown size={12} fill="currentColor" />} {formatCount(Math.abs(delta))}
                </span>
              )}
            </div>
          )}

          <div className="entity-sub">
            {trackCount ? trackCount + ' треков' : ''}
            {albumCount ? ' · ' + albumCount + ' альбомов' : ''}
            {genres.length > 0 && <span className="artist-genres"> · {genres.slice(0, 3).join(', ')}</span>}
          </div>

          <div className="entity-actions">
            {popular.length > 0 && (
              <>
                <button className="primary-btn" onClick={() => playTracks(popular, 0, 'queue')}>
                  <IconPlay size={16} /> Играть
                </button>
                <button
                  className="icon-btn"
                  onClick={() => {
                    const shuffled = [...popular].sort(() => Math.random() - 0.5)
                    playTracks(shuffled, 0, 'queue')
                  }}
                  title="Перемешать"
                >
                  <IconShuffle size={18} />
                </button>
              </>
            )}
            {likedReady && (
              <button
                className={'icon-btn liked-outline' + (liked ? ' on' : '')}
                onClick={() => void toggleArtistLike()}
                disabled={likeBusy}
                title={liked ? 'Убрать из лайкнутых исполнителей' : 'Лайкнуть исполнителя'}
              >
                {liked ? <IconHeartFilled size={20} /> : <IconHeart size={20} />}
              </button>
            )}
          </div>

          {links.length > 0 && (
            <div className="artist-links">
              {links.slice(0, 5).map((l) => {
                const url = l.url ?? l.href ?? ''
                if (!url) return null
                const label = l.title ?? l.socialNetwork ?? 'Ссылка'
                return (
                  <a
                    key={url}
                    className="artist-social"
                    href={url}
                    target="_blank"
                    rel="noreferrer noopener"
                    title={l.subtitle ?? url}
                  >
                    {label} <IconExternal size={12} />
                  </a>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {desc && (
        <div className={'artist-bio' + (descOpen ? ' open' : '')}>
          <p>{descOpen ? desc : desc.slice(0, 260) + (desc.length > 260 ? '…' : '')}</p>
          {desc.length > 260 && (
            <button className="link-btn" onClick={() => setDescOpen((v) => !v)}>
              {descOpen ? 'Свернуть' : 'Читать полностью'}
            </button>
          )}
        </div>
      )}

      {popular.length > 0 && (
        <Section title="Популярные треки">
          <TrackList tracks={popular} />
        </Section>
      )}

      {popular.length > 0 && !allTracks && (
        <button className="more-btn" onClick={() => void loadAllTracks()} disabled={loadingTracks}>
          {loadingTracks ? (
            <>
              <IconSpinner size={16} /> Загружаем…
            </>
          ) : (
            'Показать все треки'
          )}
        </button>
      )}

      {allTracks && allTracks.length > 0 && (
        <Section title={'Все треки · ' + allTracks.length}>
          <TrackList tracks={allTracks} />
        </Section>
      )}

      {(albums.length > 0 || allAlbums) && (
        <Section title="Альбомы">
          <Grid>
            {(allAlbums ?? albums).map((a) => (
              <AlbumCard key={a.id} album={a} />
            ))}
          </Grid>
          {!allAlbums && albums.length >= 9 && (
            <button className="more-btn" onClick={() => void loadAllAlbums()} disabled={loadingAlbums}>
              {loadingAlbums ? (
                <>
                  <IconSpinner size={16} /> Загружаем…
                </>
              ) : (
                'Показать все альбомы'
              )}
            </button>
          )}
        </Section>
      )}

      {similar.length > 0 && (
        <Section title="Похожие исполнители">
          <Grid>
            {similar.slice(0, 12).map((a) => (
              <ArtistCard key={a.id} artist={a} />
            ))}
          </Grid>
        </Section>
      )}
    </div>
  )
}
