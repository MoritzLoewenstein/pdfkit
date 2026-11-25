import { readFileSync } from 'node:fs';
import { create } from 'fontkit';
import { uint8ArrayToString } from 'uint8array-extras';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import PDFDocument from '../../lib/document';
import PDFFontFactory from '../../lib/font_factory';
import { logData } from './helpers';

describe('EmbeddedFont', () => {
  test('no fontLayoutCache option', () => {
    const document = new PDFDocument(globalThis.DEFAULT_OPTIONS);
    const font = PDFFontFactory.open(document, globalThis.ROBOTO_DATA);
    const runSpy = vi.spyOn(font, 'layoutRun');

    font.layout('test');
    font.layout('test');
    font.layout('test');
    font.layout('test');

    expect(runSpy).toHaveBeenCalledTimes(1);
  });

  test('fontLayoutCache = false', () => {
    const document = new PDFDocument({
      ...globalThis.DEFAULT_OPTIONS,
      fontLayoutCache: false,
    });
    const font = PDFFontFactory.open(document, globalThis.ROBOTO_DATA);
    const runSpy = vi.spyOn(font, 'layoutRun');

    font.layout('test');
    font.layout('test');
    font.layout('test');
    font.layout('test');

    expect(runSpy).toHaveBeenCalledTimes(4);
  });

  describe('embed', () => {
    test('sets BaseName based on font id and postscript name', () => {
      const document = new PDFDocument(globalThis.DEFAULT_OPTIONS);
      const font = PDFFontFactory.open(
        document,
        globalThis.ROBOTO_DATA,
        undefined,
        'F1099',
      );
      const dictionary = {
        end: () => {},
      };
      font.dictionary = dictionary;
      font.embed();

      expect(dictionary.data.BaseFont).toBe('BAJJZZ+Roboto-Regular');
    });
  });

  describe('toUnicodeMap', () => {
    test('bfrange lines should not cross highcode boundary', () => {
      const doc = new PDFDocument({
        ...globalThis.DEFAULT_OPTIONS,
        compress: false,
      });
      const font = PDFFontFactory.open(
        doc,
        globalThis.ROBOTO_DATA,
        undefined,
        'F1099',
      );

      // 398 different glyphs
      font.encode('ABCDEFGHIJKLMNOPQRSTUVWXYZ');
      font.encode('abcdefghijklmnopqrstuvwxyz');
      font.encode('ÁÀÂÄÅÃÆÇÐÉÈÊËÍÌÎÏÑÓÒÔÖÕØŒÞÚÙÛÜÝŸ');
      font.encode('áàâäãåæçðéèêëíìîïıñóòôöõøœßþúùûüýÿ');
      font.encode('ĀĂĄĆČĎĐĒĖĘĚĞĢĪĮİĶŁĹĻĽŃŅŇŌŐŔŖŘŠŚŞȘŢȚŤŪŮŰŲŽŹŻ');
      font.encode('āăąćčďđēėęěğģīįķłĺļľńņňōőŕŗřšśşșţțťūůűųžźż');
      font.encode('ΑΒΓ∆ΕΖΗΘΙΚΛΜΝΞΟΠΡΣΤΥΦΧΨΩΆΈΉΊΌΎΏΪΫ');
      font.encode('αβγδεζηθικλµνξοπρςστυφχψωάέήίόύώϊϋΐΰ');
      font.encode('АБВГДЕЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯ');
      font.encode('абвгдежзийклмнопрстуфхцчшщъыьэюя');
      font.encode('ЀЁЂЃЄЅІЇЈЉЊЋЌЍЎЏҐӁҒҖҚҢҮҰҲҶҺӘӢӨӮ');
      font.encode('ѐёђѓєѕіїјљњћќѝўџґӂғҗқңүұҳҷһәӣөӯ');

      const docData = logData(doc);
      font.toUnicodeCmap();
      const text = uint8ArrayToString(docData[3]);

      let glyphs = 0;
      for (const block of text.matchAll(
        /(\d+) beginbfrange\n([\s\S]*?)\nendbfrange/g,
      )) {
        const lines = [
          ...block[2].matchAll(/^<([0-9a-f]+)>\s+<([0-9a-f]+)>\s+\[/gim),
        ];
        expect(lines).toHaveLength(Number(block[1]));
        for (const line of lines) {
          const low = parseInt(line[1], 16);
          const high = parseInt(line[2], 16);
          glyphs += high - low + 1;
          expect(high & 0xffffff00).toBe(low & 0xffffff00);
        }
      }

      expect(glyphs).toBe(398 + 1);
    });
  });
});

describe('font sources', () => {
  test('uses pre-parsed fonts for default, registered, and direct font input', () => {
    const parsed = create(globalThis.ROBOTO_DATA);
    const doc = new PDFDocument({
      ...globalThis.DEFAULT_OPTIONS,
      fontData: parsed,
    });
    const initial = doc._font;
    const data = logData(doc);

    doc.registerFont('Body', parsed).font('Body').text('Registered font');
    expect(doc._font).toBe(initial);
    doc.font(parsed).text('Direct font');
    expect(doc._font).toBe(initial);

    doc.end();
    expect(initial.font).toBe(parsed);
    expect(data).toContain('%%EOF');
  });

  test.each(['Uint8Array', 'ArrayBuffer'])(
    'parses repeated %s input only once',
    (kind) => {
      const doc = new PDFDocument(globalThis.DEFAULT_OPTIONS);
      const bytes = globalThis.ROBOTO_DATA.slice();
      const source = kind === 'ArrayBuffer' ? bytes.buffer : bytes;
      const open = vi.spyOn(PDFFontFactory, 'open');
      try {
        doc.font(source);
        const first = doc._font;
        doc.font(source, 18);
        expect(doc._font).toBe(first);
        expect(doc._fontSize).toBe(18);
        expect(open).toHaveBeenCalledTimes(1);

        doc.font(bytes.slice());
        expect(doc._font).toBe(first);
      } finally {
        open.mockRestore();
      }
    },
  );

  test('keys collection faces by both source and family', () => {
    const doc = new PDFDocument(globalThis.DEFAULT_OPTIONS);
    const collection = readFileSync('docs/fonts/Chalkboard.ttc');
    doc.font(collection, 'Chalkboard');
    const regular = doc._font;
    doc.font(collection, 'Chalkboard-Bold');
    expect(doc._font.name).toBe('Chalkboard-Bold');
    expect(doc._font).not.toBe(regular);
    doc.font(collection, 'Chalkboard');
    expect(doc._font).toBe(regular);
    // A matching family cached for another source must not be selected.
    expect(() => doc.font(new Uint8Array(), 'Chalkboard')).toThrow();
  });

  test('finalizes different fonts with the same PostScript name and permits alias collisions', () => {
    const doc = new PDFDocument({
      ...globalThis.DEFAULT_OPTIONS,
      font: 'Default',
    });
    const data = logData(doc);
    const regular = create(globalThis.ROBOTO_DATA);
    const italic = create(readFileSync('tests/fonts/Roboto-Italic.ttf'));
    Object.defineProperty(italic, 'postscriptName', {
      value: regular.postscriptName,
    });

    doc.font(regular).text('Regular');
    const first = doc._font;
    doc.font(italic).text('Italic');
    const second = doc._font;
    expect(second).not.toBe(first);
    doc.font(regular.postscriptName);
    expect(doc._font).toBe(first);
    doc.registerFont(first.id, italic).font(first.id);
    expect(doc._font).toBe(second);

    doc.end();
    for (const font of [first, second]) {
      expect(data).toContain(`${font.ref().id} 0 obj`);
    }
    expect(data).toContain('%%EOF');
  });

  test('a complete-only font reference embeds a WinAnsi-addressable program', () => {
    const doc = new PDFDocument({
      ...globalThis.DEFAULT_OPTIONS,
      pdfVersion: '1.4',
      subset: 'PDF/A-1',
    });
    const data = logData(doc);
    const font = doc.font(globalThis.ROBOTO_DATA)._font;
    const ref = font.completeRef();
    expect(font.completeRef()).toBe(ref);
    doc.end();

    expect(font.dictionary).toBeUndefined();
    expect(ref.data.BaseFont).toBe(font.name);
    const descendant = ref.data.DescendantFonts[0].data;
    expect(descendant.W[1]).toHaveLength(font.font.numGlyphs);
    expect(descendant.FontDescriptor.data.CIDSet).toBeUndefined();
    const program = descendant.FontDescriptor.data.FontFile2;
    expect(program.data.Length1).toBe(program.data.Length);
    const cmap = uint8ArrayToString(
      data[data.indexOf(`${ref.data.Encoding.id} 0 obj`) + 3],
    );
    expect(cmap).toContain(`<80> ${font.font.glyphForCodePoint(0x20ac).id}`);
    expect(cmap).not.toContain('<81> ');
    for (const [, count, entries] of cmap.matchAll(
      /(\d+) begincidchar\n([\s\S]+?)\nendcidchar/g,
    )) {
      expect(entries.split('\n')).toHaveLength(Number(count));
      expect(Number(count)).toBeLessThanOrEqual(100);
    }
    expect(data).toContain('%%EOF');
  });
});

describe('sizeToPoint', () => {
  let doc;
  beforeEach(() => {
    doc = new PDFDocument({
      font: 'Helvetica',
      fontData: globalThis.HELVETICA_OPTIONS.fontData,
      fontSize: 12,
      size: [250, 500],
      margin: { top: 10, right: 5, bottom: 10, left: 5 },
    });
  });

  test.each([
    [1, 1],
    ['1', 1],
    [true, 1],
    [false, 0],
    ['1em', 12],
    ['1in', 72],
    ['1px', 0.75],
    ['1cm', 28.3465],
    ['1mm', 2.8346],
    ['1pc', 12],
    ['1ex', 12],
    ['1ch', 6.6738],
    ['1vw', 2.5],
    ['1vh', 5],
    ['1vmin', 2.5],
    ['1vmax', 5],
    ['1%', 0.12],
    ['1pt', 1],
  ])('%o -> %s', (size, expected) => {
    expect(doc.sizeToPoint(size)).toBeCloseTo(expected, 4);
  });

  test('1rem -> 12', () => {
    doc.fontSize(15);
    expect(doc.sizeToPoint('1em')).toEqual(15);
    expect(doc.sizeToPoint('1rem')).toEqual(12);
  });
});
