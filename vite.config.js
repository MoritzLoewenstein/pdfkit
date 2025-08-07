import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    lib: {
      entry: ['lib/document.js'],
      name: 'PDFKit',
    },
  },
});
