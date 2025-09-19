import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import PDFDocument from '../../lib/document';
import { logData } from './helpers';

describe('PDFDocument', () => {
  describe('font option', () => {
    let fontSpy;

    beforeEach(() => {
      fontSpy = vi.spyOn(PDFDocument.prototype, 'font').mockReturnThis();
    });

    afterEach(() => {
      fontSpy.mockRestore();
    });

    test('a string value', () => {
      expect(() => {
        new PDFDocument({
          font: globalThis.DEFAULT_OPTIONS.font,
          fontData: globalThis.DEFAULT_OPTIONS.fontData,
        });
      }).not.toThrow();
    });

    test('incomplete font options', () => {
      expect(() => {
        new PDFDocument();
      }).toThrowErrorMatchingInlineSnapshot(
        `[Error: default font data is required, missing options.font, options.fontData]`,
      );
      expect(() => {
        new PDFDocument({ font: null });
      }).toThrowErrorMatchingInlineSnapshot(
        `[Error: default font data is required, missing options.font, options.fontData]`,
      );
      expect(() => {
        new PDFDocument({ font: false });
      }).toThrowErrorMatchingInlineSnapshot(
        `[Error: default font data is required, missing options.font, options.fontData]`,
      );
      expect(() => {
        new PDFDocument({ font: '' });
      }).toThrowErrorMatchingInlineSnapshot(
        `[Error: default font data is required, missing options.font, options.fontData]`,
      );

      expect(() => {
        new PDFDocument({ fontData: null });
      }).toThrowErrorMatchingInlineSnapshot(
        `[Error: default font data is required, missing options.font, options.fontData]`,
      );
      expect(() => {
        new PDFDocument({ fontData: false });
      }).toThrowErrorMatchingInlineSnapshot(
        `[Error: default font data is required, missing options.font, options.fontData]`,
      );
      expect(() => {
        new PDFDocument({ fontData: '' });
      }).toThrowErrorMatchingInlineSnapshot(
        `[Error: default font data is required, missing options.font, options.fontData]`,
      );

      expect(fontSpy).not.toHaveBeenCalled();
    });
  });

  describe('document info', () => {
    test('accepts properties with value undefined', () => {
      expect(
        () =>
          new PDFDocument({
            ...globalThis.DEFAULT_OPTIONS,
            info: { Title: undefined },
          }),
      ).not.toThrow(
        new TypeError("Cannot read property 'toString' of undefined"),
      );
    });

    test('accepts properties with value null', () => {
      expect(
        () =>
          new PDFDocument({
            ...globalThis.DEFAULT_OPTIONS,
            info: { Title: null },
          }),
      ).not.toThrow(new TypeError("Cannot read property 'toString' of null"));
    });
  });

  test('metadata is present for PDF 1.4', () => {
    let doc = new PDFDocument({
      ...globalThis.DEFAULT_OPTIONS,
      pdfVersion: '1.4',
    });
    const data = logData(doc);
    doc.end();

    let catalog = data[data.length - 28];

    expect(catalog).toContain('/Metadata');
  });

  test('metadata is NOT present for PDF 1.3', () => {
    let doc = new PDFDocument({
      ...globalThis.DEFAULT_OPTIONS,
      pdfVersion: '1.3',
    });
    const data = logData(doc);
    doc.end();

    let catalog = data[data.length - 27];

    expect(catalog).not.toContain('/Metadata');
  });
});
