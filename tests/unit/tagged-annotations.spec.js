import { beforeEach, describe, expect, test } from 'vitest';
import PDFDocument from '../../lib/document';
import { logData } from './helpers';

describe('Annotations and structure', () => {
  let doc;
  let data;

  beforeEach(() => {
    doc = new PDFDocument({ ...globalThis.DEFAULT_OPTIONS, tagged: true });
    data = logData(doc);
  });

  test('does not mutate annotation options or capitalize PDF dictionary keys', () => {
    const options = Object.freeze({
      Subtype: 'Link',
      Dest: 'appendix',
      F: 0,
      name: 'Example',
    });
    const noteOptions = Object.freeze({ Name: 'Help', color: 'red' });
    expect(doc.annotate(10, 20, 30, 40, options)).toBe(doc);
    expect(doc.note(50, 20, 30, 40, 'Tip', noteOptions)).toBe(doc);

    const [link, note] = doc.page.annotations.map((ref) => ref.data);
    expect(link.name).toBe('Example');
    expect(link).not.toHaveProperty('Name');
    expect(link.F).toBe(0);
    expect(String(link.Dest)).toBe('appendix');
    expect(note).toMatchObject({ Subtype: 'Text', Name: 'Help', C: [1, 0, 0] });
    expect(String(note.Contents)).toBe('Tip');
    doc.end();
  });

  test.each([
    [
      [0, -1, 1, 0, 0, 0],
      [20, 802, 60, 832],
    ],
    [
      [1, 0, 1, 1, 0, 0],
      [30, 732, 100, 772],
    ],
    [
      [-1, 0, 0, 1, 0, 0],
      [-40, 732, -10, 772],
    ],
  ])('bounds all corners of an annotation under %j', (matrix, bounds) => {
    doc.transform(...matrix);
    doc.link(10, 20, 30, 40, 'https://example.com/');
    expect(doc.page.annotations[0].data.Rect).toEqual(bounds);
    doc.end();
  });

  test('attaches direct links to the supplied structure parent', () => {
    const link = doc.struct('Link', { alt: 'Example website' });
    doc.addStructure(link);
    doc.link(20, 20, 100, 20, 'https://example.com/', { structParent: link });
    const [annot] = doc.page.annotations;
    const page = doc.page.dictionary;
    doc.end();

    expect(doc.getStructParentTree().get(annot.data.StructParent)).toBe(
      link.dictionary,
    );
    expect(annot.data).not.toHaveProperty('structParent');
    expect(data).toContainChunk([
      `${annot.id} 0 obj`,
      /\/Contents \(\)\n\/Type \/Annot[\s\S]*\/StructParent \d+/,
      'endobj',
    ]);
    expect(data).toContainChunk([
      `${link.dictionary.id} 0 obj`,
      new RegExp(`/Type /OBJR\\s+/Obj ${annot}\\s+/Pg ${page}`),
      'endobj',
    ]);
  });

  test('tags the link from an ended closure but not the next continued span', () => {
    const paragraph = doc.struct('P', [
      doc.struct('Span', () => doc.text('Before ', { continued: true })),
      doc.struct('Link', { alt: 'Example website' }, () => {
        doc.text('Example', {
          link: 'https://example.com/',
          underline: true,
          continued: true,
        });
      }),
      doc.struct('Span', () => doc.text(' after.')),
    ]);
    doc.addStructure(paragraph);
    const { annotations } = doc.page;
    doc.end();

    expect(annotations).toHaveLength(1);
    const [annot] = annotations;
    const link = doc.getStructParentTree().get(annot.data.StructParent);
    expect(link.data.S).toBe('Link');
    expect(data).toContainChunk([
      `${link.id} 0 obj`,
      new RegExp(
        `/K \\[\\d+ <<\\s+/Type /OBJR\\s+/Obj ${annot}\\s+/Pg \\d+ 0 R\\s+>>\\]`,
      ),
      'endobj',
    ]);
  });

  test('writes layout and table structure attributes', () => {
    const figure = doc.struct('Figure', { bbox: [100, 150, 200, 250] });
    const inline = doc.struct('Figure', { placement: 'Inline' });
    const header = doc.struct('TH', { scope: 'Column' });
    const invalid = doc.struct('Figure', { bbox: [0, 1], placement: false });
    doc.addStructure(figure).addStructure(inline).addStructure(header);
    doc.addStructure(invalid);
    doc.end();

    expect(figure.dictionary.data.A).toEqual({
      O: 'Layout',
      Placement: 'Block',
      BBox: [100, 542, 200, 642],
    });
    expect(inline.dictionary.data.A).toEqual({
      O: 'Layout',
      Placement: 'Inline',
    });
    expect(header.dictionary.data.A).toEqual({ O: 'Table', Scope: 'Column' });
    expect(invalid.dictionary.data).not.toHaveProperty('A');
  });
});
