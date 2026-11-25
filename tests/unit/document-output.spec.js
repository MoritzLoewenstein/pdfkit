import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { expect, test } from 'vitest';
import PDFDocument, { PAGE_SIZES, toBlob, toBytes } from '../../lib/document';

test('reads page navigation and Unicode metadata through object streams', async () => {
  const pages = [];
  const doc = new PDFDocument({
    ...globalThis.DEFAULT_OPTIONS,
    compress: true,
    objectStreams: true,
    pageLayout: 'twoColumnLeft',
    size: PAGE_SIZES.A5,
    userUnit: 2,
    fontSize: 12,
    info: { Title: 'Überblick', Omit: undefined },
    onPageAdded: (current) => pages.push(current),
  });
  doc.text('First page');
  doc.addNamedDestination('Aé');
  doc.addNamedDestination('Z');
  doc.addNamedDestination('apple');
  doc.fontSize(19);
  const width = doc.widthOfString('Text');
  doc.addPage();
  expect(doc.widthOfString('Text')).toBe(width);
  doc.outline.addItem('First page zoomed', {
    pageNumber: 0,
    fit: false,
    left: 16,
    top: 24,
    zoom: 1.5,
  });
  doc.outline.addItem('Second page', { expanded: true });
  doc.addPageLabel(1, { style: 'lowerRoman', prefix: 'A-', start: 4 });
  const late = doc.ref({ Late: true });
  doc.end();
  late.end();

  expect(pages).toEqual([doc, doc]);
  const bytes = await toBytes(doc);
  const output = new TextDecoder().decode(bytes);
  expect(output.startsWith('%PDF-1.7\n')).toBe(true);
  expect(output).toContain('/Type /ObjStm');
  const offset = Number(/startxref\n(\d+)\n%%EOF\n$/.exec(output)[1]);
  expect(
    new TextDecoder().decode(bytes.subarray(offset, offset + 128)),
  ).toContain('/Type /XRef');

  const loading = getDocument({ data: bytes, stopAtErrors: true });
  try {
    const pdf = await loading.promise;
    expect(await pdf.getPageLayout()).toBe('TwoColumnLeft');
    expect(await pdf.getPageLabels()).toEqual(['1', 'A-iv']);
    expect((await pdf.getPage(2)).userUnit).toBe(2);
    expect((await pdf.getMetadata()).info.Title).toBe('Überblick');
    expect(await pdf.getDestination('Aé')).toBeTruthy();
    const [first, second] = await pdf.getOutline();
    expect(await pdf.getPageIndex(first.dest[0])).toBe(0);
    expect(first.dest.slice(1)).toEqual([
      { name: 'XYZ' },
      16,
      PAGE_SIZES.A5[1] - 24,
      1.5,
    ]);
    expect(second.dest[1].name).toBe('Fit');
  } finally {
    await loading.destroy();
  }
});

test.each([undefined, '1.3', '1.4', '1.5', '1.6', '1.7'])(
  'rejects passwords for PDF version %s',
  (pdfVersion) => {
    for (const passwordOption of ['userPassword', 'ownerPassword']) {
      expect(
        () =>
          new PDFDocument({
            ...globalThis.DEFAULT_OPTIONS,
            pdfVersion,
            [passwordOption]: 'password',
          }),
      ).toThrow("Password protection requires pdfVersion: '1.7ext3'");
    }
  },
);

test('decrypts PDF 1.7ext3 text, attachment, metadata and named destination', async () => {
  const doc = new PDFDocument({
    ...globalThis.DEFAULT_OPTIONS,
    pdfVersion: '1.7ext3',
    compress: true,
    userPassword: 'reader-password',
    info: { Title: 'Geheimes Résumé' },
  });
  doc.text('Encrypted content');
  doc.addNamedDestination('Résumé');
  doc.file(Uint8Array.of(0, 255, 128), { name: 'attachment.bin' });
  doc.end();
  const blob = await toBlob(doc);
  expect(blob.type).toBe('application/pdf');
  const bytes = new Uint8Array(await blob.arrayBuffer());
  const locked = getDocument({ data: bytes.slice() });
  try {
    await expect(locked.promise).rejects.toMatchObject({
      name: 'PasswordException',
    });
  } finally {
    await locked.destroy();
  }
  const loading = getDocument({ data: bytes, password: 'reader-password' });
  try {
    const pdf = await loading.promise;
    const page = await pdf.getPage(1);
    const { items } = await page.getTextContent();
    expect(items.map((item) => item.str).join('')).toBe('Encrypted content');
    expect((await pdf.getMetadata()).info.Title).toBe('Geheimes Résumé');
    expect(await pdf.getDestination('Résumé')).toBeTruthy();
    expect((await pdf.getAttachments())['attachment.bin'].content).toEqual(
      Uint8Array.of(0, 255, 128),
    );
  } finally {
    await loading.destroy();
  }
});
