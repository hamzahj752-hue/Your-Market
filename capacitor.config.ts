import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.yourmarket.app',
  appName: 'Your Market',
  webDir: 'out',
  server: {
    url: 'https://your-market-nu.vercel.app',
    cleartext: false,
  },
};

export default config;
