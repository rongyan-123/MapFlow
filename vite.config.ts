import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': process.env.MAPFLOW_API_TARGET ?? 'http://127.0.0.1:3000',
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
