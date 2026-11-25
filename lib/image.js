/*
PDFImage - embeds images in PDF documents
By Devon Govett
*/

import { base64ToUint8Array, isUint8Array } from 'uint8array-extras';
import JPEG from './image/jpeg';
import PNG from './image/png';

class PDFImage {
  /**
   * @static
   * @param {Uint8Array|string} src - the source of the image, can be a Uint8Array or a base64 data URL
   * @param {string} label
   * @returns {JPEG|PNG} - returns an instance of JPEG or PNG based on the image format
   * @throws {Error} - if the source or image format is unsupported
   */
  static open(src, label) {
    let data;
    if (isUint8Array(src)) {
      data = src;
    } else {
      const match =
        typeof src === 'string' && /^data:.+?;base64,(.*)$/.exec(src);
      if (!match) {
        throw new Error(
          'Invalid image source. Must be a Uint8Array or a base64 data URL.',
        );
      }
      data = base64ToUint8Array(match[1]);
    }

    if (data[0] === 0xff && data[1] === 0xd8) {
      return new JPEG(data, label);
    } else if (
      data[0] === 0x89 &&
      data[1] === 0x50 &&
      data[2] === 0x4e &&
      data[3] === 0x47
    ) {
      return new PNG(data, label);
    } else {
      throw new Error('Unknown image format.');
    }
  }
}

export default PDFImage;
