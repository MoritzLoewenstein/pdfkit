import { createHash } from 'node:crypto';
import fs from 'node:fs';
import { inflateSync } from 'node:zlib';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import PDFDocument from '../../lib/document';
import PNGImage from '../../lib/image/png';
import PDFReference from '../../lib/reference';
import { logData } from './helpers';

const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
const streamFor = (data, ref) =>
  data[data.indexOf(`${ref.id} ${ref.gen} obj`) + 3];

describe('PNGImage', () => {
  let document;

  const createImage = (fileName) => {
    const img = new PNGImage(new Uint8Array(fs.readFileSync(fileName)), 'I1');
    vi.spyOn(img, 'finalize');
    img.embed(document);
    return img;
  };

  beforeEach(() => {
    document = new PDFDocument(globalThis.DEFAULT_OPTIONS);
  });

  test('writes matching palette indices and alpha for the Adam7 tRNS fixture', () => {
    const data = logData(document);
    const { obj } = createImage('./tests/images/issue-414-interlaced.png');
    const palette = streamFor(data, obj.data.ColorSpace[3]);
    const samples = inflateSync(streamFor(data, obj));
    const alpha = inflateSync(streamFor(data, obj.data.SMask));

    expect(obj.data.DecodeParms.data.Predictor).toBe(1);
    expect(samples).toHaveLength(408 * 326);
    const rgb = new Uint8Array(samples.length * 3);
    for (let i = 0; i < samples.length; i++) {
      rgb.set(palette.subarray(3 * samples[i], 3 * samples[i] + 3), i * 3);
    }
    // Reference pixel hashes from ImageMagick, excluding PNG row filters.
    expect(sha256(rgb)).toBe(
      '96ca2580a4a705bde15651548b39c6ab280a30c72256272450fbd8e2f4cf46ce',
    );
    expect(sha256(alpha)).toBe(
      '3cba890283eeafa8d907f9f29c539aa0638fd9993169ee4304fdd1ca1a6fc30b',
    );
    document.end();
    expect(data.at(-1)).toBe('%%EOF');
  });

  test('expands each packed 1-bit index and ignores scanline padding', () => {
    const data = logData(document);
    const { obj } = createImage(
      './tests/images/pallete-transparent-white-1bit.png',
    );
    const alpha = inflateSync(streamFor(data, obj.data.SMask));
    expect(obj.data.BitsPerComponent).toBe(1);
    expect(obj.data.DecodeParms.data.Predictor).toBe(15);
    expect(sha256(alpha)).toBe(
      '11aaa86ea5a4ffe524b478ba7f27ff58de81f5754ff27a36a94ebd97f9665a83',
    );
  });

  test('RGB', () => {
    // ImageWidth = 400
    // ImageHeight = 533
    // BitDepth = 8
    // ColorType = 2 (RGB)
    // Compression = 0
    // Filter = 0
    // Interlace = 0

    const img = createImage('./examples/images/test2.png');

    expect(img.finalize).toHaveBeenCalledTimes(1);

    expect(img.obj.data).toMatchObject({
      BitsPerComponent: 8,
      ColorSpace: 'DeviceRGB',
      Filter: 'FlateDecode',
      Height: 533,
      Length: 397011,
      Subtype: 'Image',
      Type: 'XObject',
      Width: 400,
      DecodeParms: expect.any(PDFReference),
    });

    expect(img.obj.data.DecodeParms.data).toMatchObject({
      BitsPerComponent: 8,
      Colors: 3,
      Columns: 400,
      Predictor: 15,
    });
  });

  test('RGB white transparent', () => {
    // ImageWidth = 32
    // ImageHeight = 32
    // BitDepth = 16
    // ColorType = 2
    // Compression = 0
    // Filter = 0
    // Interlace = 0

    const img = createImage(
      './tests/images/pngsuite-rgb-transparent-white.png',
    );

    expect(img.finalize).toHaveBeenCalledTimes(1);

    expect(img.obj.data).toMatchObject({
      BitsPerComponent: 16,
      ColorSpace: 'DeviceRGB',
      Filter: 'FlateDecode',
      Height: 32,
      Length: 1932,
      Subtype: 'Image',
      Type: 'XObject',
      Width: 32,
      Mask: [255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255],
      DecodeParms: expect.any(PDFReference),
    });

    expect(img.obj.data.DecodeParms.data).toMatchObject({
      BitsPerComponent: 16,
      Colors: 3,
      Columns: 32,
      Predictor: 15,
    });
  });

  test('RGB (8bit) with Alpha', () => {
    // ImageWidth = 409
    // ImageHeight = 400
    // BitDepth = 8
    // ColorType = 6 (RGB with Alpha)
    // Compression = 0
    // Filter = 0
    // Interlace = 0

    const img = createImage('./tests/images/bee.png');

    expect(img.finalize).toHaveBeenCalledTimes(1);

    expect(img.obj.data).toMatchObject({
      BitsPerComponent: 8,
      ColorSpace: 'DeviceRGB',
      Filter: 'FlateDecode',
      Height: 400,
      Subtype: 'Image',
      Type: 'XObject',
      Width: 409,
      SMask: expect.any(PDFReference),
    });

    expect(img.obj.data.SMask.data).toMatchObject({
      BitsPerComponent: 8,
      ColorSpace: 'DeviceGray',
      Decode: [0, 1],
      Filter: 'FlateDecode',
      Height: 400,
      Subtype: 'Image',
      Type: 'XObject',
      Width: 409,
    });
  });

  test('RGB (16bit) with Alpha', () => {
    // ImageWidth = 175
    // ImageHeight = 65
    // BitDepth = 16
    // ColorType = 6
    // Compression = 0
    // Filter = 0
    // Interlace = 0

    const img = createImage('./tests/images/straight.png');

    expect(img.finalize).toHaveBeenCalledTimes(1);

    expect(img.obj.data).toMatchObject({
      BitsPerComponent: 8,
      ColorSpace: 'DeviceRGB',
      Filter: 'FlateDecode',
      Height: 65,
      Subtype: 'Image',
      Type: 'XObject',
      Width: 175,
      SMask: expect.any(PDFReference),
    });

    expect(img.obj.data.SMask.data).toMatchObject({
      BitsPerComponent: 8,
      ColorSpace: 'DeviceGray',
      Decode: [0, 1],
      Filter: 'FlateDecode',
      Height: 65,
      Subtype: 'Image',
      Type: 'XObject',
      Width: 175,
    });
  });

  test('Pallete', () => {
    // ImageWidth = 980
    // ImageHeight = 540
    // BitDepth = 8
    // ColorType = 3 (Pallete)
    // Compression = 0
    // Filter = 0
    // Interlace = 0

    const img = createImage('./examples/images/test3.png');

    expect(img.finalize).toHaveBeenCalledTimes(1);

    expect(img.obj.data).toMatchObject({
      BitsPerComponent: 8,
      ColorSpace: ['Indexed', 'DeviceRGB', 255, expect.any(PDFReference)],
      Filter: 'FlateDecode',
      Height: 540,
      Length: 56682,
      Subtype: 'Image',
      Type: 'XObject',
      Width: 980,
      DecodeParms: expect.any(PDFReference),
    });

    expect(img.obj.data.DecodeParms.data).toMatchObject({
      BitsPerComponent: 8,
      Colors: 1,
      Columns: 980,
      Predictor: 15,
    });
  });

  test('Pallete indexed transparency', () => {
    // ImageWidth = 32
    // ImageHeight = 32
    // BitDepth = 8
    // ColorType = 3
    // Compression = 0
    // Filter = 0
    // Interlace = 0

    const img = createImage(
      './tests/images/pngsuite-palette-transparent-white.png',
    );

    expect(img.finalize).toHaveBeenCalledTimes(1);

    expect(img.obj.data).toMatchObject({
      BitsPerComponent: 8,
      ColorSpace: ['Indexed', 'DeviceRGB', 244, expect.any(PDFReference)],
      Filter: 'FlateDecode',
      Height: 32,
      Length: 650,
      Subtype: 'Image',
      Type: 'XObject',
      Width: 32,
      DecodeParms: expect.any(PDFReference),
      SMask: expect.any(PDFReference),
    });

    expect(img.obj.data.DecodeParms.data).toMatchObject({
      BitsPerComponent: 8,
      Colors: 1,
      Columns: 32,
      Predictor: 15,
    });

    expect(img.obj.data.SMask.data).toMatchObject({
      BitsPerComponent: 8,
      ColorSpace: 'DeviceGray',
      Decode: [0, 1],
      Filter: 'FlateDecode',
      Height: 32,
      Subtype: 'Image',
      Type: 'XObject',
      Width: 32,
    });
  });

  test('Grayscale', () => {
    // ImageWidth = 428
    // ImageHeight = 320
    // BitDepth = 8
    // ColorType = 0
    // Compression = 0
    // Filter = 0
    // Interlace = 0

    const img = createImage('./tests/images/glassware-noisy.png');

    expect(img.finalize).toHaveBeenCalledTimes(1);

    expect(img.obj.data).toMatchObject({
      BitsPerComponent: 8,
      ColorSpace: 'DeviceGray',
      Filter: 'FlateDecode',
      Height: 428,
      Length: 82633,
      Subtype: 'Image',
      Type: 'XObject',
      Width: 320,
      DecodeParms: expect.any(PDFReference),
    });
  });

  test('Grayscale black transparent', () => {
    // ImageWidth = 32
    // ImageHeight = 32
    // BitDepth = 4
    // ColorType = 0
    // Compression = 0
    // Filter = 0
    // Interlace = 0

    const img = createImage(
      './tests/images/pngsuite-gray-transparent-black.png',
    );

    expect(img.finalize).toHaveBeenCalledTimes(1);

    expect(img.obj.data).toMatchObject({
      BitsPerComponent: 4,
      ColorSpace: 'DeviceGray',
      Filter: 'FlateDecode',
      Height: 32,
      Length: 328,
      Subtype: 'Image',
      Type: 'XObject',
      Width: 32,
      Mask: [0, 0],
      DecodeParms: expect.any(PDFReference),
    });

    expect(img.obj.data.DecodeParms.data).toMatchObject({
      BitsPerComponent: 4,
      Colors: 1,
      Columns: 32,
      Predictor: 15,
    });
  });

  test('Grayscale white transparent', () => {
    // ImageWidth = 32
    // ImageHeight = 32
    // BitDepth = 16
    // ColorType = 0
    // Compression = 0
    // Filter = 0
    // Interlace = 0

    const img = createImage(
      './tests/images/pngsuite-gray-transparent-white.png',
    );

    expect(img.finalize).toHaveBeenCalledTimes(1);

    expect(img.obj.data).toMatchObject({
      BitsPerComponent: 16,
      ColorSpace: 'DeviceGray',
      Filter: 'FlateDecode',
      Height: 32,
      Length: 1212,
      Subtype: 'Image',
      Type: 'XObject',
      Width: 32,
      Mask: [255, 255],
      DecodeParms: expect.any(PDFReference),
    });

    expect(img.obj.data.DecodeParms.data).toMatchObject({
      BitsPerComponent: 16,
      Colors: 1,
      Columns: 32,
      Predictor: 15,
    });
  });

  test('Grayscale with Alpha', () => {
    // ImageWidth = 112
    // ImageHeight = 112
    // BitDepth = 8
    // ColorType = 4 (Grayscale with Alpha)
    // Compression = 0
    // Filter = 0
    // Interlace = 0

    const img = createImage('./tests/images/fish.png');

    expect(img.finalize).toHaveBeenCalledTimes(1);

    expect(img.obj.data).toMatchObject({
      BitsPerComponent: 8,
      ColorSpace: 'DeviceGray',
      Filter: 'FlateDecode',
      Height: 112,
      Subtype: 'Image',
      Type: 'XObject',
      Width: 112,
      SMask: expect.any(PDFReference),
    });

    expect(img.obj.data.SMask.data).toMatchObject({
      BitsPerComponent: 8,
      ColorSpace: 'DeviceGray',
      Decode: [0, 1],
      Filter: 'FlateDecode',
      Height: 112,
      Subtype: 'Image',
      Type: 'XObject',
      Width: 112,
    });
  });

  test('Interlaced grayscale', () => {
    // ImageWidth = 32
    // ImageHeight = 32
    // BitDepth = 8
    // ColorType = 0
    // Compression = 0
    // Filter = 0
    // Interlace = 1

    const img = createImage('./tests/images/interlaced-grayscale-8bit.png');

    expect(img.finalize).toHaveBeenCalledTimes(1);

    expect(img.obj.data).toMatchObject({
      BitsPerComponent: 8,
      ColorSpace: 'DeviceGray',
      Filter: 'FlateDecode',
      Height: 32,
      Subtype: 'Image',
      Type: 'XObject',
      Width: 32,
      DecodeParms: expect.any(PDFReference),
    });

    expect(img.obj.data.DecodeParms.data).toMatchObject({
      BitsPerComponent: 8,
      Colors: 1,
      Columns: 32,
      Predictor: 1,
    });
  });

  test('Interlaced pallete', () => {
    // ImageWidth = 32
    // ImageHeight = 32
    // BitDepth = 8
    // ColorType = 3
    // Compression = 0
    // Filter = 0
    // Interlace = 1

    const img = createImage('./tests/images/interlaced-pallete-8bit.png');

    expect(img.finalize).toHaveBeenCalledTimes(1);

    expect(img.obj.data).toMatchObject({
      BitsPerComponent: 8,
      ColorSpace: ['Indexed', 'DeviceRGB', 255, expect.any(PDFReference)],
      Filter: 'FlateDecode',
      Height: 32,
      Subtype: 'Image',
      Type: 'XObject',
      Width: 32,
      DecodeParms: expect.any(PDFReference),
    });

    expect(img.obj.data.DecodeParms.data).toMatchObject({
      BitsPerComponent: 8,
      Colors: 1,
      Columns: 32,
      Predictor: 1,
    });
  });

  test('Interlaced RGB (8bit)', () => {
    // ImageWidth = 32
    // ImageHeight = 32
    // BitDepth = 8
    // ColorType = 2
    // Compression = 0
    // Filter = 0
    // Interlace = 1

    const img = createImage('./tests/images/interlaced-rgb-8bit.png');

    expect(img.finalize).toHaveBeenCalledTimes(1);

    expect(img.obj.data).toMatchObject({
      BitsPerComponent: 8,
      ColorSpace: 'DeviceRGB',
      Filter: 'FlateDecode',
      Height: 32,
      Subtype: 'Image',
      Type: 'XObject',
      Width: 32,
      DecodeParms: expect.any(PDFReference),
    });

    expect(img.obj.data.DecodeParms.data).toMatchObject({
      BitsPerComponent: 8,
      Colors: 3,
      Columns: 32,
      Predictor: 1,
    });
  });

  test('Interlaced RGB (16bit)', () => {
    // ImageWidth = 32
    // ImageHeight = 32
    // BitDepth = 16
    // ColorType = 2
    // Compression = 0
    // Filter = 0
    // Interlace = 1

    const img = createImage('./tests/images/interlaced-rgb-16bit.png');

    expect(img.finalize).toHaveBeenCalledTimes(1);

    expect(img.obj.data).toMatchObject({
      BitsPerComponent: 16,
      ColorSpace: 'DeviceRGB',
      Filter: 'FlateDecode',
      Height: 32,
      Subtype: 'Image',
      Type: 'XObject',
      Width: 32,
      DecodeParms: expect.any(PDFReference),
    });

    expect(img.obj.data.DecodeParms.data).toMatchObject({
      BitsPerComponent: 16,
      Colors: 3,
      Columns: 32,
      Predictor: 1,
    });
  });

  test('Interlaced RGB with alpha', () => {
    // ImageWidth = 32
    // ImageHeight = 32
    // BitDepth = 8
    // ColorType = 6
    // Compression = 0
    // Filter = 0
    // Interlace = 1

    const img = createImage('./tests/images/interlaced-rgb-alpha-8bit.png');

    expect(img.finalize).toHaveBeenCalledTimes(1);

    expect(img.obj.data).toMatchObject({
      BitsPerComponent: 8,
      ColorSpace: 'DeviceRGB',
      Filter: 'FlateDecode',
      Height: 32,
      Subtype: 'Image',
      Type: 'XObject',
      Width: 32,
      SMask: expect.any(PDFReference),
    });
  });
});
