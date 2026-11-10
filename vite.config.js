import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
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
