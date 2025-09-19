import { describe, expect, test } from 'vitest';
import PDFDocument from '../../lib/document';
import { joinTokens, logData, uint8ArrayStringify } from './helpers';

describe('PDF/A-1', () => {
  test('metadata is present', () => {
    let doc = new PDFDocument({
      ...globalThis.DEFAULT_OPTIONS,
      autoFirstPage: false,
      pdfVersion: '1.4',
      subset: 'PDF/A-1',
    });
    const data = logData(doc);
    doc.end();
    expect(data).toContainChunk([
      `11 0 obj`,
      `<<\n/length 892\n/Type /Metadata\n/Subtype /XML\n/Length 894\n>>`,
    ]);
  });

  test('color profile is present', () => {
    const expected = [
      `10 0 obj`,
      joinTokens(
        '<<',
        '/Type /OutputIntent',
        '/S /GTS_PDFA1',
        '/Info (sRGB IEC61966-2.1)',
        '/OutputConditionIdentifier (sRGB IEC61966-2.1)',
        '/DestOutputProfile 9 0 R',
        '>>',
      ),
    ];
    let doc = new PDFDocument({
      ...globalThis.DEFAULT_OPTIONS,
      autoFirstPage: false,
      pdfVersion: '1.4',
      subset: 'PDF/A-1',
    });
    const data = logData(doc);
    doc.end();
    expect(data).toContainChunk(expected);
  });

  test('metadata contains pdfaid part and conformance', () => {
    let doc = new PDFDocument({
      ...globalThis.DEFAULT_OPTIONS,
      autoFirstPage: false,
      pdfVersion: '1.4',
      subset: 'PDF/A-1',
    });
    const data = logData(doc);
    doc.end();
    let metadata = uint8ArrayStringify(data[27]);

    expect(metadata).toContain('pdfaid:part>1');
    expect(metadata).toContain('pdfaid:conformance');
  });

  test('metadata pdfaid conformance B', () => {
    let doc = new PDFDocument({
      ...globalThis.DEFAULT_OPTIONS,
      autoFirstPage: false,
      pdfVersion: '1.4',
      subset: 'PDF/A-1b',
    });
    const data = logData(doc);
    doc.end();
    let metadata = uint8ArrayStringify(data[27]);

    expect(metadata).toContain('pdfaid:conformance>B');
  });

  test('metadata pdfaid conformance A', () => {
    let doc = new PDFDocument({
      ...globalThis.DEFAULT_OPTIONS,
      autoFirstPage: false,
      pdfVersion: '1.4',
      subset: 'PDF/A-1a',
    });
    const data = logData(doc);
    doc.end();
    let metadata = uint8ArrayStringify(data[27]);

    expect(metadata).toContain('pdfaid:conformance>A');
  });

  test('font data contains CIDSet', () => {
    let doc = new PDFDocument({
      ...globalThis.DEFAULT_OPTIONS,
      autoFirstPage: false,
      pdfVersion: '1.4',
      subset: 'PDF/A-1a',
    });
    const data = logData(doc);
    doc.addPage();
    doc.registerFont('Roboto', globalThis.ROBOTO_DATA);
    doc.font('Roboto');
    doc.text('Text');
    doc.end();

    let fontDescriptor = data.find((v) => {
      return v.includes('/Type /FontDescriptor');
    });

    expect(fontDescriptor).not.toBeUndefined();

    expect(fontDescriptor).toContain('/CIDSet');
  });
});
