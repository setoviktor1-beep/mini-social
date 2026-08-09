import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'lt.minisocial.app',
  appName: 'Mini Social',
  webDir: 'out',
  server: {
    url: 'https://mini-social.online',
    cleartext: false
  }
};

export default config;
