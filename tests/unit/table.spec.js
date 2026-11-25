import { readFileSync } from 'node:fs';
import { describe, expect, test, vi } from 'vitest';
import PDFDocument from '../../lib/document';
import PDFTable from '../../lib/table';
import { deepMerge } from '../../lib/table/utils';

describe('table', () => {
  test('created', () => {
    const document = new PDFDocument(globalThis.DEFAULT_OPTIONS);
    expect(document.table()).toBeInstanceOf(PDFTable);
    expect(document.table({ data: [] })).toBe(document);
  });
  test('row', () => {
    const document = new PDFDocument(globalThis.DEFAULT_OPTIONS);
    const table = document.table();
    table.row(['A', 'B', 'C']);
    expect(table._columnWidths.length).toBe(3);
  });
});

describe('table fonts', () => {
  test.each(['row', 'cell'])(
    'a %s source clears the inherited family without clearing the size',
    (level) => {
      const doc = new PDFDocument(globalThis.DEFAULT_OPTIONS);
      const regular = doc._fontSource;
      const medium = readFileSync('tests/fonts/Roboto-Medium.ttf');
      const font = vi.spyOn(doc, 'font');
      const drawText = doc.text;
      const text = vi.spyOn(doc, 'text').mockImplementation(function (...args) {
        expect(this._fontSource).toBe(medium);
        expect(this._fontSize).toBe(18);
        return drawText.apply(this, args);
      });

      doc.table({
        columnStyles: [{ font: { src: regular, family: 'Roboto', size: 18 } }],
        rowStyles: level === 'row' ? [{ font: { src: medium } }] : [],
        data: [
          [
            {
              text: 'Hello',
              font: level === 'cell' ? { src: medium } : undefined,
            },
          ],
        ],
      });

      const mediumCalls = font.mock.calls.filter(([src]) => src === medium);
      expect(mediumCalls.length).toBeGreaterThan(0);
      expect(mediumCalls.every(([, family]) => family === undefined)).toBe(
        true,
      );
      expect(text).toHaveBeenCalledOnce();
      expect(doc._fontSource).toBe(regular);
      expect(doc._fontSize).toBe(globalThis.DEFAULT_OPTIONS.fontSize ?? 12);
    },
  );

  test('a family alone selects a face of the inherited binary source', () => {
    const doc = new PDFDocument(globalThis.DEFAULT_OPTIONS);
    const src = doc._fontSource;
    // The test font has no variations, so check the call to the font API.
    const font = vi.spyOn(doc, 'font').mockReturnThis();
    doc.table({
      columnStyles: [{ font: { src } }],
      data: [[{ text: 'Hello', font: { family: 'Condensed' } }]],
    });
    expect(
      font.mock.calls.some(
        ([source, family]) => source === src && family === 'Condensed',
      ),
    ).toBe(true);
  });
});

describe('tagged tables', () => {
  test('sets background and border colors outside paths and retains header scope', () => {
    const doc = new PDFDocument({
      ...globalThis.DEFAULT_OPTIONS,
      tagged: true,
    });
    const content = vi.spyOn(doc, 'addContent');
    const struct = vi.spyOn(doc, 'struct');
    doc.table({
      structParent: doc,
      data: [
        [
          {
            type: 'TH',
            scope: 'column',
            id: 'heading',
            backgroundColor: 'red',
          },
        ],
        [
          {
            border: [1, 2, 3, 4],
            borderColor: ['red', 'green', 'blue', 'black'],
          },
        ],
      ],
    });

    const operators = content.mock.calls.map(([op]) => op.split(' ').at(-1));
    expect(operators).toContain('BDC');
    expect(
      operators.slice(operators.indexOf('cs'), operators.indexOf('f') + 1),
    ).toEqual(['cs', 'scn', 're', 'f']);
    const strokes = operators.flatMap((op, index) =>
      op === 'S'
        ? [operators.slice(operators.lastIndexOf('CS', index), index + 1)]
        : [],
    );
    expect(strokes).toEqual([
      ['CS', 'SCN', 're', 'S'],
      ...Array.from({ length: 4 }, () => ['CS', 'SCN', 'm', 'l', 'S']),
    ]);

    const attributes = (type) =>
      struct.mock.results[struct.mock.calls.findIndex(([tag]) => tag === type)]
        .value.dictionary.data.A.data;
    expect(attributes('TH')).toMatchObject({ O: 'Table', Scope: 'Column' });
    expect(attributes('TD').Headers.map(String)).toEqual(['heading']);
    doc.end();
  });
});

describe('headerRows', () => {
  function draw(opts, data) {
    const doc = new PDFDocument({
      ...globalThis.DEFAULT_OPTIONS,
      size: [240, 120],
      margin: 20,
      bufferPages: true,
      tagged: true,
    });
    const drawn = [];
    const text = doc.text;
    const struct = vi.spyOn(doc, 'struct');
    vi.spyOn(doc, 'text').mockImplementation(function (value, x, y, options) {
      const marking = this.page.markings.at(-1);
      drawn.push([
        value,
        y,
        this.bufferedPageRange().count,
        marking?.options?.type ?? marking?.tag,
      ]);
      return text.call(this, value, x, y, options);
    });
    const table = doc.table({
      defaultStyle: { padding: 0 },
      structParent: doc,
      ...opts,
    });
    for (const row of data) table.row(row);
    table.end();
    return { doc, drawn, struct };
  }

  test('repeats multiple streamed rows in order at the new page margin, as artifacts', () => {
    const { doc, drawn, struct } = draw(
      {
        headerRows: 2,
        position: { y: 28 },
        rowStyles: [20, 25, 26, 30, 30],
      },
      [
        [{ text: 'A', type: 'TH' }],
        [{ text: 'B', type: 'TH' }],
        ['first'],
        ['second'],
        ['third'],
      ],
    );
    expect(drawn).toEqual([
      ['A', 28, 1, 'TH'],
      ['B', 48, 1, 'TH'],
      ['first', 73, 1, 'TD'],
      ['A', 20, 2, 'Pagination'],
      ['B', 40, 2, 'Pagination'],
      ['second', 65, 2, 'TD'],
      ['A', 20, 3, 'Pagination'],
      ['B', 40, 3, 'Pagination'],
      ['third', 65, 3, 'TD'],
    ]);
    expect(struct.mock.calls.filter(([type]) => type === 'TR')).toHaveLength(5);
    expect(doc.y).toBe(95);
    doc.end();
  });

  test.each([undefined, 1])(
    'skips headers that do not fit and preserves the default (%s)',
    (headerRows) => {
      const { doc, drawn } = draw({ headerRows, rowStyles: [20, 65, 20] }, [
        ['A'],
        ['tall'],
        ['next'],
      ]);
      expect(drawn.map(([text, y, page]) => [text, y, page])).toEqual([
        ['A', 20, 1],
        ['tall', 20, 2],
        ...(headerRows ? [['A', 20, 3]] : []),
        ['next', headerRows ? 40 : 20, 3],
      ]);
      doc.end();
    },
  );
});

describe('utils', () => {
  describe('deepMerge', () => {
    test.each([
      [{ a: 'hello' }, { b: 'world' }, { a: 'hello', b: 'world' }],
      [{ a: 'hello' }, { a: 'world' }, { a: 'world' }],
      [{}, { a: 'hello' }, { a: 'hello' }],
      [{ a: 'hello' }, undefined, { a: 'hello' }],
      [undefined, null, undefined],
      [1, 2, 1],
      [1, {}, 1],
      [{ a: 'hello' }, { a: {} }, { a: 'hello' }],
      [{ a: { b: 'hello' } }, { a: { b: 'world' } }, { a: { b: 'world' } }],
    ])('%o -> %o', function () {
      const opts = Array.from(arguments);
      const expected = opts.splice(-1, 1)[0];
      expect(deepMerge(...opts)).toEqual(expected);
    });
  });
});
