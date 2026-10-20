import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.chordly.app',
  appName: 'Chordly',
  webDir: 'out',
  server: {
    androidScheme: 'https'
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 1800,
      backgroundColor: '#121214',
      showSpinner: false,
      androidScaleType: 'CENTER_CROP',
    },
    StatusBar: {
      style: 'DARK',
      backgroundColor: '#121214',
    },
    LiveUpdate: {
      autoDeleteBundles: true,
      readyTimeout: 10000,
      autoBlockRolledBackBundles: true
    }
  }
};

export default config;
