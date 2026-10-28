// Иконки (inline SVG, тёмная тема)
import type { SVGProps } from 'react'

type P = SVGProps<SVGSVGElement> & { size?: number }

function base({ size = 22, ...rest }: P): SVGProps<SVGSVGElement> {
  return {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'currentColor',
    stroke: 'none',
    ...rest,
  }
}

export const IconPlay = (p: P) => (
  <svg {...base(p)}><path d="M8 5v14l11-7z" /></svg>
)
export const IconPause = (p: P) => (
  <svg {...base(p)}><path d="M6 5h4v14H6zM14 5h4v14h-4z" /></svg>
)
export const IconNext = (p: P) => (
  <svg {...base(p)}><path d="M6 5l9 7-9 7V5zm10 0h3v14h-3V5z" /></svg>
)
export const IconPrev = (p: P) => (
  <svg {...base(p)}><path d="M18 5l-9 7 9 7V5zM8 5H5v14h3V5z" /></svg>
)
export const IconHeart = (p: P) => (
  <svg {...base(p)}><path d="M12 21s-7.5-4.7-10-9.3C.4 8.6 2.6 5 6 5c2 0 3.4 1.1 4 2.2h.6C11 6.1 12.4 5 14.4 5c3.4 0 5.6 3.6 4 6.7-2.5 4.6-10 9.3-10 9.3z" /></svg>
)
export const IconHeartFilled = (p: P) => (
  <svg {...base(p)}><path d="M12 21s-7.5-4.7-10-9.3C.4 8.6 2.6 5 6 5c2 0 3.4 1.1 4 2.2h.6C11 6.1 12.4 5 14.4 5c3.4 0 5.6 3.6 4 6.7-2.5 4.6-10 9.3-10 9.3z" /></svg>
)
export const IconSearch = (p: P) => (
  <svg {...base(p)}><path d="M15.5 14h-.8l-.3-.3a6.5 6.5 0 1 0-.7.7l.3.3v.8l5 5 1.5-1.5-5-5zm-6 0a4.5 4.5 0 1 1 0-9 4.5 4.5 0 0 1 0 9z" /></svg>
)
export const IconHome = (p: P) => (
  <svg {...base(p)}><path d="M12 3 2 12h3v9h6v-6h2v6h6v-9h3L12 3z" /></svg>
)
export const IconRadio = (p: P) => (
  <svg {...base(p)}><path d="M3.2 6.6A11 11 0 0 0 3.2 17l1.6-1.3a9 9 0 0 1 0-7.8L3.2 6.6zm3.4 2.8a6.4 6.4 0 0 0 0 5.2l1.7-1.4a4.4 4.4 0 0 1 0-2.4l-1.7-1.4zM12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6zm5.8-.6 3.2-3.2 1.4 1.4-3.2 3.2a9 9 0 0 1 0 5.2l3.2 3.2-1.4 1.4-3.2-3.2a11 11 0 0 0 0-8z" /></svg>
)
export const IconHistory = (p: P) => (
  <svg {...base(p)}><path d="M12 2a10 10 0 1 0 10 10h-2A8 8 0 1 1 12 4a8 8 0 0 1 7.4 5H16v2h6V5h-2v2.2A10 10 0 0 0 12 2zm-1 5v6l5 3 .9-1.6-4.1-2.4V7H11z" /></svg>
)
export const IconSettings = (p: P) => (
  <svg {...base(p)}><path d="M19.4 13a7.8 7.8 0 0 0 0-2l2-1.6-2-3.4-2.4 1a8 8 0 0 0-1.7-1L15 3.4h-4l-.3 2.6a8 8 0 0 0-1.7 1l-2.4-1-2 3.4 2 1.6a7.8 7.8 0 0 0 0 2l-2 1.6 2 3.4 2.4-1a8 8 0 0 0 1.7 1l.3 2.6h4l.3-2.6a8 8 0 0 0 1.7-1l2.4 1 2-3.4-2-1.6zM13 15.5A2.5 2.5 0 1 1 13 10.5a2.5 2.5 0 0 1 0 5z" /></svg>
)
export const IconQueue = (p: P) => (
  <svg {...base(p)}><path d="M3 6h13v2H3V6zm0 4h13v2H3v-2zm0 4h8v2H3v-2zm13.5-2.5 5 3-5 3v-6z" /></svg>
)
export const IconVolume = (p: P) => (
  <svg {...base(p)}><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3a4.5 4.5 0 0 0-2.5-4v8a4.5 4.5 0 0 0 2.5-4zM14 3.2v2.1a7 7 0 0 1 0 13.4v2.1a9 9 0 0 0 0-17.6z" /></svg>
)
export const IconRepeat = (p: P) => (
  <svg {...base(p)}><path d="M7 7h10l-3-3 1.4-1.4L21 8l-5.6 5.4L14 12l3-3H7v4H5V7h2zm10 10H7l3 3-1.4 1.4L3 16l5.6-5.4L10 12l-3 3h10v-4h2v4h-2z" /></svg>
)
export const IconShuffle = (p: P) => (
  <svg {...base(p)}><path d="M10.59 9.17 5.41 4 4 5.41l5.17 5.17 1.42-1.41zM14.5 4l2.04 2.04L4 18.59 5.41 20 17.96 7.46 20 9.5V4h-5.5zm.33 9.41-1.41 1.41 3.13 3.13L14.5 20H20v-5.5l-2.04 2.04-3.13-3.13z" /></svg>
)
export const IconPlus = (p: P) => (
  <svg {...base(p)}><path d="M11 5h2v6h6v2h-6v6h-2v-6H5v-2h6V5z" /></svg>
)
export const IconX = (p: P) => (
  <svg {...base(p)}><path d="M18.3 5.7 12 12l6.3 6.3-1.4 1.4L10.6 13.4 4.3 19.7 2.9 18.3 9.2 12 2.9 5.7l1.4-1.4 6.3 6.3 6.3-6.3 1.4 1.4z" /></svg>
)
export const IconList = (p: P) => (
  <svg {...base(p)}><path d="M4 6h2v2H4V6zm4 0h12v2H8V6zM4 11h2v2H4v-2zm4 0h12v2H8v-2zM4 16h2v2H4v-2zm4 0h12v2H8v-2z" /></svg>
)
export const IconDownload = (p: P) => (
  <svg {...base(p)}><path d="M5 20h14v-2H5v2zM12 3 6 9h4v6h4V9h4L12 3z" /></svg>
)
export const IconExternal = (p: P) => (
  <svg {...base(p)}><path d="M14 3h7v7h-2V6.4l-9.3 9.3-1.4-1.4L17.6 5H14V3zM5 5h6v2H7v10h10v-4h2v6H5V5z" /></svg>
)
export const IconRefresh = (p: P) => (
  <svg {...base(p)}><path d="M17.65 6.35A8 8 0 1 0 19.7 14h-2.1a6 6 0 1 1-1.4-6.2L13 11h7V4l-2.35 2.35z" /></svg>
)
export const IconLyrics = (p: P) => (
  <svg {...base(p)}><path d="M4 4h16v2H4V4zm0 5h16v2H4V9zm0 5h10v2H4v-2zm13 0 3 1.5v5l-3-1.5-3 1.5v-5l3-1.5z" /></svg>
)
export const IconDislike = (p: P) => (
  <svg {...base(p)}><path d="M15 3H6c-.83 0-1.54.5-1.84 1.22l-3.02 7.05c-.09.23-.14.47-.14.73v2c0 1.1.9 2 2 2h6.31l-.95 4.57-.03.32c0 .41.17.79.44 1.06L9.83 23l6.59-6.59c.36-.36.58-.86.58-1.41V5c0-1.1-.9-2-2-2zm4 0v12h4V3h-4z" /></svg>
)