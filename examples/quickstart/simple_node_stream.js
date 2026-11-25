import { createWriteStream, readFileSync } from 'node:fs';
import { PDFDocument } from '@moritzloewenstein/pdfkit';
import { makeSimplePdf } from './simple_pdf.js';

const robotoMonoData = readFileSync(
  new URL('../../public/fonts/RobotoMono-Regular.ttf', import.meta.url),
);
const robotoMonoItalicData = readFileSync(
  new URL('../../public/fonts/RobotoMono-Italic.ttf', import.meta.url),
);
const FONT_DEFAULT = 'RobotoMono';
const FONT_ITALIC = 'RobotoMonoItalic';
const doc = new PDFDocument({
  compress: false,
  font: FONT_DEFAULT,
  fontData: robotoMonoData,
});
doc.registerFont(FONT_ITALIC, robotoMonoItalicData);
const fileWriteStream = createWriteStream(
  'examples/quickstart/simple_node_stream.pdf',
);
doc.pipe(fileWriteStream);
makeSimplePdf(doc, FONT_ITALIC);
