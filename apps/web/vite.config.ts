import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '../..');

/**
 * Дизайн-система лежит в репозитории как есть, в том виде, в каком её отдаёт
 * сборщик DS. Алиас @ds указывает на её корень, поэтому переподключить
 * свежую версию — значит заменить папку и поправить одну строку здесь.
 */
const dsRoot = path.join(repoRoot, '_ds/shff-design-system-97e1cccc-d574-4ca0-8cca-082936ace282');

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@ds': dsRoot,
      '@dock/ui': path.join(repoRoot, 'packages/ui/src'),
      '@dock/shared': path.join(repoRoot, 'packages/shared/src'),
    },
  },
  server: {
    port: 5173,
    fs: { allow: [repoRoot] },
    proxy: {
      // ядро в разработке крутится отдельно; ws нужен для потока журнала
      '/api': { target: 'http://127.0.0.1:7788', ws: true, changeOrigin: true },
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    sourcemap: true,
  },
});
