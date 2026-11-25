import { createWriteStream, readFileSync } from 'node:fs';
import PDFDocument from '@moritzloewenstein/pdfkit';

const doc = new PDFDocument({
  font: 'DejaVuSans',
  fontData: readFileSync(new URL('./fonts/DejaVuSans.ttf', import.meta.url)),
  pdfVersion: '1.4',
});

doc.pipe(createWriteStream('attachment.pdf'));

doc.info['Title'] = 'Attachment Test';

// add an embedded file from file system
doc.file(readFileSync(new URL('./images/test.png', import.meta.url)), {
  name: 'test.png',
  type: 'image/png',
  description: 'this is a test image',
});

// add some text
doc.text(`This PDF contains three attachments:
Two file attachment annotations and one embedded file.
If you can see them (not every PDF viewer supports embedded files),
hover over the paperclip to see its description!`);

// add a file attachment annotation
// first, declare the file to be attached
const file = {
  src: new TextEncoder().encode('buffered input!'),
  name: 'embedded.txt',
  creationDate: new Date(2020, 3, 1),
};
// then, add the annotation
doc.fileAnnotation(100, 150, 10, doc.currentLineHeight(), file);

// declared files can be reused, but they will show up separately in the PDF Viewer's attachments panel
// we're going to use the paperclip icon for this one together with a short description
// be aware that some PDF Viewers may not render the icon correctly — or not at all
doc.fileAnnotation(150, 150, 10, doc.currentLineHeight(), file, {
  Name: 'Paperclip',
  Contents: 'Paperclip attachment',
});

doc.end();
