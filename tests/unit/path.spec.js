import { describe, expect, test, vi } from 'vitest';
import PDFDocument from '../../lib/document';

describe('SVG paths', () => {
  test.each([
    ['M60 540 Q60 60 540 60', '60 220 220 60 540 60 c'],
    ['M60 540 q0 -480 480 -480', '60 220 220 60 540 60 c'],
    ['M0 0 Q30 60 60 0 T120 0 T180 0', '140 40 160 40 180 0 c'],
    ['M0 0 q30 60 60 0 t60 0 t60 0', '140 40 160 40 180 0 c'],
    ['M0 0 C0 20 20 20 20 0 S40 20 60 0', '20 -20 40 20 60 0 c'],
    ['M0 0 Q10 20 20 0 s20 20 40 0', '20 0 40 20 60 0 c'],
    ['M0 0 A10 10 0 0 1 20 0 S40 20 60 0', '20 0 40 20 60 0 c'],
    ['M0 0 C0 20 20 20 20 0 T60 0', '20 0 33.333333 0 60 0 c'],
    ['M0 0 a5 5 0 0110 10', '12.761424 2.761424 12.761424 7.238576 10 10 c'],
    ['M0 0 a5 5 0 011-5', '-0.6054 -1.72418 -0.221977 -3.641295 1 -5 c'],
    ['M0 0 A0 10 0 0 1 20 20', '20 20 l'],
    ['M1 1 a10 0 0 0 1 20 20', '21 21 l'],
    ['M1E+1\t20 30.5.5', '30.5 0.5 l'],
  ])('draws %s using the expected PDF operator', (path, command) => {
    const doc = new PDFDocument(globalThis.DEFAULT_OPTIONS);
    const content = vi.spyOn(doc, 'addContent');
    doc.path(path);
    expect(content.mock.calls.at(-1)).toEqual([command]);
  });

  test('omits an arc whose start and end coincide', () => {
    const doc = new PDFDocument(globalThis.DEFAULT_OPTIONS);
    const content = vi.spyOn(doc, 'addContent');
    doc.path('M10 10 A10 5 0 0 1 10 10');
    expect(content.mock.calls).toEqual([['10 10 m']]);
  });
});
