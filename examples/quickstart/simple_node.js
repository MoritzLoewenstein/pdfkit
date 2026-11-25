import { readFileSync, writeFileSync } from 'node:fs';
import { PDFDocument, toBytes } from '@moritzloewenstein/pdfkit';
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
const output = toBytes(doc);
makeSimplePdf(doc, FONT_ITALIC);
writeFileSync('examples/quickstart/simple_node.pdf', await output);
