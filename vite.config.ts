import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { fileURLToPath } from 'url';
import { defineConfig } from 'vite';
import viteCompression from 'vite-plugin-compression';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const COMPRESSION_FILTER = /\.(js|mjs|json|css|html|svg)$/i;

export default defineConfig(() => {
  return {
    plugins: [
      react(),
      tailwindcss(),
      viteCompression({
        verbose: false,
        disable: false,
        threshold: 1024,
        algorithm: 'gzip',
        ext: '.gz',
        filter: COMPRESSION_FILTER,
      }),
      viteCompression({
        verbose: false,
        disable: false,
        threshold: 1024,
        algorithm: 'brotliCompress',
        ext: '.br',
        filter: COMPRESSION_FILTER,
      }),
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks(id: string) {
            if (id.includes('node_modules/three')) {
              return 'three-vendor';
            }
            if (id.includes('/world/proceduralModels') || id.includes('/world/surfaceEcosystem3D')) {
              return 'world-models';
            }
            return undefined;
          },
        },
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});


