import PDFFontFactory from '../font_factory';
import { CM_TO_IN, IN_TO_PT, MM_TO_CM, PC_TO_PT, PX_TO_IN } from '../utils';

const isEqualFont = (a, b) => {
  if (a === b) return true;

  // Compare table directories, not just head.checkSumAdjustment (which is
  // shared by all faces in a TTC). Ignore offsets, which vary by container.
  const tables = a.directory?.tables;
  const otherTables = b.directory?.tables;
  return (
    tables &&
    otherTables &&
    Object.keys(tables).length === Object.keys(otherTables).length &&
    Object.entries(tables).every(
      ([tag, table]) =>
        table.checkSum != null &&
        table.checkSum === otherTables[tag]?.checkSum &&
        table.length === otherTables[tag]?.length,
    ) &&
    JSON.stringify(a.variationCoords) === JSON.stringify(b.variationCoords)
  );
};

export default {
  /**
   * @param {string} fontName
   * @param {ArrayBuffer|Uint8Array|object} fontData Font bytes or a parsed fontkit font
   * @param {string?} [fontFamily=null]
   * @param {number|undefined} [defaultFontSize=12]
   */
  initFonts(fontName, fontData, fontFamily = null, defaultFontSize = 12) {
    if (!(fontName && fontData)) {
      throw new Error(
        'default font data is required, missing options.font, options.fontData',
      );
    }

    // Keep every PDF font by id for finalization, independent of aliases.
    this._fontFamilies = Object.create(null);
    this._fontsByName = new Map();
    this._fontsBySource = new WeakMap();
    this._fontCount = 0;
    this._registeredFonts = Object.create(null);

    // rem size is fixed per document as the document is the root element
    this._remSize = defaultFontSize;

    this.registerFont(fontName, fontData, fontFamily, defaultFontSize);
    this.font(fontName, defaultFontSize);
  },

  font(src, family, size) {
    let named;
    if (typeof family === 'number') {
      size = family;
      family = null;
    }

    if (typeof src === 'string') {
      const registered = this._registeredFonts[src];
      // Registered aliases take precedence over names of loaded fonts.
      if (registered) {
        ({ src, family } = registered);
      } else if ((named = this._fontsByName.get(src)?.[0])) {
        src = named.font;
        family = null;
      }
    }

    this._fontSource = src;
    this._fontFamily = family;
    if (size != null) {
      this.fontSize(size);
    }

    // Cache by both the source object and its collection face.
    const face = family ?? null;
    let fontsByFace = this._fontsBySource.get(src);
    const cached = named ?? fontsByFace?.get(face);
    if (cached) {
      this._font = cached;
      return this;
    }

    const id = `F${++this._fontCount}`;
    const opened = PDFFontFactory.open(this, src, family, id);
    let candidates = this._fontsByName.get(opened.name);
    if (!candidates) {
      candidates = [];
      this._fontsByName.set(opened.name, candidates);
    }
    const equivalent = candidates.find(({ font }) =>
      isEqualFont(opened.font, font),
    );
    if (!equivalent) {
      candidates.push(opened);
      this._fontFamilies[id] = opened;
    }

    this._font = equivalent ?? opened;
    if (!fontsByFace) {
      fontsByFace = new Map();
      this._fontsBySource.set(src, fontsByFace);
    }
    fontsByFace.set(face, this._font);
    return this;
  },

  fontSize(_fontSize) {
    this._fontSize = this.sizeToPoint(_fontSize);
    return this;
  },

  currentLineHeight(includeGap) {
    return this._font.lineHeight(this._fontSize, includeGap);
  },

  registerFont(name, src, family) {
    this._registeredFonts[name] = {
      src,
      family,
    };

    return this;
  },

  /**
   * Convert a {@link Size} into a point measurement
   *
   * @param {Size | boolean | undefined} size - The size to convert
   * @param {Size | boolean | undefined} defaultValue - The default value when undefined
   * @param {PDFPage} page - The page used for computing font sizes
   * @param {number} [percentageWidth] - The value to use for computing size based on `%`
   *
   * @returns number
   */
  sizeToPoint(
    size,
    defaultValue = 0,
    page = this.page,
    percentageWidth = undefined,
  ) {
    if (!percentageWidth) percentageWidth = this._fontSize;
    if (typeof defaultValue !== 'number')
      defaultValue = this.sizeToPoint(defaultValue);
    if (size === undefined) return defaultValue;
    if (typeof size === 'number') return size;
    if (typeof size === 'boolean') return Number(size);

    const match = String(size).match(
      /((\d+)?(\.\d+)?)(em|in|px|cm|mm|pc|ex|ch|rem|vw|vh|vmin|vmax|%|pt)?/,
    );
    if (!match) throw new Error(`Unsupported size '${size}'`);
    let multiplier;
    switch (match[4]) {
      case 'em':
        multiplier = this._fontSize;
        break;
      case 'in':
        multiplier = IN_TO_PT;
        break;
      case 'px':
        multiplier = PX_TO_IN * IN_TO_PT;
        break;
      case 'cm':
        multiplier = CM_TO_IN * IN_TO_PT;
        break;
      case 'mm':
        multiplier = MM_TO_CM * CM_TO_IN * IN_TO_PT;
        break;
      case 'pc':
        multiplier = PC_TO_PT;
        break;
      case 'ex':
        multiplier = this.currentLineHeight();
        break;
      case 'ch':
        multiplier = this.widthOfString('0');
        break;
      case 'rem':
        multiplier = this._remSize;
        break;
      case 'vw':
        multiplier = page.width / 100;
        break;
      case 'vh':
        multiplier = page.height / 100;
        break;
      case 'vmin':
        multiplier = Math.min(page.width, page.height) / 100;
        break;
      case 'vmax':
        multiplier = Math.max(page.width, page.height) / 100;
        break;
      case '%':
        multiplier = percentageWidth / 100;
        break;
      case 'pt':
      default:
        multiplier = 1;
    }

    return multiplier * Number(match[1]);
  },
};
