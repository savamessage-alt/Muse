// ============================================================
// Тема оформления: тёмная (по умолчанию) и светлая.
// Хранит выбор в localStorage и выставляет data-theme на <html>.
// Все цвета в index.css заданы через CSS-переменные, поэтому
// достаточно переключить атрибут — перекрашивается весь интерфейс.
// ============================================================

export type Theme = 'dark' | 'light'

const KEY = 'ym.theme'

export function getTheme(): Theme {
  try {
    return localStorage.getItem(KEY) === 'light' ? 'light' : 'dark'
  } catch {
    return 'dark'
  }
}

export function applyTheme(theme: Theme): void {
  try {
    document.documentElement.setAttribute('data-theme', theme)
  } catch {
    /* ignore */
  }
}

export function setTheme(theme: Theme): void {
  try {
    localStorage.setItem(KEY, theme)
  } catch {
    /* ignore */
  }
  applyTheme(theme)
}

/** Применить сохранённую тему при старте (вызывать как можно раньше) */
export function initTheme(): void {
  applyTheme(getTheme())
}