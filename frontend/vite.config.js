import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test/setup.js',
    css: true,
    include: ['src/**/*.test.{js,jsx}'],
    /** Large page imports + RTL — single worker avoids flaky OOM on Windows CI. */
    pool: 'threads',
    poolOptions: {
      threads: {
        maxThreads: 1,
        minThreads: 1,
      },
    },
    /** Run test files sequentially to avoid extra worker memory spikes. */
    fileParallelism: false,
  },
  server: {
    port: 5173,
    /** Open app root so the landing page loads; avoiding a restored `/dashboard` tab. */
    open: '/',
    proxy: {
      // Proxy API calls to backend during development
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
});
