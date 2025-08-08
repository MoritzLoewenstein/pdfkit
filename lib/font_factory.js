import * as fontkit from 'fontkit';
import EmbeddedFont from './font/embedded';
import { isUint8Array } from 'uint8array-extras';

class PDFFontFactory {
  /**
   * @static
   * @param {*} document
   * @param {*} src
   * @param {*} family
   * @param {*} id
   * @returns {EmbeddedFont}
   * @throws {Error} if the font format is not supported
   */
  static open(document, src, family, id) {
    let font;
    if (isUint8Array(src)) {
      font = fontkit.create(src, family);
    } else if (src instanceof ArrayBuffer) {
      font = fontkit.create(new Uint8Array(src), family);
    }

    if (font == null) {
      throw new Error('Not a supported font format');
    }

    return new EmbeddedFont(document, font, id);
  }
}

export default PDFFontFactory;
