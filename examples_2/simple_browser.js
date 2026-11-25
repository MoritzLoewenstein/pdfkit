import { PDFDocument, toBlob } from '../lib/document.js';
import { loadFonts } from './browser_fonts.js';
import { makeSimplePdf } from './simple_pdf.js';

try {
  const [fontData, fontItalicData] = await loadFonts();
  const doc = new PDFDocument({ font: 'RobotoMono', fontData });
  doc.registerFont('RobotoMonoItalic', fontItalicData);
  const output = toBlob(doc);
  makeSimplePdf(doc, 'RobotoMonoItalic');

  const url = URL.createObjectURL(await output);
  document.querySelector('iframe').src = url;
  const openLink = document.querySelector('#open-new-tab');
  openLink.href = url;
  openLink.hidden = false;
} catch (error) {
  const status = document.querySelector('#status');
  status.textContent = `Could not generate the PDF: ${error.message}`;
  status.hidden = false;
}
