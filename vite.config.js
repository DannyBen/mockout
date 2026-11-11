import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
import { buildVersion } from './build-version.js';

export default defineConfig({
  plugins: [react()],
  define: {
    __APP_VERSION__: JSON.stringify(buildVersion(fileURLToPath(new URL('.', import.meta.url)))),
  },
  server: {
    host: '0.0.0.0',
    port: 3000,
    strictPort: true,
    watch: {
      usePolling: true,
      interval: 1000,
      awaitWriteFinish: { stabilityThreshold: 300, pollInterval: 100 },
    },
  },
  preview: { host: '0.0.0.0', port: 3000, strictPort: true },
  build: { outDir: 'dist', emptyOutDir: true },
});
