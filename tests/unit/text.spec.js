import { stringToUint8Array } from 'uint8array-extras';
import { beforeEach, describe, expect, test } from 'vitest';
import PDFDocument from '../../lib/document';
import { logData, uint8ArrayStringify } from './helpers';

describe('Text', () => {
  let document;

  beforeEach(() => {
    document = new PDFDocument({
      ...globalThis.DEFAULT_OPTIONS,
      info: { CreationDate: new Date(Date.UTC(2018, 1, 1)) },
      compress: false,
    });
  });

  describe('text', () => {
    test('with simple content', () => {
      const docData = logData(document);

      document.text('simple text');
      document.end();

      expect(docData).toContainText({ text: 'simple text' });
    });

    test('with destination', () => {
      // just check that there is no exception
      document.text('simple text', { destination: 'anchor' });
    });

    test('with content ending after page right margin', () => {
      const docData = logData(document);

      //TODO binary
      const textStream = stringToUint8Array(
        `1 0 0 -1 0 792 cm
q
1 0 0 -1 0 792 cm
BT
1 0 0 1 600 763.384 Tm
/F1 12 Tf
[<73696d706c65207465> 30 <7874> 0] TJ
ET
Q
`,
      );

      document.text('simple text', 600, 20);
      document.end();

      expect(docData).toContainChunk([
        `5 0 obj`,
        `<<
/Length 117
>>`,
        `stream`,
        textStream,
        `\nendstream`,
        `endobj`,
      ]);
    });

    test('with line too thin to contain a single character', () => {
      const text = 'simple text';

      // before this test, this case used to make the code run into an infinite loop.
      // To handle regression gracefully and avoid sticking this test into an infinite loop,
      // we look out for a side effect of this infinite loop, witch is adding an infinite number of pages.
      // Normally, there should not be any page added to the document.

      document.on('pageAdded', () => {
        const pageRange = document.bufferedPageRange();
        const newPageIndex = pageRange.start + pageRange.count;
        // We try restrict the fail condition to only infinite loop, so we wait for several pages to be added.
        if (newPageIndex > 10) {
          throw new Error('Infinite loop detected');
        }
      });

      document.text(text, 10, 10, { width: 2 });
      document.end();
    });

    test('bounded text precision - issue #1611', () => {
      const docData = logData(document);
      const text = 'New york';
      const bounds = document.boundsOfString(text);
      // Draw text which is constrained to the bounds
      document.text(text, {
        ellipsis: true,
        width: bounds.width,
        height: bounds.height,
      });

      document.end();

      expect(docData).toContainText({ text });
    });
  });
});
