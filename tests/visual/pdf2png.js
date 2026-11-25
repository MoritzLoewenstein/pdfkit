import { createRequire } from 'node:module';
import { dirname, join, sep } from 'node:path';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';

const require = createRequire(import.meta.url);
const standardFontDataUrl = `${join(
  dirname(require.resolve('pdfjs-dist/package.json')),
  'standard_fonts',
)
  .split(sep)
  .join('/')}/`;

// Adapted from https://github.com/mozilla/pdf.js/tree/master/examples/node/pdf2png
export async function pdf2png(data) {
  const loadingTask = getDocument({
    data: new Uint8Array(data),
    useSystemFonts: false,
    standardFontDataUrl,
    stopAtErrors: true,
  });

  try {
    const pdf = await loadingTask.promise;
    const { canvasFactory } = pdf;
    const images = [];
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const viewport = page.getViewport({ scale: 2 });
      const target = canvasFactory.create(viewport.width, viewport.height);
      try {
        await page.render({ canvasContext: target.context, viewport }).promise;
        images.push(target.canvas.toBuffer('image/png'));
      } finally {
        page.cleanup();
        canvasFactory.destroy(target);
      }
    }
    return images;
  } finally {
    await loadingTask.destroy();
  }
}
