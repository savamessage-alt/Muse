import { useState } from 'react'
import { useApp } from '../state/store'
import { PlaylistCard, Grid } from './cards'
import DropdownMenu from './DropdownMenu'
import { IconPlus, IconMore, IconTrash, IconList, IconMusicNote } from './icons'
import type { Playlist } from '../core/types'

export default function PlaylistsPage() {
  const playlists = useApp((s) => s.playlists)
  const createPlaylist = useApp((s) => s.createPlaylist)
  const deletePlaylist = useApp((s) => s.deletePlaylist)
  const [creating, setCreating] = useState(false)
  const [title, setTitle] = useState('')
  const [menu, setMenu] = useState<{ pl: Playlist; el: HTMLElement } | null>(null)
  const [confirmDel, setConfirmDel] = useState<Playlist | null>(null)

  const submit = async () => {
    const t = title.trim()
    if (!t) return
    const pl = await createPlaylist(t)
    if (pl) {
      setTitle('')
      setCreating(false)
    }
  }

  const onDelete = async () => {
    const kind = confirmDel?.kind
    setConfirmDel(null)
    if (kind != null) await deletePlaylist(String(kind))
  }

  const ownUid = useApp((s) => s.user?.uid)
  const isOwn = (p: Playlist) => p.owner?.uid != null && p.owner.uid === ownUid

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
            <div className="card-wrap" key={p.kind}>
              <PlaylistCard playlist={p} />
              <button
                className={'icon-btn small card-more' + (menu?.pl === p ? ' active' : '')}
                onClick={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  setMenu(menu?.pl === p ? null : { pl: p, el: e.currentTarget })
                }}
                title="Действия с плейлистом"
                aria-label="Действия с плейлистом"
                aria-haspopup="menu"
              >
                <IconMore size={16} />
              </button>
            </div>
          ))}
        </Grid>
      ) : (
        <p className="muted pad">Плейлистов пока нет — создайте первый!</p>
      )}

      <DropdownMenu open={!!menu} anchor={menu?.el ?? null} onClose={() => setMenu(null)} minWidth={220}>
        <div className="dropdown-label">{menu?.pl.title || 'Без названия'}</div>
        <button
          className="dropdown-item danger"
          role="menuitem"
          disabled={!menu || !isOwn(menu.pl)}
          onClick={() => {
            if (!menu) return
            if (!isOwn(menu.pl)) {
              useApp.getState().showToast('Можно удалять только свои плейлисты', 'error')
              setMenu(null)
              return
            }
            setConfirmDel(menu.pl)
            setMenu(null)
          }}
        >
          <IconTrash size={15} /> Удалить плейлист
        </button>
        {!menu || !isOwn(menu.pl) ? (
          <div className="dropdown-empty">Чужой плейлист — только просмотр</div>
        ) : null}
      </DropdownMenu>

      {confirmDel && (
        <div className="confirm-overlay" onClick={() => setConfirmDel(null)}>
          <div className="confirm-box" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Удаление плейлиста">
            <div className="confirm-title">Удалить плейлист?</div>
            <div className="confirm-text">
              «{confirmDel.title || 'Без названия'}» будет удалён навсегда.
            </div>
            <div className="confirm-actions">
              <button className="primary-btn ghost" onClick={() => setConfirmDel(null)}>Отмена</button>
              <button className="primary-btn danger" onClick={() => void onDelete()}>
                <IconTrash size={15} /> Удалить
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}