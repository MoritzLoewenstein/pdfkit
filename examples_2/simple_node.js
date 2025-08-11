import { readFileSync, writeFileSync } from 'node:fs';
import { buffer } from 'node:stream/consumers';
import PDFDocument from '../dist/pdfkit.js';
import { makeSimplePdf } from './simple_pdf.js';

const robotoMonoData = readFileSync(
  'public/fonts/roboto_mono/RobotoMono-Regular.ttf',
);
const robotoMonoItalicData = readFileSync(
  'public/fonts/roboto_mono/RobotoMono-Italic.ttf',
);
const FONT_DEFAULT = 'RobotoMono';
const FONT_ITALIC = 'RobotoMonoItalic';
const doc = new PDFDocument({
  compress: false,
  font: FONT_DEFAULT,
  fontData: robotoMonoData,
});
doc.registerFont(FONT_ITALIC, robotoMonoItalicData);
const bufferPromise = buffer(doc.stream);
makeSimplePdf(doc, FONT_ITALIC);
const bytes = await bufferPromise;
writeFileSync('examples_2/simple_node.pdf', bytes);
