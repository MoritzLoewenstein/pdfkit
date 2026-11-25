import { readFileSync } from 'node:fs';
import { uint8ArrayToBase64 } from 'uint8array-extras';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import PDFDocument from '../../lib/document';

const readImage = (name) =>
  new Uint8Array(readFileSync(`./tests/images/${name}`));

describe('Image', function () {
  /**
   * @type {PDFDocument}
   */
  let document;

  beforeEach(() => {
    document = new PDFDocument({
      ...globalThis.DEFAULT_OPTIONS,
      info: { CreationDate: new Date(Date.UTC(2018, 1, 1)) },
    });
  });

  test('y position should be updated', () => {
    const originalY = document.y;
    const imageHeight = 400;
    document.image(readImage('bee.png'), { flipV: true });
    expect(document.y).toBe(originalY + imageHeight);
  });

  test.each(['bee.png', 'bee.jpg'])('opens %s bytes and data URLs', (name) => {
    const bytes = readImage(name);
    const image = document.openImage(bytes);
    const mime = name.endsWith('.png') ? 'image/png' : 'image/jpeg';
    const dataURL = `data:${mime};base64,${uint8ArrayToBase64(bytes)}`;
    expect(document.openImage(dataURL)).toMatchObject({
      width: image.width,
      height: image.height,
    });
  });

  test('rejects file paths and raw ArrayBuffers', () => {
    for (const source of [
      'tests/images/bee.png',
      readImage('bee.png').buffer,
    ]) {
      expect(() => document.image(source)).toThrow('Invalid image source');
    }
  });

  test('JPEG reads RGB channels from the frame, including padded JPEGs', () => {
    const bytes = readImage('issue-1175.jpeg');
    const padded = new Uint8Array(bytes.length + 7);
    padded.set(bytes, 7);
    expect(document.openImage(padded.subarray(7))).toMatchObject({
      colorSpace: 'DeviceRGB',
      width: 375,
      height: 500,
      orientation: 1,
    });
  });

  test.each([1, 2, 3, 4, 5, 6, 7, 8])('reads EXIF orientation %i', (n) => {
    expect(
      document.openImage(readImage(`orientation-${n}.jpeg`)).orientation,
    ).toBe(n);
  });

  test('applies opacity between save and restore without altering stroke alpha', () => {
    const content = vi.spyOn(document, 'addContent');
    const image = readImage('bee.png');
    document.image(image, 10, 20, { opacity: 0 });
    document.image(image, 30, 40, { opacity: 0 });
    expect(Object.keys(document.page.ext_gstates)).toEqual(['Gs1']);
    expect(document.page.ext_gstates.Gs1.data).toEqual({
      Type: 'ExtGState',
      ca: 0,
    });
    expect(content.mock.calls.flat()).toEqual([
      'q',
      '/Gs1 gs',
      '409 0 0 -400 10 420 cm',
      '/I1 Do',
      'Q',
      'q',
      '/Gs1 gs',
      '409 0 0 -400 30 440 cm',
      '/I2 Do',
      'Q',
    ]);
  });

  test('mirrors in the aligned rectangle before the EXIF rotation', () => {
    const transform = vi.spyOn(document, 'transform');
    document.image(readImage('orientation-6.jpeg'), 10, 20, {
      scaleDown: [800, 850],
      align: 'center',
      valign: 'bottom',
      flipH: true,
      flipV: true,
    });
    expect(transform.mock.calls.slice(0, 2)).toEqual([
      [-1, 0, 0, 1, 820, 0],
      [1, 0, 0, -1, 0, 1290],
    ]);
    expect(transform.mock.calls.at(-1)).toEqual([450, 0, 0, -600, 110, 420]);
  });

  test.each([
    [{ scaleDown: [818, 800] }, 409, 400],
    [{ scaleDown: [100, 1000] }, 100, (100 * 400) / 409],
    [{ fit: [818, 800], scaleDown: [818, 800] }, 818, 800],
  ])('places images with %o', (options, width, height) => {
    const transform = vi.spyOn(document, 'transform');
    document.image(readImage('bee.png'), 10, 20, options);
    const [w, , , h, x, y] = transform.mock.calls[0];
    expect(w).toBeCloseTo(width);
    expect(h).toBeCloseTo(-height);
    expect(x).toBe(10);
    expect(y).toBeCloseTo(20 + height);
  });
});
