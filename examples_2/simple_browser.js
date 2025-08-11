import PDFDocument from '../lib/document';
import { documentToBlob } from '../lib/document_util';
import { makeSimplePdf } from './simple_pdf';

// eslint-disable-next-line no-undef
window.addEventListener('load', async () => {
  const openBtn = document.getElementById('open-new-tab');
  openBtn.addEventListener('click', async () => {
    const url = await createPdf(true);
    window.open(url);
    URL.revokeObjectURL(url);
  });

  createPdf();
});

async function createPdf(keepUrl = false) {
  const robotoMonoData = await fetch('/fonts/RobotoMono-Regular.ttf').then(
    (r) => r.arrayBuffer(),
  );
  const robotoMonoItalicData = await fetch('/fonts/RobotoMono-Italic.ttf').then(
    (r) => r.arrayBuffer(),
  );
  const FONT_DEFAULT = 'RobotoMono';
  const FONT_ITALIC = 'RobotoMonoItalic';
  const doc = new PDFDocument({
    compress: false,
    fonts: FONT_DEFAULT,
    fontData: robotoMonoData,
  });
  doc.registerFont(FONT_ITALIC, robotoMonoItalicData);
  const blobPromise = documentToBlob(doc);
  makeSimplePdf(doc, FONT_ITALIC);
  const blob = await blobPromise;
  const url = URL.createObjectURL(blob);
  const iframe = document.querySelector('iframe');
  iframe.src = url;
  if (!keepUrl) {
    URL.revokeObjectURL(url);
  } else {
    return url;
  }
}
