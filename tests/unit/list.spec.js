import { beforeEach, describe, expect, test, vi } from 'vitest';
import PDFDocument from '../../lib/document';
import { logData } from './helpers';

describe('List', () => {
  /**
   * @type {PDFDocument}
   */
  let document;

  beforeEach(() => {
    document = new PDFDocument({
      ...globalThis.DEFAULT_OPTIONS,
      info: { CreationDate: new Date(Date.UTC(2018, 1, 1)) },
      compress: false,
    });
  });

  describe('list', () => {
    test('with simple content', () => {
      const docData = logData(document);

      document.list(['item 1', 'item 2', 'item 3']);
      document.end();

      expect(docData).toContainText({ text: 'item 1' });
      expect(docData).toContainText({ text: 'item 2' });
      expect(docData).toContainText({ text: 'item 3' });
    });

    test('position after automatic new page - #1596', () => {
      const docData = logData(document);

      document.text('near the bottom of the page', 0, 680);
      document.list(['item 4', 'item 5', 'item 6']);

      document.end();

      expect(docData).toContainText({ text: 'item 4', x: 21.667 });
      expect(docData).toContainText({ text: 'item 5', x: 21.667 });
      expect(docData).toContainText({ text: 'item 6', x: 21.667 });
    });

    test.each([
      ['numbered', 7, ['7.', '1.', '8.']],
      ['lettered', 3, ['C.', 'A.', 'D.']],
    ])(
      '%s list starts at %i only on the top level',
      (listType, start, labels) => {
        const docData = logData(document);
        document.list(['alpha', ['nested'], 'beta'], { listType, start });
        document.end();
        for (const label of labels)
          expect(docData).toContainText({ text: label });
      },
    );

    test.each(['center', 'right', 'justify'])(
      'labels stay at their own indent and width with %s alignment',
      (align) => {
        const docData = logData(document);
        const link = vi.spyOn(document, 'link');
        const lineTo = vi.spyOn(document, 'lineTo');
        const width1 = document.widthOfString('1.');
        const width2 = document.widthOfString('2.');
        document.list(['long first item', 'second item'], 40, 40, {
          listType: 'numbered',
          align,
          link: 'https://example.com',
          underline: true,
        });
        document.end();
        expect(docData).toContainText({ text: '1.', x: 40 });
        expect(docData).toContainText({ text: '2.', x: 40 });
        expect(link.mock.calls[0][2]).toBeCloseTo(width1);
        expect(link.mock.calls[2][2]).toBeCloseTo(width2);
        expect(lineTo.mock.calls[0][0]).toBeCloseTo(40 + width1);
        expect(lineTo.mock.calls[2][0]).toBeCloseTo(40 + width2);
      },
    );
  });
});
