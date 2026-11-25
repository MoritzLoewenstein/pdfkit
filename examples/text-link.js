import { createWriteStream, readFileSync } from 'node:fs';
import PDFDocument from '@moritzloewenstein/pdfkit';

const doc = new PDFDocument({
  font: 'DejaVuSans',
  fontData: readFileSync(new URL('./fonts/DejaVuSans.ttf', import.meta.url)),
  bufferPages: true,
});
doc.pipe(createWriteStream('text-link.pdf'));
doc.addPage();
doc.switchToPage(0);
doc.text('First Page', { paragraphGap: 4 });
doc.text('Click here to go to Second Page', { link: 1, paragraphGap: 4 });
doc
  .text('Continued text ', { continued: true })
  .text('with a link inside', {
    continued: true,
    link: 'http://pdfkit.org',
    underline: true,
  })
  .text(' and remaining text', {
    continued: false,
    link: null,
    underline: false,
  });
doc.switchToPage(1);
doc.text('Go To First Page', { link: 0 });
doc.text('Link to google', { link: 'https://www.google.com/' });
doc.end();
