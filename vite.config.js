import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// In dev the Vite server runs on 5173 and proxies /api/* to the Express
// backend on 3001. In production Express serves the built bundle alongside
// /api on the same port, so no proxy is needed.
export default defineConfig({
  plugins: [react()],
  // SPA is mounted at /app/ in production. base must be set so the build
  // emits asset URLs as /app/assets/... — otherwise the bundled JS/CSS
  // would 404 when the page is served under /app.
  base: '/app/',
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
  },
});
