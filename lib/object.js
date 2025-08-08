/*
PDFObject - converts JavaScript types into their corresponding PDF types.
By Devon Govett
*/

import PDFAbstractReference from './abstract_reference';
import PDFTree from './tree';
import SpotColor from './spotcolor';
import { uint8ArrayToHex, stringToUint8Array, isUint8Array } from 'uint8array-extras';

const escapableRe = /[\n\r\t\b\f()\\]/g;
const escapable = {
  '\n': '\\n',
  '\r': '\\r',
  '\t': '\\t',
  '\b': '\\b',
  '\f': '\\f',
  '\\': '\\\\',
  '(': '\\(',
  ')': '\\)',
};

class PDFObject {
  static convert(object, encryptFn = null) {
    // String literals are converted to the PDF name type
    if (typeof object === 'string') {
      return `/${object}`;

      // String objects are converted to PDF strings (UTF-16)
    } else if (object instanceof String) {
      let string = object;
      // Detect if this is a unicode string
      let isUnicode = false;
      for (let i = 0, end = string.length; i < end; i++) {
        if (string.charCodeAt(i) > 0x7f) {
          isUnicode = true;
          break;
        }
      }

      // If so, encode it as big endian UTF-16
      let bytes;
      if (isUnicode) {
        const unitCount = string.length + 1;
        const buf = new ArrayBuffer(unitCount * 2);
        const dv = new DataView(buf);
        dv.setUint16(0, 0xfeff); // BOM (big-endian)
        for (let i = 0; i < string.length; ++i) {
          dv.setUint16(2 * (i + 1), string.charCodeAt(i));
        }
        bytes = new Uint8Array(buf);
      } else {
        // 7-bit ASCII (== UTF-8 for that range)
        bytes = stringToUint8Array(string);
      }

      // Encrypt the string when necessary
      if (encryptFn) {
        //TODO binary
        string = encryptFn(bytes).toString();
      } else {
        //TODO binary
        string = bytes.toString();
      }

      // Escape characters as required by the spec
      string = string.replace(escapableRe, (c) => escapable[c]);

      return `(${string})`;
    } else if (isUint8Array(object)) {
      return `<${uint8ArrayToHex(object)}>`;
    } else if (
      object instanceof PDFAbstractReference ||
      object instanceof PDFTree ||
      object instanceof SpotColor
    ) {
      return object.toString();
    } else if (object instanceof Date) {
      let string =
        `D:${object.getUTCFullYear().toString().padStart(4, '0')}` +
        (object.getUTCMonth() + 1).toString().padStart(2, '0') +
        object.getUTCDate().toString().padStart(2, '0') +
        object.getUTCHours().toString().padStart(2, '0') +
        object.getUTCMinutes().toString().padStart(2, '0') +
        object.getUTCSeconds().toString().padStart(2, '0') +
        'Z';

      // Encrypt the string when necessary
      if (encryptFn) {
        //TODO binary
        string = encryptFn(stringToUint8Array(string)).toString();
        // Escape characters as required by the spec
        string = string.replace(escapableRe, (c) => escapable[c]);
      }

      return `(${string})`;
    } else if (Array.isArray(object)) {
      const items = object
        .map((e) => PDFObject.convert(e, encryptFn))
        .join(' ');
      return `[${items}]`;
    } else if ({}.toString.call(object) === '[object Object]') {
      const out = ['<<'];
      for (let key in object) {
        const val = object[key];
        out.push(`/${key} ${PDFObject.convert(val, encryptFn)}`);
      }

      out.push('>>');
      return out.join('\n');
    } else if (typeof object === 'number') {
      return PDFObject.number(object);
    } else {
      return `${object}`;
    }
  }

  static number(n) {
    if (n > -1e21 && n < 1e21) {
      return Math.round(n * 1e6) / 1e6;
    }

    throw new Error(`unsupported number: ${n}`);
  }
}

export default PDFObject;
