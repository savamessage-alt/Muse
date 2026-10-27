import type { CapacitorConfig } from '@capacitor/cli'

// Android-обёртка веб-версии (Capacitor)
const config: CapacitorConfig = {
  appId: 'com.ymplayer.app',
  appName: 'YM Player',
  webDir: 'dist',
  plugins: {
    // нативный HTTP вместо WebView-fetch: обход CORS на Android
    CapacitorHttp: { enabled: true },
  },
  android: {
    allowMixedContent: true,
  },
}

export default config