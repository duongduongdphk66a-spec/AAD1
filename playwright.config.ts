import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  use: {
    baseURL: 'http://127.0.0.1:3100',
    headless: true,
    launchOptions: {
      args: ['--use-gl=angle', '--use-angle=swiftshader'],
    },
  },
  webServer: {
    command: 'node server.js --prod',
    env: {
      PORT: '3100',
    },
    url: 'http://127.0.0.1:3100/healthz',
    reuseExistingServer: !process.env.CI,
    timeout: 15_000,
  },
});
