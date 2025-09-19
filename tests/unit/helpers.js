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
 * @property {number} x
 * @property {number} y
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
 * Extract a CMap (bfrange) mapping from a stream buffer.
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
    const match = range.trim().match(/<([^>]+)>\s*<([^>]+)>\s*\[(.*?)\]/);
    if (!match) return;

    const [, startHex, endHex, mappings] = match;
    const unicodeValues = mappings.match(/<[^>]+>/g) || [];

    const start = Number.parseInt(startHex, 16);
    const end = Number.parseInt(endHex, 16);

    for (let i = 0; i <= end - start; i++) {
      const sourceHex = (start + i).toString(16).padStart(4, '0');
      const targetHex = unicodeValues[i]?.replace(/[<>]/g, '') || '';
      if (targetHex) {
        const char = String.fromCharCode(parseInt(targetHex, 16));
        charMap.set(sourceHex, char);
      }
    }
  });

  return charMap;
}

/**
 * Parse all text objects (multiple TJ) in a decoded stream.
 * If a CMap is provided, decode hex strings using 4-hex codepoints via the map.
 * @param {string} decodedStream
 * @param {Map<string,string>?} cMap
 * @return {TextStream[]}
 */
function parseTextStreams(decodedStream, cMap = null) {
  const tjRegex = /\[([^\]]+)\]\s+TJ/g;
  const fontRegex = /\/([A-Za-z0-9]+)\s+(\d+(?:\.\d+)?)\s+Tf/g;
  const tmRegex =
    /([+-]?\d+(?:\.\d+)?)\s+([+-]?\d+(?:\.\d+)?)\s+([+-]?\d+(?:\.\d+)?)\s+([+-]?\d+(?:\.\d+)?)\s+([+-]?\d+(?:\.\d+)?)\s+([+-]?\d+(?:\.\d+)?)\s+Tm/g;
  const cmRegex =
    /([+-]?\d+(?:\.\d+)?)\s+([+-]?\d+(?:\.\d+)?)\s+([+-]?\d+(?:\.\d+)?)\s+([+-]?\d+(?:\.\d+)?)\s+([+-]?\d+(?:\.\d+)?)\s+([+-]?\d+(?:\.\d+)?)\s+cm/g;
  /** @type {TextStream[]} */
  const results = [];
  let tjMatch;

  while ((tjMatch = tjRegex.exec(decodedStream)) !== null) {
    const tjIndex = tjMatch.index;
    let fMatch;
    let lastFontName;
    let lastFontSize;
    fontRegex.lastIndex = 0;
    while (
      (fMatch = fontRegex.exec(decodedStream)) !== null &&
      fMatch.index < tjIndex
    ) {
      lastFontName = fMatch[1];
      lastFontSize = parseFloat(fMatch[2]);
    }
    if (!lastFontName || !lastFontSize) continue;

    // Find the nearest preceding text matrix (Tm) and current transformation (cm)
    let tmMatch;
    let lastTm = undefined;
    tmRegex.lastIndex = 0;
    while (
      (tmMatch = tmRegex.exec(decodedStream)) !== null &&
      tmMatch.index < tjIndex
    ) {
      lastTm = tmMatch;
    }
    // Default to origin if no Tm found
    let tx = 0;
    let ty = 0;
    if (lastTm) {
      tx = parseFloat(lastTm[5]);
      ty = parseFloat(lastTm[6]);
    }

    // Find the nearest preceding cm (CTM)
    let cmMatch;
    let lastCm = undefined;
    cmRegex.lastIndex = 0;
    while (
      (cmMatch = cmRegex.exec(decodedStream)) !== null &&
      cmMatch.index < tjIndex
    ) {
      lastCm = cmMatch;
    }
    // Apply transform: [a b c d e f] to point (tx, ty)
    let x = tx;
    let y = ty;
    if (lastCm) {
      const a = parseFloat(lastCm[1]);
      const b = parseFloat(lastCm[2]);
      const c = parseFloat(lastCm[3]);
      const d = parseFloat(lastCm[4]);
      const e = parseFloat(lastCm[5]);
      const f = parseFloat(lastCm[6]);
      x = a * tx + c * ty + e;
      y = b * tx + d * ty + f;
    }

    const arrayContent = tjMatch[1];
    let text = '';
    const hexMatches = [...arrayContent.matchAll(/<([0-9a-fA-F]+)>/g)];
    for (const m of hexMatches) {
      const hex = m[1];
      if (cMap) {
        for (let i = 0; i < hex.length; i += 4) {
          const codeHex = hex.substring(i, i + 4).toLowerCase();
          if (cMap.has(codeHex)) {
            text += cMap.get(codeHex);
          } else {
            throw new Error(`Hex not in CMap ${codeHex}`);
          }
        }
      } else {
        for (let i = 0; i < hex.length; i += 2) {
          const code = parseInt(hex.substring(i, i + 2), 16);
          let char = String.fromCharCode(code);
          if (code === 0x0a) char = '\n';
          else if (code === 0x0d) char = '\r';
          else if (code === 0x85) char = '...';
          text += char;
        }
      }
    }
    results.push({ text, font: lastFontName, fontSize: lastFontSize, x, y });
  }

  return results;
}

export { logData, joinTokens, parseTextStreams, getObjects, getCMap };
