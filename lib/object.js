/*
PDFObject - converts JavaScript types into their corresponding PDF types.
By Devon Govett
*/

import {
  isUint8Array,
  stringToUint8Array,
  uint8ArrayToHex,
} from 'uint8array-extras';
import PDFAbstractReference from './abstract_reference';
import SpotColor from './spotcolor';
import PDFTree from './tree';

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

export function escapeName(name) {
  let escaped = '';
  for (const char of name) {
    const code = char.charCodeAt(0);
    escaped +=
      code <= 32 || code === 127 || '#%()/<>[]{}'.includes(char)
        ? `#${code.toString(16).toUpperCase().padStart(2, '0')}`
        : char;
  }
  return escaped;
}

class PDFObject {
  static convert(object, encryptFn = null) {
    // String literals are converted to the PDF name type
    if (typeof object === 'string') {
      return `/${object}`;

      // String objects are converted to PDF strings (UTF-16)
    } else if (object instanceof String) {
      const string = object.valueOf();
      const isUnicode = /\P{ASCII}/u.test(string);

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
      } else if (encryptFn) {
        bytes = stringToUint8Array(string);
      }

      // Keep binary strings out of the UTF-8 structural output.
      if (encryptFn) return PDFObject.convert(encryptFn(bytes));
      if (isUnicode) return PDFObject.convert(bytes);
      return `(${string.replace(escapableRe, (c) => escapable[c])})`;
    } else if (isUint8Array(object)) {
      return `<${uint8ArrayToHex(object)}>`;
    } else if (object instanceof PDFTree) {
      return object.toString(encryptFn);
    } else if (
      object instanceof PDFAbstractReference ||
      object instanceof SpotColor
    ) {
      return object.toString();
    } else if (object instanceof Date) {
      const string =
        `D:${object.getUTCFullYear().toString().padStart(4, '0')}` +
        (object.getUTCMonth() + 1).toString().padStart(2, '0') +
        object.getUTCDate().toString().padStart(2, '0') +
        object.getUTCHours().toString().padStart(2, '0') +
        object.getUTCMinutes().toString().padStart(2, '0') +
        object.getUTCSeconds().toString().padStart(2, '0') +
        'Z';

      if (encryptFn) {
        return PDFObject.convert(encryptFn(stringToUint8Array(string)));
      }

      return `(${string})`;
    } else if (Array.isArray(object)) {
      const items = [];
      for (let i = 0; i < object.length; i++) {
        items.push(PDFObject.convert(object[i] ?? null, encryptFn));
      }
      return `[${items.join(' ')}]`;
    } else if ({}.toString.call(object) === '[object Object]') {
      const out = ['<<'];
      for (let key in object) {
        const val = object[key];
        if (val === undefined) continue;
        out.push(`/${key} ${PDFObject.convert(val, encryptFn)}`);
      }

      out.push('>>');
      return out.join('\n');
    } else if (typeof object === 'number') {
      return PDFObject.number(object);
    } else {
      return `${object ?? null}`;
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
