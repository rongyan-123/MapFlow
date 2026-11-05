import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { readFileSync } from 'node:fs';

const devKeyFile = process.env.MAPFLOW_DEV_HTTPS_KEY_FILE;
const devCertificateFile = process.env.MAPFLOW_DEV_HTTPS_CERT_FILE;
if (Boolean(devKeyFile) !== Boolean(devCertificateFile)) {
  throw new Error('Local HTTPS requires both certificate and key files.');
}

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    https: devKeyFile && devCertificateFile ? {
      key: readFileSync(devKeyFile), cert: readFileSync(devCertificateFile),
    } : undefined,
    proxy: {
      '/api': {
        target: process.env.MAPFLOW_API_TARGET ?? 'http://127.0.0.1:3000',
        changeOrigin: false,
      },
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    clearMocks: true,
    restoreMocks: true,
    // 只扫前端 src,mcp-relay/ 用自带 vitest.config.ts 独立跑
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
  },
});
