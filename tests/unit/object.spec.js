import { describe, expect, test } from 'vitest';
import PDFObject from '../../lib/object';

describe('PDFObject', () => {
  describe('convert', () => {
    test('string literal', () => {
      expect(PDFObject.convert('test')).toEqual('/test');
    });

    test('string literal with unicode', () => {
      expect(PDFObject.convert('αβγδ')).toEqual('/αβγδ');
    });

    test('String object', () => {
      expect(PDFObject.convert(new String('test'))).toEqual('(test)');
    });

    test('String object with unicode', () => {
      expect(PDFObject.convert(new String('α😀'))).toBe('<feff03b1d83dde00>');
    });

    test('omits undefined dictionary entries without shifting array positions', () => {
      const sparse = [10];
      sparse[2] = 30;
      expect(
        PDFObject.convert({ Omit: undefined, Null: null, Rect: sparse }),
      ).toBe('<<\n/Null null\n/Rect [10 null 30]\n>>');
    });
  });
});
