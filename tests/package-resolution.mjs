import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import PDFDocument, {
  PDFDocument as NamedPDFDocument,
  PAGE_SIZES,
  toBytes,
} from '@moritzloewenstein/pdfkit';
import { getDocument, OPS } from 'pdfjs-dist/legacy/build/pdf.mjs';
import * as browser from '../dist/pdfkit.js';

assert.equal(NamedPDFDocument, PDFDocument);
assert.equal(
  import.meta.resolve('@moritzloewenstein/pdfkit'),
  new URL('../dist/pdfkit.node.js', import.meta.url).href,
);
assert.throws(
  () => createRequire(import.meta.url)('@moritzloewenstein/pdfkit'),
  { code: 'ERR_PACKAGE_PATH_NOT_EXPORTED' },
);

const fontData = await readFile(
  new URL('./fonts/Roboto-Regular.ttf', import.meta.url),
);
const image = await readFile(
  new URL('./images/interlaced-rgb-alpha-8bit.png', import.meta.url),
);
assert.deepEqual(PAGE_SIZES.LETTER, [612, 792]);
for (const [Document, collect] of [
  [PDFDocument, toBytes],
  [browser.default, browser.toBytes],
]) {
  const doc = new Document({ font: 'Roboto', fontData });
  doc.text('Package smoke test').image(image, 72, 100);
  doc.end();
  const bytes = await collect(doc);
  assert(bytes instanceof Uint8Array);
  assert.match(new TextDecoder().decode(bytes), /^%PDF-1\.7\n[\s\S]*%%EOF\n$/);

  const loading = getDocument({ data: bytes, stopAtErrors: true });
  try {
    const page = await (await loading.promise).getPage(1);
    const text = await page.getTextContent();
    assert.equal(
      text.items.map(({ str }) => str).join(''),
      'Package smoke test',
    );
    const operators = await page.getOperatorList();
    assert(operators.fnArray.includes(OPS.paintImageXObject));
  } finally {
    await loading.destroy();
  }
}
