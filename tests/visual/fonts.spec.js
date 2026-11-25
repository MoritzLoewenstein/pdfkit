import { runDocTest } from './helpers';

const characters = `Latin
ABCDEFGHIJKLMNOPQRSTUVWXYZ
abcdefghijklmnopqrstuvwxyz

Latin 1 (Western)
ÁÀÂÄÅÃÆÇÐÉÈÊËÍÌÎÏÑÓÒÔÖÕØŒÞÚÙÛÜÝŸ
áàâäãåæçðéèêëíìîïıñóòôöõøœßþúùûüýÿ

Latin 2 (Eastern)
ĀĂĄĆČĎĐĒĖĘĚĞĢĪĮİĶŁĹĻĽŃŅŇŌŐŔŖŘŠŚŞȘŢȚŤŪŮŰŲŽŹŻ
āăąćčďđēėęěğģīįķłĺļľńņňōőŕŗřšśşșţțťūůűųžźż

Greek (Modern)
ΑΒΓ∆ΕΖΗΘΙΚΛΜΝΞΟΠΡΣΤΥΦΧΨΩΆΈΉΊΌΎΏΪΫ
αβγδεζηθικλµνξοπρςστυφχψωάέήίόύώϊϋΐΰ

Cyrillic 1 (Russian)
АБВГДЕЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯ
абвгдежзийклмнопрстуфхцчшщъыьэюя

Cyrillic 2 (Extended)
ЀЁЂЃЄЅІЇЈЉЊЋЌЍЎЏҐӁҒҖҚҢҮҰҲҶҺӘӢӨӮ
ѐёђѓєѕіїјљњћќѝўџґӂғҗқңүұҳҷһәӣөӯ`;

describe('fonts', function () {
  // PDFDocument still requires supplied font bytes instead of standard font names.
  test.todo('default (Helvetica)');
  test.todo('Helvetica Bold');

  test('bundled standard font fallbacks', () =>
    runDocTest({ failureThreshold: 0.001 }, (doc) => {
      // Reference PDF standard fonts without embedding them to exercise PDF.js's
      // bundled fallbacks, independently of PDFKit's font registration API.
      for (const [index, name] of ['Helvetica', 'Helvetica-Bold'].entries()) {
        const font = doc.ref({
          Type: 'Font',
          Subtype: 'Type1',
          BaseFont: name,
          Encoding: 'WinAnsiEncoding',
        });
        font.end();
        doc.page.fonts[name] = font;
        doc.addContent(
          `BT /${name} 24 Tf 1 0 0 -1 30 ${50 + index * 35} Tm (${name}: ABC abc 123) Tj ET`,
        );
      }
    }));

  test('Roboto', function () {
    return runDocTest(function (doc) {
      doc.font('tests/fonts/Roboto-Regular.ttf');
      doc.text(characters, 10, 10);
    });
  });

  test('Roboto Bold', function () {
    return runDocTest(function (doc) {
      doc.font('tests/fonts/Roboto-Medium.ttf');
      doc.text(characters, 10, 10);
    });
  });
});
