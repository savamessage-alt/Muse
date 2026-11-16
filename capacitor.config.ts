import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.ymplayer.app",
  appName: "Muse",
  webDir: "dist",
  plugins: {
    CapacitorHttp: { enabled: true },
    BackgroundPlayback: {},
  },
  android: {
    allowMixedContent: true,
    webContentsDebuggingEnabled: true,
  },
};

export default config;