/*
PDFImage - embeds images in PDF documents
By Devon Govett
*/

import JPEG from './image/jpeg';
import PNG from './image/png';
import { base64ToUint8Array } from 'uint8array-extras';

class PDFImage {
  /**
   * @static
   * @param {Uint8Array|string} src - the source of the image, can be a Uint8Array or a base64 data URL
   * @param {string} label
   * @returns {JPEG|PNG|void} - returns an instance of JPEG or PNG based on the image format
   * @throws {Error} - if the image format is unknown
   */
  static open(src, label) {
    let data;
    if (src instanceof Uint8Array) {
      data = src;
    } else {
      const match = /^data:.+?;base64,(.*)$/.exec(src);
      if (match) {
        data = base64ToUint8Array(match[1]);
      } else {
        return new Error(
          'Invalid image source. Must be a Uint8Array or a base64 data URL.',
        );
      }
    }

    if (data[0] === 0xff && data[1] === 0xd8) {
      return new JPEG(data, label);
    } else if (data[0] === 0x89 && data.toString('ascii', 1, 4) === 'PNG') {
      return new PNG(data, label);
    } else {
      throw new Error('Unknown image format.');
    }
  }
}

export default PDFImage;
