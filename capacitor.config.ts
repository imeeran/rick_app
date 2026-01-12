import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.ricklimo.driver',
  appName: 'Ricklimo Driver',
  webDir: 'www',
  plugins: {
    Keyboard: {
      resize: 'body',
      resizeOnFullScreen: true
    }
  }
};

export default config;
