import { beforeEach, describe, expect, test } from 'vitest';
import PDFDocument from '../../lib/document';
import { logData } from './helpers';

describe('AcroForm widgets', () => {
  let doc;
  let data;

  beforeEach(() => {
    doc = new PDFDocument({ ...globalThis.DEFAULT_OPTIONS, tagged: true });
    data = logData(doc);
  });

  test('serializes numeric values and provided nullish values as text', () => {
    doc.initForm();
    doc.formText('amount', 20, 20, 120, 20, {
      value: 0,
      defaultValue: -12.5,
    });
    doc.formCombo('rating', 20, 50, 120, 20, {
      select: ['0', '1'],
      value: 0,
      defaultValue: 1,
    });
    doc.formText('empty', 20, 80, 120, 20, {
      value: null,
      defaultValue: undefined,
    });
    doc.formText('unset', 20, 110, 120, 20);
    doc.end();

    const [amount, rating, empty, unset] = data.filter(
      (chunk) =>
        typeof chunk === 'string' && chunk.includes('/Subtype /Widget'),
    );
    expect(amount).toContain('/V (0)\n/DV (-12.5)');
    expect(rating).toContain('/Opt [(0) (1)]\n/V (0)\n/DV (1)');
    expect(empty).toContain('/V ()\n/DV ()');
    expect(unset).not.toMatch(/\n\/(V|DV|TU|DA) /);
  });

  test('maps visibility, appearance, and documented options to PDF entries', () => {
    doc.initForm();
    const font = doc._font.id;
    const options = Object.freeze({
      alternateName: 'Confirm registration',
      label: 'Confirm',
      backgroundColor: 'white',
      fontSize: 11,
      required: true,
      hidden: true,
      Ff: 1,
      purpose: 'registration',
    });
    doc.formPushButton('confirm', 20, 20, 120, 20, options);
    doc.formText('visible', 20, 50, 120, 20);

    const [hidden, visible] = doc.page.annotations.map((ref) => ref.data);
    expect(hidden).toMatchObject({
      FT: 'Btn',
      F: 6,
      Ff: 0x10003,
      MK: { BG: [1, 1, 1] },
    });
    expect(String(hidden.TU)).toBe('Confirm registration');
    expect(String(hidden.DA)).toBe(`/${font} 11 Tf 0 g`);
    expect(String(hidden.MK.CA)).toBe('Confirm');
    for (const key of Object.keys(options).filter((key) => key !== 'Ff')) {
      expect(hidden).not.toHaveProperty(key);
    }
    expect(visible.F).toBe(4);
    doc.end();
  });

  test('combines a date format with widget event actions', () => {
    doc.initForm();
    const onFocus = function () {
      return this.title;
    };
    doc.formText('date', 20, 20, 120, 20, {
      format: { type: 'date', param: 'mmmm d, yyyy' },
      onFocus,
      onBlur: 'app.alert("Date saved");',
    });

    const [
      {
        data: { AA },
      },
    ] = doc.page.annotations;
    expect(Object.keys(AA)).toEqual(['K', 'F', 'Fo', 'Bl']);
    expect(Object.values(AA).map((action) => action.S)).toEqual(
      Array(4).fill('JavaScript'),
    );
    expect(String(AA.K.JS)).toBe('AFDate_KeystrokeEx("mmmm d, yyyy");');
    expect(String(AA.F.JS)).toBe('AFDate_FormatEx("mmmm d, yyyy");');
    expect(String(AA.Fo.JS)).toBe(`(${onFocus}).call(this);`);
    expect(String(AA.Bl.JS)).toBe('app.alert("Date saved");');
    doc.end();
  });

  test('keeps field parents separate from structure parents on multiple pages', () => {
    doc.initForm();
    const fields = doc.formField('contact');
    const section = doc.struct('Sect');
    const widgets = ['name', 'email'].map((name, index) => {
      if (index) doc.addPage();
      const page = doc.page.dictionary;
      const element = doc.struct('Form');
      section.add(element);
      doc.formText(name, 20, 20, 120, 20, {
        parent: fields,
        structParent: element,
      });
      return { page, element, widget: doc.page.annotations[0] };
    });
    doc.addPage().addStructure(section);
    doc.end();

    expect(fields.data.Kids).toEqual(widgets.map(({ widget }) => widget));
    for (const { element, widget, page } of widgets) {
      const { StructParent } = widget.data;
      expect(widget.data.Parent).toBe(fields);
      expect(widget.data).not.toHaveProperty('structParent');
      expect(doc.getStructParentTree().get(StructParent)).toBe(
        element.dictionary,
      );
      expect(data).toContainChunk([
        `${element.dictionary.id} 0 obj`,
        new RegExp(
          `/K \\[<<\\s+/Type /OBJR\\s+/Obj ${widget}\\s+/Pg ${page}\\s+>>\\]`,
        ),
        'endobj',
      ]);
    }
  });

  test.each([false, true])(
    'uses the appropriate form font with embedFonts: %s',
    (embedFonts) => {
      doc.initForm({ embedFonts });
      const id = doc._font.id;
      doc.text('Page text');
      doc.formText('region', 20, 20, 120, 20, { value: 'Europe' });
      const contentFont = doc.page.fonts[id];
      doc.end();

      const formFont = doc._root.data.AcroForm.data.DR.Font[id];
      if (embedFonts) {
        expect(formFont).not.toBe(contentFont);
        expect(formFont.data.Subtype).toBe('Type0');
        const cmap = formFont.data.Encoding;
        expect(cmap.data.Type).toBe('CMap');
        const cmapStart = data.indexOf(`${cmap.id} 0 obj`);
        expect(data[cmapStart + 2]).toBe('stream');
        const cmapText = new TextDecoder().decode(data[cmapStart + 3]);
        const gid = doc._font.font.glyphForCodePoint(0x45).id;
        expect(cmapText).toContain(`/CMapName /Adobe-Identity-WinAnsi def`);
        expect(cmapText).toContain(`\n<45> ${gid}\n`);
      } else {
        expect(formFont).toBe(contentFont);
      }
      expect(data).toContain('%%EOF');
    },
  );
});
