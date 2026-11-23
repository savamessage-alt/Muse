import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useApp } from '../state/store'
import { IconBack, IconMusicNote, IconInfo, IconTrash, IconClock, IconPhone, IconCode, IconBug, IconSettings } from './icons'

const APP_VERSION = import.meta.env.VITE_APP_VERSION ?? '0.1.0'

function formatMs(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000)
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  if (hours > 0) return `${hours}ч ${minutes}м ${seconds}с`
  if (minutes > 0) return `${minutes}м ${seconds}с`
  return `${seconds}с`
}

export default function AboutPage() {
  const navigate = useNavigate()
  const showToast = useApp((s) => s.showToast)
  const listeningStats = useApp((s) => s.listeningStats)

  const [deviceInfo, setDeviceInfo] = useState<{
    model?: string
    platform?: string
    osVersion?: string
    appVersion?: string
    appBuild?: string
    uuid?: string
    webViewVersion?: string
    manufacturer?: string
    isVirtual?: boolean
  }>({})

  const loadDeviceInfo = async () => {
    try {
      const Device = (window as any).Capacitor?.Plugins?.Device
      if (Device) {
        const info = await Device.getInfo()
        setDeviceInfo({
          model: info.model,
          platform: info.platform,
          osVersion: info.osVersion,
          appVersion: info.appVersion,
          appBuild: info.appBuild,
          uuid: info.uuid,
          webViewVersion: info.webViewVersion,
          manufacturer: info.manufacturer,
          isVirtual: info.isVirtual,
        })
      }
    } catch {
      /* Device API недоступен на вебе */
    }
  }

  useEffect(() => {
    loadDeviceInfo()
  }, [])

  const goBack = () => navigate(-1)

  const clearCache = async () => {
    try {
      localStorage.removeItem('ym.quality')
      showToast('Кэш очищен')
    } catch (e) {
      showToast('Не удалось очистить кэш: ' + (e as Error).message, 'error')
    }
  }

  return (
    <div className="about-page">
      <div className="about-header">
        <button className="icon-btn small" onClick={goBack} aria-label="Назад">
          <IconBack size={18} />
        </button>
        <div className="about-brand">
          <div className="about-disc" aria-hidden>
            <div className="about-disc-core">
              <IconMusicNote size={32} fill="currentColor" />
            </div>
          </div>
          <div>
            <div className="about-name">Muse</div>
            <div className="about-version">Версия {APP_VERSION}</div>
          </div>
        </div>
      </div>

      <section className="about-card">
        <h2 className="about-section-title">
          <IconClock size={16} fill="currentColor" /> Время прослушивания
        </h2>
        <div className="about-stats-grid">
          <div className="about-stat">
            <div className="about-stat-value">{formatMs(listeningStats.today)}</div>
            <div className="about-stat-label">Сегодня</div>
          </div>
          <div className="about-stat">
            <div className="about-stat-value">{formatMs(listeningStats.week)}</div>
            <div className="about-stat-label">За неделю</div>
          </div>
          <div className="about-stat">
            <div className="about-stat-value">{formatMs(listeningStats.month)}</div>
            <div className="about-stat-label">За месяц</div>
          </div>
          <div className="about-stat">
            <div className="about-stat-value">{formatMs(listeningStats.all)}</div>
            <div className="about-stat-label">За всё время</div>
          </div>
        </div>
      </section>

      <section className="about-card">
        <h2 className="about-section-title">
          <IconInfo size={16} fill="currentColor" /> Приложение
        </h2>
        <div className="about-row">
          <span className="about-label">Пакет</span>
          <span className="about-value">com.ymplayer.app</span>
        </div>
        <div className="about-row">
          <span className="about-label">Сборка</span>
          <span className="about-value">{deviceInfo.appBuild ?? '—'}</span>
        </div>
        <div className="about-row">
          <span className="about-label">Платформа</span>
          <span className="about-value">{deviceInfo.platform ?? 'Web'}</span>
        </div>
      </section>

      <section className="about-card">
        <h2 className="about-section-title">
          <IconPhone size={16} fill="currentColor" /> Устройство
        </h2>
        <div className="about-row">
          <span className="about-label">Модель</span>
          <span className="about-value">{deviceInfo.model ?? '—'}</span>
        </div>
        <div className="about-row">
          <span className="about-label">Производитель</span>
          <span className="about-value">{deviceInfo.manufacturer ?? '—'}</span>
        </div>
        <div className="about-row">
          <span className="about-label">ОС</span>
          <span className="about-value">
            {deviceInfo.platform && deviceInfo.osVersion ? deviceInfo.platform + ' ' + deviceInfo.osVersion : '—'}
          </span>
        </div>
        <div className="about-row">
          <span className="about-label">UID устройства</span>
          <span className="about-value">{deviceInfo.uuid ? deviceInfo.uuid.slice(0, 12) + '…' : '—'}</span>
        </div>
      </section>

      <section className="about-card">
        <h2 className="about-section-title">
          <IconCode size={16} fill="currentColor" /> Технологии
        </h2>
        <div className="about-row">
          <span className="about-label">Стек</span>
          <span className="about-value">React 19 · TypeScript · Vite · Zustand</span>
        </div>
        <div className="about-row">
          <span className="about-label">Маршрутизация</span>
          <span className="about-value">HashRouter · Capacitor 8</span>
        </div>
        <div className="about-row">
          <span className="about-label">Иконки</span>
          <span className="about-value">lucide-react</span>
        </div>
      </section>

      <section className="about-card">
        <h2 className="about-section-title">
          <IconBug size={16} fill="currentColor" /> API и поток
        </h2>
        <div className="about-row">
          <span className="about-label">API</span>
          <span className="about-value">API Яндекс Музыки · OAuth 2.0</span>
        </div>
        <div className="about-row">
          <span className="about-label">Кодеки</span>
          <span className="about-value">MP3 320/192/128 · HLS · AAC · подпись MD5</span>
        </div>
      </section>

      <section className="about-card">
        <h2 className="about-section-title">
          <IconSettings size={16} fill="currentColor" /> Действия
        </h2>
        <div className="about-actions">
          <button className="btn danger" onClick={clearCache}>
            <IconTrash size={16} fill="currentColor" /> Очистить кэш
          </button>
        </div>
      </section>

      <div className="about-footer">
        <p className="about-copyright">Muse — неофициальный клиент Яндекс Музыки</p>
        <p className="about-copyright small">
          Яндекс и логотип Яндекса — товарные знаки ООО «Яндекс».
        </p>
      </div>
    </div>
  )
}
