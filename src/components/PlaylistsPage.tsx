import { useState } from 'react'
import { useApp } from '../state/store'
import { PlaylistCard, Grid } from './cards'
import { IconPlus } from './icons'

export default function PlaylistsPage() {
  const playlists = useApp((s) => s.playlists)
  const createPlaylist = useApp((s) => s.createPlaylist)
  const [creating, setCreating] = useState(false)
  const [title, setTitle] = useState('')

  const submit = async () => {
    const t = title.trim()
    if (!t) return
    const pl = await createPlaylist(t)
    if (pl) {
      setTitle('')
      setCreating(false)
    }
  }

  return (
    <div>
      <div className="page-head">
        <h1 className="page-title">Мои плейлисты</h1>
        <button className="primary-btn" onClick={() => setCreating((v) => !v)}>
          <IconPlus size={16} /> Создать плейлист
        </button>
      </div>

      {creating && (
        <div className="create-box">
          <input
            className="input"
            placeholder="Название плейлиста"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && void submit()}
            autoFocus
          />
          <button className="primary-btn small" onClick={() => void submit()} disabled={!title.trim()}>
            Создать
          </button>
        </div>
      )}

      {playlists.length ? (
        <Grid>
          {playlists.map((p) => (
            <PlaylistCard key={p.kind} playlist={p} />
          ))}
        </Grid>
      ) : (
        <p className="muted pad">Плейлистов пока нет — создайте первый!</p>
      )}
    </div>
  )
}