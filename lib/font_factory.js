import * as fontkit from 'fontkit';
import EmbeddedFont from './font/embedded';

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
    if (src instanceof Uint8Array) {
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
