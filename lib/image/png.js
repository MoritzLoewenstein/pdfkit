import PNG from 'png-js';
import { deflateSync } from '#zlib';

class PNGImage {
  constructor(data, label) {
    this.label = label;
    this.image = new PNG(data);
    this.width = this.image.width;
    this.height = this.image.height;
    this.imgData = this.image.imgData;
    this.obj = null;
  }

  embed(document) {
    if (this.obj) {
      return;
    }

    this.document = document;
    const hasAlphaChannel = this.image.hasAlphaChannel;
    const isInterlaced = this.image.interlaceMethod === 1;

    this.obj = this.document.ref({
      Type: 'XObject',
      Subtype: 'Image',
      BitsPerComponent: hasAlphaChannel ? 8 : this.image.bits,
      Width: this.width,
      Height: this.height,
      Filter: 'FlateDecode',
    });

    if (!hasAlphaChannel) {
      const params = this.document.ref({
        Predictor: isInterlaced ? 1 : 15,
        Colors: this.image.colors,
        BitsPerComponent: this.image.bits,
        Columns: this.width,
      });

      this.obj.data['DecodeParms'] = params;
      params.end();
    }

    if (this.image.palette.length === 0) {
      this.obj.data['ColorSpace'] = this.image.colorSpace;
    } else {
      // embed the color palette in the PDF as an object stream
      const palette = this.document.ref();
      palette.end(new Uint8Array(this.image.palette));

      // build the color space array for the image
      this.obj.data['ColorSpace'] = [
        'Indexed',
        'DeviceRGB',
        this.image.palette.length / 3 - 1,
        palette,
      ];
    }

    // For PNG color types 0, 2 and 3, the transparency data is stored in
    // a dedicated PNG chunk.
    if (this.image.transparency.grayscale != null) {
      // Use Color Key Masking (spec section 4.8.5)
      // An array with N elements, where N is two times the number of color components.
      const val = this.image.transparency.grayscale;
      this.obj.data['Mask'] = [val, val];
    } else if (this.image.transparency.rgb) {
      // Use Color Key Masking (spec section 4.8.5)
      // An array with N elements, where N is two times the number of color components.
      const { rgb } = this.image.transparency;
      const mask = [];
      for (let x of rgb) {
        mask.push(x, x);
      }

      this.obj.data['Mask'] = mask;
    } else if (this.image.transparency.indexed) {
      // Create a transparency SMask for the image based on the data
      // in the PLTE and tRNS sections. See below for details on SMasks.
      this.loadIndexedAlphaChannel();
    } else if (hasAlphaChannel) {
      // For PNG color types 4 and 6, the transparency data is stored as a alpha
      // channel mixed in with the main image data. Separate this data out into an
      // SMask object and store it separately in the PDF.
      this.splitAlphaChannel();
    }

    if (isInterlaced && !hasAlphaChannel && !this.image.transparency.indexed) {
      this.imgData = deflateSync(this.image.decodePixelsSync());
    }

    this.finalize();
  }

  finalize() {
    if (this.alphaChannel) {
      const sMask = this.document.ref({
        Type: 'XObject',
        Subtype: 'Image',
        Height: this.height,
        Width: this.width,
        BitsPerComponent: 8,
        Filter: 'FlateDecode',
        ColorSpace: 'DeviceGray',
        Decode: [0, 1],
      });

      sMask.end(this.alphaChannel);
      this.obj.data['SMask'] = sMask;
    }

    // add the actual image data
    this.obj.end(this.imgData);

    // free memory
    this.image = null;
    this.imgData = null;
  }

  splitAlphaChannel() {
    const pixels = this.image.decodePixelsSync();
    const colorCount = this.image.colors;
    const pixelCount = this.width * this.height;
    const imgData = new Uint8Array(pixelCount * colorCount);
    const alphaChannel = new Uint8Array(pixelCount);

    // For 16-bit samples keep only the most significant byte (PNG is big-endian).
    const stride = this.image.bits / 8;
    let i = 0;
    let p = 0;
    for (let a = 0; a < pixelCount; a++) {
      for (let c = 0; c < colorCount; c++) {
        imgData[p++] = pixels[i];
        i += stride;
      }
      alphaChannel[a] = pixels[i];
      i += stride;
    }

    this.imgData = deflateSync(imgData);
    this.alphaChannel = deflateSync(alphaChannel);
  }

  loadIndexedAlphaChannel() {
    const { bits, transparency, interlaceMethod } = this.image;
    const pixels = this.image.decodePixelsSync();
    const alphaChannel = new Uint8Array(this.width * this.height);
    const rowBytes = Math.ceil((this.width * bits) / 8);
    const indexMask = (1 << bits) - 1;

    let i = 0;
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        const bit = x * bits;
        const byte = pixels[y * rowBytes + (bit >> 3)];
        const index = (byte >> (8 - bits - (bit & 7))) & indexMask;
        alphaChannel[i++] = transparency.indexed[index] ?? 255;
      }
    }

    // A PDF image stream needs scanlines in display order, not Adam7 passes.
    if (interlaceMethod === 1) {
      this.imgData = deflateSync(pixels);
    }
    this.alphaChannel = deflateSync(alphaChannel);
  }
}

export default PNGImage;
