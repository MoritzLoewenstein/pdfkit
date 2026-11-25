import { createWriteStream, readFileSync } from 'node:fs';
import PDFDocument from '@moritzloewenstein/pdfkit';

const doc = new PDFDocument({
  font: 'Palatino',
  fontData: readFileSync(new URL('./fonts/PalatinoBold.ttf', import.meta.url)),
  compress: false,
  pdfVersion: '1.5',
  subset: 'PDF/UA',
  tagged: true,
  displayTitle: true,
  lang: 'en-US',
  info: { Title: 'Accessible links' },
});

doc.pipe(createWriteStream('accessible-links.pdf'));

const structure = doc.struct('Document');
doc.addStructure(structure);

structure.add(
  doc.struct('P', [
    doc.struct('Span', () => doc.text('Read the ', { continued: true })),
    doc.struct('Link', { alt: 'PDFKit guide' }, () => {
      doc.fillColor('blue').text('PDFKit guide', {
        link: 'https://pdfkit.org/',
        underline: true,
        continued: true,
      });
    }),
    doc.struct('Span', () =>
      doc.fillColor('black').text(' for an introduction.'),
    ),
  ]),
);

doc.end();
