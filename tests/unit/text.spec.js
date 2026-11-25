import { stringToUint8Array } from 'uint8array-extras';
import { beforeEach, describe, expect, test, vi } from 'vitest';
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

    test.skip('with content ending after page right margin', () => {
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

    test('null x preserves the current x and explicit options', () => {
      const docData = logData(document);
      const moveTo = vi.spyOn(document, 'moveTo');
      document.x = 80;
      document.text('null x', null, 50, { lineBreak: false, underline: true });
      document.end();
      expect(docData).toContainText({ text: 'null x', x: 80 });
      expect(moveTo).toHaveBeenCalledOnce();
    });

    test.each([true, false])(
      'bounds and decorations count spacing once (wrap: %s)',
      (lineBreak) => {
        const moveTo = vi.spyOn(document, 'moveTo');
        const lineTo = vi.spyOn(document, 'lineTo');
        const link = vi.spyOn(document, 'link');
        const goTo = vi.spyOn(document, 'goTo');
        const thickness = vi.spyOn(document, 'lineWidth');
        const text = 'design-system   world';
        const options = {
          lineBreak,
          characterSpacing: 2,
          wordSpacing: 5,
          horizontalScaling: 80,
          baseline: 'alphabetic',
          underline: true,
          strike: true,
          decorationThickness: 3,
          underlineOffset: -2,
          link: 'https://example.com',
          goTo: 'anchor',
        };
        const width =
          document.widthOfString('design-system world', options) + 4;
        const lineTop =
          100 - (document._font.ascender / 1000) * document._fontSize;
        const lineHeight = document.currentLineHeight();

        expect(
          document.boundsOfString(text, 50, 100, options).width,
        ).toBeCloseTo(width);
        document.text(text, 50, 100, options);
        document.end();

        expect(moveTo.mock.calls[0][1]).toBeCloseTo(lineTop + lineHeight - 5);
        expect(moveTo.mock.calls[1][1]).toBeCloseTo(lineTop + lineHeight / 2);
        expect(thickness.mock.calls).toEqual([[3], [3]]);
        expect(lineTo.mock.calls[0][0]).toBeCloseTo(50 + width);
        expect(lineTo.mock.calls[1][0]).toBeCloseTo(50 + width);
        for (const annotation of [link, goTo]) {
          expect(annotation.mock.calls[0][1]).toBeCloseTo(lineTop);
          expect(annotation.mock.calls[0][2]).toBeCloseTo(width);
        }
      },
    );

    test.each([
      ['center', { characterSpacing: 4 }, 0.5],
      ['center', { wordSpacing: 5 }, 0.5],
      ['right', { wordSpacing: 5 }, 1],
    ])('%s alignment uses the drawn width (%o)', (align, spacing, fraction) => {
      const moveTo = vi.spyOn(document, 'moveTo');
      const text = 'Hello big world';
      const drawnWidth =
        document.widthOfString(text, spacing) + (spacing.wordSpacing || 0) * 2;
      document.text(text, 50, 50, {
        width: 400,
        align,
        underline: true,
        ...spacing,
      });
      expect(moveTo.mock.calls[0][0]).toBeCloseTo(
        50 + (400 - drawnWidth) * fraction,
      );
    });

    test('word spacing collapses spaces but keeps the blank line', () => {
      const fragment = vi.spyOn(document, '_fragment');
      const text = 'one   two\n\nthree';
      const options = { wordSpacing: 5 };
      const height = document.currentLineHeight(true);
      const top = document.y;
      expect(document.boundsOfString(text, options).height).toBeCloseTo(
        3 * height,
      );
      document.text(text, options);
      expect(fragment.mock.calls[0][0]).toBe('one two\n');
      expect(fragment.mock.calls.at(-1)[2]).toBeCloseTo(top + 2 * height);
    });

    test('a continued segment can switch to whitespace wrapping', () => {
      const fragment = vi.spyOn(document, '_fragment');
      const width = document.widthOfString('a design-system') - 1;
      document.text('a ', { width, continued: true });
      const y = document.y;
      document.text('design-system', { lineBreak: 'whitespace' });
      const lines = fragment.mock.calls.filter(([text]) => text);
      expect(lines.map(([text]) => text)).toEqual(['a ', 'design-system']);
      expect(lines[1][2]).toBeGreaterThan(y);
    });

    test('continues successive fragments without accumulating the all-lines indent', () => {
      const fragment = vi.spyOn(document, '_fragment');
      const advance = document.widthOfString('A');
      document.text('A', 30, 50, {
        indent: 15,
        indentAllLines: true,
        continued: true,
      });
      document.text('A', { continued: true });
      document.text('A\nB');
      const positions = fragment.mock.calls.map(([, x]) => x);
      expect(positions[0]).toBeCloseTo(45);
      expect(positions[1]).toBeCloseTo(45 + advance);
      expect(positions[2]).toBeCloseTo(45 + 2 * advance);
      expect(positions[3]).toBeCloseTo(45);
    });
  });

  describe('heightOfString', () => {
    test.each([{}, { continued: true }, { lineBreak: false, width: null }])(
      'measures without drawing or altering the pending continuation (%o)',
      (options) => {
        const docData = logData(document);
        const fragment = vi.spyOn(document, '_fragment');
        document.text('first', 30, 50, { continued: true });
        const expectedNextX = 30 + document.widthOfString('first');
        const content = vi.spyOn(document, 'addContent');
        expect(document.heightOfString('not drawn', options)).toBeCloseTo(
          document.currentLineHeight(true),
        );
        expect(content).not.toHaveBeenCalled();
        expect(fragment).toHaveBeenCalledOnce();
        document.text('last');
        document.end();

        expect(docData).toContainText({ text: 'first', x: 30 });
        expect(docData).toContainText({ text: 'last', x: expectedNextX });
      },
    );
  });
});
