import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
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
