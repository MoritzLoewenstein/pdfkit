const MARKERS = [
  0xffc0, 0xffc1, 0xffc2, 0xffc3, 0xffc5, 0xffc6, 0xffc7, 0xffc8, 0xffc9,
  0xffca, 0xffcb, 0xffcd, 0xffce, 0xffcf,
];

const COLOR_SPACE_MAP = {
  1: 'DeviceGray',
  3: 'DeviceRGB',
  4: 'DeviceCMYK',
};

function parseExifOrientation(view, start, end) {
  // The TIFF header follows the six-byte Exif identifier.
  if (
    end - start < 14 ||
    view.getUint32(start) !== 0x45786966 ||
    view.getUint16(start + 4) !== 0
  ) {
    return;
  }

  const tiff = start + 6;
  const order = view.getUint16(tiff);
  if (order !== 0x4949 && order !== 0x4d4d) return;
  const littleEndian = order === 0x4949;
  if (view.getUint16(tiff + 2, littleEndian) !== 42) return;

  const offset = view.getUint32(tiff + 4, littleEndian);
  const directory = tiff + offset;
  if (offset < 8 || directory + 2 > end) return;

  const count = view.getUint16(directory, littleEndian);
  for (let i = 0; i < count; i++) {
    const entry = directory + 2 + 12 * i;
    if (entry + 12 > end) return;
    if (view.getUint16(entry, littleEndian) === 0x0112) {
      // Orientation must be a single SHORT, stored inline.
      if (
        view.getUint16(entry + 2, littleEndian) !== 3 ||
        view.getUint32(entry + 4, littleEndian) !== 1
      ) {
        return;
      }
      const value = view.getUint16(entry + 8, littleEndian);
      return value >= 1 && value <= 8 ? value : undefined;
    }
  }
}

class JPEG {
  constructor(data, label) {
    this.data = data;
    this.label = label;
    const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
    if (data.length < 2 || view.getUint16(0) !== 0xffd8) {
      throw new Error('SOI not found in JPEG');
    }

    let orientation;
    let frame;
    for (let pos = 2; pos < data.length; ) {
      // Some JPEG encoders insert padding between segments. A marker can
      // also be preceded by any number of 0xff fill bytes.
      while (pos < data.length && data[pos] !== 0xff) pos++;
      while (pos < data.length && data[pos] === 0xff) pos++;
      if (pos === data.length) break;

      const marker = 0xff00 | data[pos++];
      if (marker === 0xffda || marker === 0xffd9) break; // SOS or EOI
      if (marker === 0xff01 || (marker >= 0xffd0 && marker <= 0xffd8)) {
        continue; // Standalone markers have no length field.
      }
      if (pos + 2 > data.length) break;
      const length = view.getUint16(pos);
      const end = pos + length;
      if (length < 2 || end > data.length) break;

      if (marker === 0xffe1 && orientation === undefined) {
        orientation = parseExifOrientation(view, pos + 2, end);
      } else if (frame === undefined && MARKERS.includes(marker)) {
        if (length < 8) break;
        frame = pos + 2;
      }
      pos = end;
    }

    if (frame === undefined) {
      throw new Error('Invalid JPEG.');
    }
    this.orientation = orientation ?? 1;
    this.bits = data[frame];
    this.height = view.getUint16(frame + 1);
    this.width = view.getUint16(frame + 3);
    this.colorSpace = COLOR_SPACE_MAP[data[frame + 5]];

    this.obj = null;
  }

  embed(document) {
    if (this.obj) {
      return;
    }

    this.obj = document.ref({
      Type: 'XObject',
      Subtype: 'Image',
      BitsPerComponent: this.bits,
      Width: this.width,
      Height: this.height,
      ColorSpace: this.colorSpace,
      Filter: 'DCTDecode',
    });

    // add extra decode params for CMYK images. By swapping the
    // min and max values from the default, we invert the colors. See
    // section 4.8.4 of the spec.
    if (this.colorSpace === 'DeviceCMYK') {
      this.obj.data['Decode'] = [1.0, 0.0, 1.0, 0.0, 1.0, 0.0, 1.0, 0.0];
    }

    this.obj.end(this.data);

    // free memory
    return (this.data = null);
  }
}

export default JPEG;
