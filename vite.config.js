import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

const __dirname = dirname(fileURLToPath(import.meta.url));
export default defineConfig({
  build: {
    copyPublicDir: false,
    sourcemap: true,
    lib: {
      entry: resolve(__dirname, 'lib/document.js'),
      formats: ['es'],
    },
  },
  test: {
    setupFiles: ['tests/unit/setupTests.js'],
    projects: [
      {
        test: {
          setupFiles: ['tests/unit/setupTests.js'],
          include: ['tests/unit/**/*.{test,spec}.js'],
          exclude: [
            'tests/unit/acroform.spec.js',
            'tests/unit/annotations.spec.js',
          ],
          name: 'unit',
          environment: 'node',
        },
      },
      {
        test: {
          name: 'visual',
          environment: 'node',
          globals: true,
          include: ['tests/visual/**/*.spec.js'],
          setupFiles: ['tests/visual/setup.js'],
          testTimeout: 30_000,
        },
      },
    ],
  },
});
