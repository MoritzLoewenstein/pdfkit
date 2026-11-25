import { resolve } from 'node:path';
import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  build: {
    outDir: 'dist-playground',
    rollupOptions: {
      input: [
        resolve(import.meta.dirname, 'index.html'),
        resolve(import.meta.dirname, 'examples_2/index.html'),
      ],
    },
  },
});
