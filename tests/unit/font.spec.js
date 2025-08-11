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
        /beginbfrange\n((?:.|\n)*?)\nendbfrange/g,
      )) {
        for (const line of block[1].matchAll(
          /^<([0-9a-f]+)>\s+<([0-9a-f]+)>\s+\[/gim,
        )) {
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
    //TODO these two are failing right now, check master
    //['1ex', 11.1],
    //['1ch', 6.672],
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
