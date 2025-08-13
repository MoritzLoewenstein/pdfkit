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
      name: 'PDFDocument',
    },
  },
  test: {
    setupFiles: ['tests/unit/setupTests.js'],
    projects: [
      {
        test: {
          setupFiles: ['tests/unit/setupTests.js'],
          include: ['tests/unit/**/*.{test,spec}.js'],
          name: 'unit',
          environment: 'node',
        },
      },
      {
        test: {
          include: ['tests/browser/**/*.{test,spec}.js'],
          name: 'browser',
          browser: {
            provider: 'playwright',
            enabled: true,
            instances: [{ browser: 'chromium' }],
          },
        },
      },
    ],
  },
});
