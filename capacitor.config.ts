import type { CapacitorConfig } from '@capacitor/cli'

// Android-обёртка веб-версии (Capacitor)
const config: CapacitorConfig = {
  appId: 'com.ymplayer.app',
  appName: 'Muse',
  webDir: 'dist',
  plugins: {
    // нативный HTTP вместо WebView-fetch: обход CORS на Android
    CapacitorHttp: { enabled: true },
    // Фоновый медиа-виджет
    BackgroundPlayback: {},
  },
  android: {
    allowMixedContent: true,
  },
}

export default config