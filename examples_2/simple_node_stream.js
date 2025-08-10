import { createWriteStream, readFileSync } from 'node:fs';
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
  fonts: {
    name: FONT_DEFAULT,
    data: robotoMonoData,
  },
});
doc.registerFont(FONT_ITALIC, robotoMonoItalicData);
const fileWriteStream = createWriteStream('examples_2/simple_node_stream.pdf');
doc.pipe(fileWriteStream);
makeSimplePdf(doc, FONT_ITALIC);
