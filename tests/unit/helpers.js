import { isUint8Array, uint8ArrayToString } from 'uint8array-extras';

export function uint8ArrayStringify(data) {
  if (typeof data === 'string') {
    return data;
  }
  if (isUint8Array(data)) {
    return uint8ArrayToString(data);
  }
  throw new Error('Unsupported data type');
}

/**
 * @import PDFDocument from '../../lib/document';
 */

/**
 * @typedef {object} TextStream
 * @property {string} text
 * @property {string} font
 * @property {number} fontSize
 *
 * @typedef {string | Uint8Array} PDFDataItem
 * @typedef {Array<PDFDataItem>} PDFData
 *
 * @typedef {object} PDFDataObject
 * @property {PDFDataItem[]} items
 */

/**
 * @param {PDFDocument} doc
 * @return {PDFData}
 */
function logData(doc) {
  const loggedData = [];
  const originalMethod = doc._write;
  doc._write = function (data) {
    loggedData.push(data);
    originalMethod.call(this, data);
  };
  return loggedData;
}

function escapeRegExp(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); // $& means the whole matched string
}

function joinTokens(...args) {
  let a = args.map((i) => escapeRegExp(i));
  let r = new RegExp('^' + a.join('\\s*') + '$');
  return r;
}

/**
 * @description
 * Returns an array of objects from the PDF data. Object items are surrounded by /\d 0 obj/ and 'endobj'.
 * @param {PDFData} data
 * @return {Array<PDFDataObject>}
 */
function getObjects(data) {
  const objects = [];
  let currentObject = null;
  for (const item of data) {
    if (isUint8Array(item)) {
      if (currentObject) {
        currentObject.items.push(item);
      }
    } else if (typeof item === 'string') {
      if (/^\d+\s0\sobj/.test(item)) {
        currentObject = { items: [] };
        objects.push(currentObject);
      } else if (item === 'endobj') {
        currentObject = null;
      } else if (currentObject) {
        currentObject.items.push(item);
      }
    }
  }
  return objects;
}

/**
 * @param {Uint8Array} bfrangeCandidate
 * @returns {?Map<string,string>} hex charcode to utf8 char
 */
function getCMap(bfrangeCandidate) {
  const RE_BFRANGE = /beginbfrange\s*([\s\S]*?)endbfrange/;
  const objectText = uint8ArrayStringify(bfrangeCandidate);
  const bfrangeMatch = objectText.match(RE_BFRANGE);
  if (!bfrangeMatch) {
    return null;
  }

  const charMap = new Map();
  const bfrangeContent = bfrangeMatch[1];
  const ranges = bfrangeContent.trim().split('\n');
  ranges.forEach((range) => {
    // Parse single range mapping like:
    // <0000> <0009> [<0000> <0073> <0069> <006d> <0070> <006c> <0065> <0020> <0074> <0078>]
    const match = range.trim().match(/<([^>]+)>\s*<([^>]+)>\s*\[(.*?)\]/);
    if (!match) return;

    const [, startHex, endHex, mappings] = match;
    const unicodeValues = mappings.match(/<[^>]+>/g) || [];

    const start = Number.parseInt(startHex, 16);
    const end = Number.parseInt(endHex, 16);

    // Map each value in range
    for (let i = 0; i <= end - start; i++) {
      const sourceHex = (start + i).toString(16).padStart(4, '0');
      const targetHex = unicodeValues[i]?.replace(/[<>]/g, '') || '';
      if (targetHex) {
        // Convert hex to actual UTF-8 character
        const char = String.fromCharCode(parseInt(targetHex, 16));
        charMap.set(sourceHex, char);
      }
    }
  });

  return charMap;
}

/**
 * @param {Uint8Array} textStream
 * @param {Map<string,string>} cMap
 * @return {TextStream | undefined}
 */
function parseTextStream(textStream, cMap = null) {
  const decodedStream = uint8ArrayToString(textStream);

  // Extract font and font size
  const fontMatch = decodedStream.match(/\/([A-Za-z0-9]+)\s+(\d+)\s+Tf/);

  if (!fontMatch) {
    return undefined;
  }

  const font = fontMatch[1];
  const fontSize = parseInt(fontMatch[2], 10);

  // Extract hex strings inside TJ array
  const tjMatch = decodedStream.match(/\[([^\]]+)\]\s+TJ/);
  if (!tjMatch) {
    return undefined;
  }

  // Match all hex strings like <...>
  const hexMatches = [...tjMatch[1].matchAll(/<([0-9a-fA-F]+)>/g)];
  let text = '';

  // if cMap is provided, uses cMap to decode hex chars
  if (cMap !== null) {
    if (!hexMatches) return undefined;

    for (const m of hexMatches) {
      const hexStr = m[1];
      for (let i = 0; i < hexStr.length; i += 4) {
        const hex = hexStr.substring(i, i + 4);
        if (cMap.has(hex)) {
          text += cMap.get(hex);
        } else {
          throw new Error(`Hex not in CMap ${hex}`);
        }
      }
    }
    return { text, font, fontSize };
  }

  // this is a simplified version
  // the correct way is to retrieve the encoding from /Resources /Font dictionary and decode using it
  // https://stackoverflow.com/a/29468049/5724645

  for (const m of hexMatches) {
    // Convert hex to string
    const hex = m[1];
    for (let i = 0; i < hex.length; i += 2) {
      const code = parseInt(hex.substring(i, i + 2), 16);
      let char = String.fromCharCode(code);
      // Handle special cases
      if (code === 0x0a) {
        char = '\n'; // Newline
      } else if (code === 0x0d) {
        char = '\r'; // Carriage return
      } else if (code === 0x85) {
        char = '...';
      }
      text += char;
    }
  }

  return { text, font, fontSize };
}

export { logData, joinTokens, parseTextStream, getObjects, getCMap };
