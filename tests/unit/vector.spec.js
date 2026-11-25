import { stringToUint8Array } from 'uint8array-extras';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import PDFDocument from '../../lib/document';
import { logData } from './helpers';

describe('Vector Graphics', () => {
  let document;

  beforeEach(() => {
    document = new PDFDocument({
      ...globalThis.DEFAULT_OPTIONS,
      info: { CreationDate: new Date(Date.UTC(2018, 1, 1)) },
      compress: false,
    });
  });

  test('rounds only selected corners and clamps the radius to half the shorter side', () => {
    const content = vi.spyOn(document, 'addContent');
    document.roundedRect(0, 0, 100, 20, [0, 50, 5, 0]);
    expect(content.mock.calls.flat()).toEqual([
      '0 0 m',
      '90 0 l',
      '95.522847 0 100 4.477153 100 10 c',
      '100 15 l',
      '100 17.761424 97.761424 20 95 20 c',
      '0 20 l',
      '0 0 l',
      'h',
    ]);
  });

  describe('dash', () => {
    test('with numeric length argument', () => {
      const docData = logData(document);
      //TODO binary
      const vectorStream = stringToUint8Array(
        '1 0 0 -1 0 792 cm\n50 20 m\n[2 2] 0 d\nS\n',
      );

      document.moveTo(50, 20).dash(2).stroke();
      document.end();

      expect(docData).toContainChunk([
        `5 0 obj`,
        `<<
/Length 38
>>`,
        `stream`,
        vectorStream,
        `\nendstream`,
        `endobj`,
      ]);
    });

    test('with array length argument', () => {
      const docData = logData(document);
      //TODO binary
      const vectorStream = stringToUint8Array(
        '1 0 0 -1 0 792 cm\n50 20 m\n[1 2] 0 d\nS\n',
      );

      document.moveTo(50, 20).dash([1, 2]).stroke();
      document.end();

      expect(docData).toContainChunk([
        `5 0 obj`,
        `<<
/Length 38
>>`,
        `stream`,
        vectorStream,
        `\nendstream`,
        `endobj`,
      ]);
    });

    test('with space option', () => {
      const docData = logData(document);
      //TODO binary
      const vectorStream = stringToUint8Array(
        '1 0 0 -1 0 792 cm\n50 20 m\n[2 10] 0 d\nS\n',
      );

      document.moveTo(50, 20).dash(2, { space: 10 }).stroke();
      document.end();

      expect(docData).toContainChunk([
        `5 0 obj`,
        `<<
/Length 39
>>`,
        `stream`,
        vectorStream,
        `\nendstream`,
        `endobj`,
      ]);
    });

    test('with phase option', () => {
      const docData = logData(document);
      //TODO binary
      const vectorStream = stringToUint8Array(
        '1 0 0 -1 0 792 cm\n50 20 m\n[2 2] 8 d\nS\n',
      );

      document.moveTo(50, 20).dash(2, { phase: 8 }).stroke();
      document.end();

      expect(docData).toContainChunk([
        `5 0 obj`,
        `<<
/Length 38
>>`,
        `stream`,
        vectorStream,
        `\nendstream`,
        `endobj`,
      ]);
    });

    describe('validation', () => {
      test('length 1', () => {
        const doc = new PDFDocument(globalThis.DEFAULT_OPTIONS);

        expect(() => doc.dash(1)).not.toThrow();
      });

      test('length 1.5', () => {
        const doc = new PDFDocument(globalThis.DEFAULT_OPTIONS);

        expect(() => doc.dash(1.5)).not.toThrow();
      });

      test('length 0 throws', () => {
        const doc = new PDFDocument(globalThis.DEFAULT_OPTIONS);

        expect(() => doc.dash(0)).toThrow(
          'dash(0, {}) invalid, lengths must be numeric and greater than zero',
        );
      });

      test('length -1 throws', () => {
        const doc = new PDFDocument(globalThis.DEFAULT_OPTIONS);

        expect(() => doc.dash(-1)).toThrow(
          'dash(-1, {}) invalid, lengths must be numeric and greater than zero',
        );
      });

      test('length null throws', () => {
        const doc = new PDFDocument(globalThis.DEFAULT_OPTIONS);

        expect(() => doc.dash(null)).toThrow(
          'dash(null, {}) invalid, lengths must be numeric and greater than zero',
        );
      });

      test('length array', () => {
        const doc = new PDFDocument(globalThis.DEFAULT_OPTIONS);

        expect(() => doc.dash([2, 3])).not.toThrow();
      });

      test('length array containing zeros throws', () => {
        const doc = new PDFDocument(globalThis.DEFAULT_OPTIONS);

        expect(() => doc.dash([2, 0, 3])).toThrow(
          'dash([2,0,3], {}) invalid, lengths must be numeric and greater than zero',
        );
      });
    });
  });

  describe('translate', () => {
    test('identity transform is ignored', () => {
      const docData = logData(document);
      //TODO binary
      const vectorStream = stringToUint8Array(
        `1 0 0 -1 0 792 cm\n1 0 0 1 0 0 cm\n`,
      );

      document.translate(0, 0);
      document.end();

      expect(docData).not.toContainChunk([
        `5 0 obj`,
        `<<
/Length 33
>>`,
        `stream`,
        vectorStream,
        `\nendstream`,
        `endobj`,
      ]);
    });
  });
});
