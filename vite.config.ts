import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { promisify } from 'util';
import { defineConfig, Plugin } from 'vite';
import zlib from 'zlib';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const brotliCompressAsync = promisify(zlib.brotliCompress);
const gzipAsync = promisify(zlib.gzip);
const PRECOMPRESS_EXTS = new Set(['.js', '.css', '.html', '.svg', '.json']);

async function collectFilesRecursively(dir: string): Promise<string[]> {
  const entries = await fs.promises.readdir(dir, { withFileTypes: true }).catch(() => []);
  const files: string[] = [];
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await collectFilesRecursively(fullPath)));
    } else if (entry.isFile() && PRECOMPRESS_EXTS.has(path.extname(entry.name).toLowerCase())) {
      files.push(fullPath);
    }
  }
  return files;
}

function precompressDistPlugin(): Plugin {
  return {
    name: 'aetherterra-precompress-dist',
    apply: 'build',
    async closeBundle() {
      const distDir = path.resolve(__dirname, 'dist');
      const targetFiles = await collectFilesRecursively(distDir);
      await Promise.all(
        targetFiles.map(async (filePath) => {
          const raw = await fs.promises.readFile(filePath);
          const [br, gz] = await Promise.all([
            brotliCompressAsync(raw, {
              params: { [zlib.constants.BROTLI_PARAM_QUALITY]: 6 },
            }),
            gzipAsync(raw, { level: 6 }),
          ]);
          await Promise.all([
            fs.promises.writeFile(`${filePath}.br`, br),
            fs.promises.writeFile(`${filePath}.gz`, gz),
          ]);
        })
      );
    },
  };
}

export default defineConfig(() => {
  return {
    plugins: [
      react(),
      tailwindcss(),
      precompressDistPlugin(),
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (id.includes('/node_modules/three/') || id.includes('\\node_modules\\three\\')) {
              return 'three-vendor';
            }
            if (
              id.includes('/node_modules/react/') ||
              id.includes('/node_modules/react-dom/') ||
              id.includes('/node_modules/scheduler/') ||
              id.includes('/node_modules/lucide-react/')
            ) {
              return 'react-ui-vendor';
            }
            if (id.includes('/src/world/registry')) {
              return 'world-registry';
            }
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

