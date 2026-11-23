import { Link } from 'react-router-dom'
import type { ReactNode } from 'react'
import { artistNames, coverUrl, formatCount, PLACEHOLDER_COVER } from '../core/format'
import type { Album, Artist, Playlist } from '../core/types'
import { IconPlay } from './icons'

function Img({ src, alt }: { src?: string; alt: string }) {
  return (
    <img
      src={src ?? PLACEHOLDER_COVER}
      alt={alt}
      loading="lazy"
      onError={(e) => ((e.target as HTMLImageElement).src = PLACEHOLDER_COVER)}
    />
  )
}

export function AlbumCard({ album, big }: { album: Album; big?: boolean }) {
  return (
    <Link to={`/album/${album.id}`} className="card" title={album.title}>
      <div className="card-cover">
        <Img src={coverUrl(album.coverUri, big ? '300x300' : '200x200')} alt="" />
        <div className="card-play"><IconPlay size={14} /></div>
      </div>
      <div className="card-title">{album.title}</div>
      <div className="card-sub">{artistNames(album.artists)}</div>
    </Link>
  )
}

export function PlaylistCard({ playlist }: { playlist: Playlist }) {
  const uri = playlist.cover?.uri ?? playlist.coverUri
  return (
    <Link to={`/playlist/${playlist.kind ?? ''}`} className="card" title={playlist.title}>
      <div className="card-cover">
        <Img src={coverUrl(uri, '200x200')} alt="" />
        <div className="card-play"><IconPlay size={14} /></div>
      </div>
      <div className="card-title">{playlist.title ?? 'Без названия'}</div>
      <div className="card-sub">
        {playlist.trackCount != null ? formatCount(playlist.trackCount) + ' треков' : ''}
        {playlist.owner?.name ? ' · ' + playlist.owner.name : ''}
      </div>
    </Link>
  )
}

export function ArtistCard({ artist }: { artist: Artist }) {
  return (
    <Link to={`/artist/${artist.id}`} className="card" title={artist.name}>
      <div className="card-cover round">
        <Img src={coverUrl(artist.cover?.uri, '200x200')} alt="" />
        <div className="card-play"><IconPlay size={14} /></div>
      </div>
      <div className="card-title">{artist.name}</div>
      <div className="card-sub">{artist.counts?.tracks ? formatCount(artist.counts.tracks) + ' треков' : ''}</div>
    </Link>
  )
}

export function Grid({ children }: { children: ReactNode }) {
  return <div className="cards">{children}</div>
}

export function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="section">
      <h2 className="section-title">{title}</h2>
      {children}
    </section>
  )
}