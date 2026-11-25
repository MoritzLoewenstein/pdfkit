import { readFileSync, writeFileSync } from 'node:fs';
import PDFDocument, { toBytes } from '@moritzloewenstein/pdfkit';

const doc = new PDFDocument({
  font: 'DejaVuSans',
  fontData: readFileSync(new URL('./fonts/DejaVuSans.ttf', import.meta.url)),
});
const output = toBytes(doc);

const image = (name) =>
  readFileSync(new URL(`../tests/images/${name}`, import.meta.url));
const left = 30;

// Set a background color so transparent pixels and opacity are visible.
doc.fillColor('lightblue').rect(0, 0, doc.page.width, doc.page.height).fill();
doc.fillColor('black');
doc.text('PNG with transparency (palette 8-bit):', left, 50);
doc.image(image('pngsuite-palette-transparent-white.png'), left, 64);
doc.text('PNG with transparency (palette 1-bit):', left, 100);
doc.image(image('pallete-transparent-white-1bit.png'), left, 114);

const bee = image('bee.png');
doc.text('Default opacity (1):', left, 140);
doc.image(bee, left, 154, { width: 100 });

for (const [offset, opacity] of [
  [180, 0.5],
  [360, 0.25],
]) {
  doc.text(`Opacity: ${opacity}`, left + offset, 140);
  doc.image(bee, left + offset, 154, { width: 100, opacity });
}

doc.end();
writeFileSync('png.pdf', await output);
