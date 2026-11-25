import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import PDFDocument, {
  PDFDocument as NamedPDFDocument,
  PAGE_SIZES,
  toBytes,
} from '@moritzloewenstein/pdfkit';

assert.equal(NamedPDFDocument, PDFDocument);
assert.throws(
  () => createRequire(import.meta.url)('@moritzloewenstein/pdfkit'),
  { code: 'ERR_PACKAGE_PATH_NOT_EXPORTED' },
);

const fontData = await readFile(
  new URL('./fonts/Roboto-Regular.ttf', import.meta.url),
);
assert.deepEqual(PAGE_SIZES.LETTER, [612, 792]);
const doc = new PDFDocument({ font: 'Roboto', fontData });
doc.text('Package smoke test');
doc.end();
const bytes = await toBytes(doc);
assert(bytes instanceof Uint8Array);
assert.match(new TextDecoder().decode(bytes), /^%PDF-1\.3\n[\s\S]*%%EOF\n$/);
