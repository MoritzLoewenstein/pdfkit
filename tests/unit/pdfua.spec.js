import { describe, expect, test } from 'vitest';
import PDFDocument from '../../lib/document';
import { logData, uint8ArrayStringify } from './helpers';

describe('PDF/UA', () => {
  test('metadata is present', () => {
    let doc = new PDFDocument({
      ...globalThis.DEFAULT_OPTIONS,
      autoFirstPage: false,
      pdfVersion: '1.7',
      subset: 'PDF/UA',
      tagged: true,
    });
    const data = logData(doc);
    doc.end();
    expect(data).toContainChunk([
      `11 0 obj`,
      `<<\n/length 841\n/Type /Metadata\n/Subtype /XML\n/Length 843\n>>`,
    ]);
  });

  test('metadata constains pdfuaid part', () => {
    let doc = new PDFDocument({
      ...globalThis.DEFAULT_OPTIONS,
      autoFirstPage: false,
      pdfVersion: '1.7',
      subset: 'PDF/UA',
      tagged: true,
    });
    const data = logData(doc);
    doc.end();
    let metadata = uint8ArrayStringify(data[24]);

    expect(metadata).toContain('pdfuaid:part>1');
  });
});
