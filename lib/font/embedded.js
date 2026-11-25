import PDFFont from '../font';

const toHex = function (num) {
  return `0000${num.toString(16)}`.slice(-4);
};

// The WinAnsi codes whose Unicode values differ from their byte values.
// Null entries are undefined in the 0x80–0x9f block.
const WIN_ANSI_EXTENDED = [
  0x20ac,
  null,
  0x201a,
  0x0192,
  0x201e,
  0x2026,
  0x2020,
  0x2021,
  0x02c6,
  0x2030,
  0x0160,
  0x2039,
  0x0152,
  null,
  0x017d,
  null,
  null,
  0x2018,
  0x2019,
  0x201c,
  0x201d,
  0x2022,
  0x2013,
  0x2014,
  0x02dc,
  0x2122,
  0x0161,
  0x203a,
  0x0153,
  null,
  0x017e,
  0x0178,
];

function cmapBlocks(operator, entries) {
  // The CMap operators allow at most 100 entries per block.
  const blocks = [];
  for (let start = 0; start < entries.length; start += 100) {
    const block = entries.slice(start, start + 100);
    blocks.push(
      `${block.length} begin${operator}\n${block.join('\n')}\nend${operator}`,
    );
  }
  return blocks.join('\n');
}

class EmbeddedFont extends PDFFont {
  constructor(document, font, id) {
    super();
    this.document = document;
    this.font = font;
    this.id = id;
    this.subset = this.font.createSubset();
    this.unicode = [[0]];
    this.widths = [this.font.getGlyph(0).advanceWidth];

    this.name = this.font.postscriptName;
    this.scale = 1000 / this.font.unitsPerEm;
    this.ascender = this.font.ascent * this.scale;
    this.descender = this.font.descent * this.scale;
    this.xHeight = this.font.xHeight * this.scale;
    this.capHeight = this.font.capHeight * this.scale;
    this.lineGap = this.font.lineGap * this.scale;
    this.bbox = this.font.bbox;

    if (document.options.fontLayoutCache !== false) {
      this.layoutCache = Object.create(null);
    }
  }

  layoutRun(text, features) {
    const run = this.font.layout(text, features);

    // Normalize position values
    for (let i = 0; i < run.positions.length; i++) {
      const position = run.positions[i];
      for (let key in position) {
        position[key] *= this.scale;
      }

      position.advanceWidth = run.glyphs[i].advanceWidth * this.scale;
    }

    return run;
  }

  layoutCached(text) {
    if (!this.layoutCache) {
      return this.layoutRun(text);
    }
    let cached;
    if ((cached = this.layoutCache[text])) {
      return cached;
    }

    const run = this.layoutRun(text);
    this.layoutCache[text] = run;
    return run;
  }

  layout(text, features, onlyWidth) {
    // Skip the cache if any user defined features are applied
    if (features) {
      return this.layoutRun(text, features);
    }

    let glyphs = onlyWidth ? null : [];
    let positions = onlyWidth ? null : [];
    let advanceWidth = 0;

    // Split the string by words to increase cache efficiency.
    // For this purpose, spaces and tabs are a good enough delimeter.
    let last = 0;
    let index = 0;
    while (index <= text.length) {
      var needle;
      if (
        (index === text.length && last < index) ||
        ((needle = text.charAt(index)), [' ', '\t'].includes(needle))
      ) {
        const run = this.layoutCached(text.slice(last, ++index));
        if (!onlyWidth) {
          glyphs = glyphs.concat(run.glyphs);
          positions = positions.concat(run.positions);
        }

        advanceWidth += run.advanceWidth;
        last = index;
      } else {
        index++;
      }
    }

    return { glyphs, positions, advanceWidth };
  }

  encode(text, features) {
    const { glyphs, positions } = this.layout(text, features);

    const res = [];
    for (let i = 0; i < glyphs.length; i++) {
      const glyph = glyphs[i];
      const gid = this.subset.includeGlyph(glyph.id);
      res.push(`0000${gid.toString(16)}`.slice(-4));

      if (this.widths[gid] == null) {
        this.widths[gid] = glyph.advanceWidth * this.scale;
      }
      if (this.unicode[gid] == null) {
        this.unicode[gid] = glyph.codePoints;
      }
    }

    return [res, positions];
  }

  widthOfString(string, size, features) {
    const width = this.layout(string, features, true).advanceWidth;
    const scale = size / 1000;
    return width * scale;
  }

  // Forms can request a complete, character-addressable program without
  // changing the glyph-addressed subset used for ordinary page text.
  completeRef() {
    return (this.completeDictionary ??= this.document.ref());
  }

  finalize() {
    if (this.embedded) return;
    if (this.dictionary) this.embed();
    if (this.completeDictionary) this.embedComplete();
    this.embedded = true;
  }

  embedProgram(subset, complete) {
    const isCFF = subset.cff != null;
    const program = subset.encode();
    const fontFile = this.document.ref();

    if (isCFF) {
      fontFile.data.Subtype = 'CIDFontType0C';
    } else if (complete) {
      fontFile.data.Length1 = program.length;
    }

    fontFile.end(program);

    const familyClass =
      ((this.font['OS/2'] != null
        ? this.font['OS/2'].sFamilyClass
        : undefined) || 0) >> 8;
    let flags = 0;
    if (this.font.post.isFixedPitch) {
      flags |= 1 << 0;
    }
    if (1 <= familyClass && familyClass <= 7) {
      flags |= 1 << 1;
    }
    flags |= 1 << 2; // assume the font uses non-latin characters
    if (familyClass === 10) {
      flags |= 1 << 3;
    }
    if (this.font.head.macStyle.italic) {
      flags |= 1 << 6;
    }

    // Only subset programs carry a tag. It is six uppercase letters: 17 is
    // the offset from '0' to 'A', and adding 17 to 73 gives 'Z'.
    const tag = [1, 2, 3, 4, 5, 6]
      .map((i) => String.fromCharCode((this.id.charCodeAt(i) || 73) + 17))
      .join('');
    const postscriptName = this.name?.replaceAll(' ', '_') || this.id;
    const name = complete ? postscriptName : `${tag}+${postscriptName}`;

    const { bbox } = this.font;
    const descriptor = this.document.ref({
      Type: 'FontDescriptor',
      FontName: name,
      Flags: flags,
      FontBBox: [
        bbox.minX * this.scale,
        bbox.minY * this.scale,
        bbox.maxX * this.scale,
        bbox.maxY * this.scale,
      ],
      ItalicAngle: this.font.italicAngle,
      Ascent: this.ascender,
      Descent: this.descender,
      CapHeight: (this.font.capHeight || this.font.ascent) * this.scale,
      XHeight: (this.font.xHeight || 0) * this.scale,
      StemV: 0,
    }); // not sure how to calculate this

    if (isCFF) {
      descriptor.data.FontFile3 = fontFile;
    } else {
      descriptor.data.FontFile2 = fontFile;
    }

    if (!complete && this.document.subset === 1) {
      // Fontkit assigns sequential CIDs, including components it adds when
      // encoding composite TrueType glyphs above.
      const cidCount = subset.glyphs.length;
      const CIDSet = new Uint8Array(Math.ceil(cidCount / 8)).fill(0xff);
      if (cidCount % 8)
        CIDSet[CIDSet.length - 1] = 0xff << (8 - (cidCount % 8));
      const CIDSetRef = this.document.ref();
      CIDSetRef.end(CIDSet);

      descriptor.data.CIDSet = CIDSetRef;
    }

    descriptor.end();

    return { descriptor, name, isCFF };
  }

  embed() {
    const { descriptor, name, isCFF } = this.embedProgram(this.subset, false);
    const descendantFontData = {
      Type: 'Font',
      Subtype: 'CIDFontType0',
      BaseFont: name,
      CIDSystemInfo: {
        Registry: new String('Adobe'),
        Ordering: new String('Identity'),
        Supplement: 0,
      },
      FontDescriptor: descriptor,
      W: [0, this.widths],
    };

    if (!isCFF) {
      descendantFontData.Subtype = 'CIDFontType2';
      descendantFontData.CIDToGIDMap = 'Identity';
    }

    const descendantFont = this.document.ref(descendantFontData);

    descendantFont.end();

    this.dictionary.data = {
      Type: 'Font',
      Subtype: 'Type0',
      BaseFont: name,
      Encoding: 'Identity-H',
      DescendantFonts: [descendantFont],
      ToUnicode: this.toUnicodeCmap(),
    };

    return this.dictionary.end();
  }

  embedComplete() {
    // Including glyphs in their original order preserves glyph ids, while
    // still making fontkit unwrap containers like WOFF/WOFF2 for the PDF.
    const subset = this.font.createSubset();
    const widths = [];
    for (let gid = 0; gid < this.font.numGlyphs; gid++) {
      subset.includeGlyph(gid);
      widths.push(this.font.getGlyph(gid).advanceWidth * this.scale);
    }
    const { descriptor, name, isCFF } = this.embedProgram(subset, true);

    const systemInfo = {
      Registry: new String('Adobe'),
      Ordering: new String('Identity'),
      Supplement: 0,
    };
    const descendantFont = this.document.ref({
      Type: 'Font',
      Subtype: isCFF ? 'CIDFontType0' : 'CIDFontType2',
      BaseFont: name,
      CIDSystemInfo: systemInfo,
      FontDescriptor: descriptor,
      W: [0, widths],
    });
    if (!isCFF) descendantFont.data.CIDToGIDMap = 'Identity';
    descendantFont.end();

    this.completeDictionary.data = {
      Type: 'Font',
      Subtype: 'Type0',
      BaseFont: name,
      Encoding: this.winAnsiToGidCmap(systemInfo),
      DescendantFonts: [descendantFont],
    };
    return this.completeDictionary.end();
  }

  // The subset encoder drops the font's native character maps. Supply a
  // single-byte WinAnsi-to-CID map so readers can resolve field text directly.
  winAnsiToGidCmap(systemInfo) {
    const cmap = this.document.ref({
      Type: 'CMap',
      CMapName: 'Adobe-Identity-WinAnsi',
      CIDSystemInfo: systemInfo,
    });
    const entries = [];
    for (let code = 32; code <= 255; code++) {
      const unicode =
        code >= 0x80 && code <= 0x9f ? WIN_ANSI_EXTENDED[code - 0x80] : code;
      if (unicode != null && this.font.hasGlyphForCodePoint(unicode)) {
        entries.push(
          `<${code.toString(16)}> ${this.font.glyphForCodePoint(unicode).id}`,
        );
      }
    }

    cmap.end(`\
/CIDInit /ProcSet findresource begin
12 dict begin
begincmap
/CIDSystemInfo <<
  /Registry (Adobe)
  /Ordering (Identity)
  /Supplement 0
>> def
/CMapName /Adobe-Identity-WinAnsi def
/CMapType 1 def
1 begincodespacerange
<20> <ff>
endcodespacerange
${cmapBlocks('cidchar', entries)}
endcmap
CMapName currentdict /CMap defineresource pop
end
end\
`);

    return cmap;
  }

  // Maps the glyph ids encoded in the PDF back to unicode strings
  // Because of ligature substitutions and the like, there may be one or more
  // unicode characters represented by each glyph.
  toUnicodeCmap() {
    const cmap = this.document.ref();

    const entries = [];
    for (let codePoints of this.unicode) {
      const encoded = [];

      // encode codePoints to utf16
      for (let value of codePoints) {
        if (value > 0xffff) {
          value -= 0x10000;
          encoded.push(toHex(((value >>> 10) & 0x3ff) | 0xd800));
          value = 0xdc00 | (value & 0x3ff);
        }

        encoded.push(toHex(value));
      }

      entries.push(`<${encoded.join(' ')}>`);
    }

    const chunkSize = 256;
    const chunks = Math.ceil(entries.length / chunkSize);
    const ranges = [];
    for (let i = 0; i < chunks; i++) {
      const start = i * chunkSize;
      const end = Math.min((i + 1) * chunkSize, entries.length);
      ranges.push(
        `<${toHex(start)}> <${toHex(end - 1)}> [${entries.slice(start, end).join(' ')}]`,
      );
    }

    cmap.end(`\
/CIDInit /ProcSet findresource begin
12 dict begin
begincmap
/CIDSystemInfo <<
  /Registry (Adobe)
  /Ordering (UCS)
  /Supplement 0
>> def
/CMapName /Adobe-Identity-UCS def
/CMapType 2 def
1 begincodespacerange
<0000><ffff>
endcodespacerange
${cmapBlocks('bfrange', ranges)}
endcmap
CMapName currentdict /CMap defineresource pop
end
end\
`);

    return cmap;
  }
}

export default EmbeddedFont;
