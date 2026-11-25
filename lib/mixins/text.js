import LineWrapper from '../line_wrapper';
import PDFObject from '../object';
import { cosine, sine } from '../utils';

const { number } = PDFObject;

// Do not collapse mandatory line breaks along with spaces and tabs.
const COLLAPSIBLE_SPACES = /[^\S\r\n\u2028\u2029]{2,}/g;

function renderedTextWidth(document, text, options, wordSpacing) {
  if (!wordSpacing) return text ? document.widthOfString(text, options) : 0;

  // With word spacing the renderer encodes words separately and discards
  // leading/trailing whitespace. Unicode wrap opportunities are not word gaps.
  const words = text.trim().split(/\s+/);
  if (!words[0]) return 0;
  const scale = (options.horizontalScaling || 100) / 100;
  return (
    words.reduce(
      (width, word) => width + document.widthOfString(word, options),
      0,
    ) +
    (words.length - 1) *
      (document.widthOfString(' ', options) +
        (2 * (options.characterSpacing || 0) + wordSpacing) * scale)
  );
}

/**
 * Format a list label based on the list type
 * @param {number} n
 * @param {'numbered' | 'lettered'} listType
 * @returns {string}
 */
function formatListLabel(n, listType) {
  if (listType === 'numbered') {
    return `${n}.`;
  }

  // lettered
  var letter = String.fromCharCode(((n - 1) % 26) + 65);
  var times = Math.floor((n - 1) / 26 + 1);
  var text = Array(times + 1).join(letter);
  return `${text}.`;
}

export default {
  initText() {
    this._line = this._line.bind(this);
    // Current coordinates
    this.x = 0;
    this.y = 0;
    this._lineGap = 0;
  },

  lineGap(_lineGap) {
    this._lineGap = _lineGap;
    return this;
  },

  moveDown(lines) {
    if (lines == null) {
      lines = 1;
    }
    this.y += this.currentLineHeight(true) * lines + this._lineGap;
    return this;
  },

  moveUp(lines) {
    if (lines == null) {
      lines = 1;
    }
    this.y -= this.currentLineHeight(true) * lines + this._lineGap;
    return this;
  },

  _text(text, x, y, options, lineCallback) {
    options = this._initOptions(x, y, options);

    // Convert text to a string
    text = text == null ? '' : `${text}`;

    // if the wordSpacing option is specified, remove multiple consecutive spaces
    if (options.wordSpacing) {
      text = text.replace(COLLAPSIBLE_SPACES, ' ');
    }

    const addStructure = () => {
      if (options.structParent) {
        options.structParent.add(
          this.struct(options.structType || 'P', [
            this.markStructureContent(options.structType || 'P'),
          ]),
        );
      }
    };

    // We can save some bytes if there is no rotation
    if (options.rotation !== 0) {
      this.save();
      this.rotate(-options.rotation, { origin: [this.x, this.y] });
    }

    // word wrapping
    if (options.width) {
      let wrapper = this._wrapper;
      if (!wrapper) {
        wrapper = new LineWrapper(this, options);
        wrapper.on('line', lineCallback);
        wrapper.on('firstLine', addStructure);
      }

      this._wrapper = options.continued ? wrapper : null;
      this._textOptions = options.continued ? options : null;
      wrapper.wrap(text, options);

      // render paragraphs as single lines
    } else {
      for (let line of text.split('\n')) {
        addStructure();
        lineCallback(line, options);
      }
    }

    // Cleanup if there was a rotation
    if (options.rotation !== 0) this.restore();

    return this;
  },

  text(text, x, y, options) {
    return this._text(text, x, y, options, this._line);
  },

  widthOfString(string, options = {}) {
    const horizontalScaling = options.horizontalScaling || 100;
    return (
      ((this._font.widthOfString(string, this._fontSize, options.features) +
        (options.characterSpacing || 0) * (string.length - 1)) *
        horizontalScaling) /
      100
    );
  },

  /**
   * Compute the bounding box of a string
   * based on what will actually be rendered by `doc.text()`
   *
   * @param string - The string
   * @param x - X position of text (defaults to this.x)
   * @param y - Y position of text (defaults to this.y)
   * @param options - Any text options (The same you would apply to `doc.text()`)
   * @returns {{x: number, y: number, width: number, height: number}}
   */
  boundsOfString(string, x, y, options) {
    options = this._initOptions(x, y, options);
    ({ x, y } = this);
    const lineGap = options.lineGap ?? this._lineGap ?? 0;
    const lineHeight = this.currentLineHeight(true) + lineGap;
    let contentWidth = 0;
    // Convert text to a string
    string = String(string ?? '');

    // if the wordSpacing option is specified, remove multiple consecutive spaces
    if (options.wordSpacing) {
      string = string.replace(COLLAPSIBLE_SPACES, ' ');
    }

    // word wrapping
    if (options.width) {
      let wrapper = new LineWrapper(this, options);
      wrapper.on('line', (text, options) => {
        this.y += lineHeight;
        text = text.replace(/\n/g, '');

        if (text.length) {
          // handle options
          let wordSpacing = options.wordSpacing ?? 0;
          const characterSpacing = options.characterSpacing ?? 0;

          // justify alignments
          if (options.width && options.align === 'justify') {
            // calculate the word spacing value
            const words = text.trim().split(/\s+/);
            const textWidth = this.widthOfString(
              text.replace(/\s+/g, ''),
              options,
            );
            const spaceWidth = this.widthOfString(' ') + characterSpacing;
            wordSpacing = Math.max(
              0,
              (options.lineWidth - textWidth) / Math.max(1, words.length - 1) -
                spaceWidth,
            );
          }

          // calculate the actual rendered width of the string after word and character spacing
          contentWidth = Math.max(
            contentWidth,
            renderedTextWidth(this, text, options, wordSpacing),
          );
        }
      });
      wrapper.wrap(string, options);
    } else {
      // render paragraphs as single lines
      for (let line of string.split('\n')) {
        const lineWidth = renderedTextWidth(
          this,
          line,
          options,
          options.wordSpacing,
        );
        this.y += lineHeight;
        contentWidth = Math.max(contentWidth, lineWidth);
      }
    }

    let contentHeight = this.y - y;
    // Clamp height to max height
    if (options.height) contentHeight = Math.min(contentHeight, options.height);

    this.x = x;
    this.y = y;

    /**
     * Rotates around top left corner
     * [x1,y1]  >  [x2,y2]
     *    ⌃           ⌄
     * [x4,y4]  <  [x3,y3]
     */
    if (options.rotation === 0) {
      // No rotation so we can use the existing values
      return { x, y, width: contentWidth, height: contentHeight };
      // Use fast computation without explicit trig
    } else if (options.rotation === 90) {
      return {
        x: x,
        y: y - contentWidth,
        width: contentHeight,
        height: contentWidth,
      };
    } else if (options.rotation === 180) {
      return {
        x: x - contentWidth,
        y: y - contentHeight,
        width: contentWidth,
        height: contentHeight,
      };
    } else if (options.rotation === 270) {
      return {
        x: x - contentHeight,
        y: y,
        width: contentHeight,
        height: contentWidth,
      };
    }

    // Non-trivial values so time for trig
    const cos = cosine(options.rotation);
    const sin = sine(options.rotation);

    const x1 = x;
    const y1 = y;
    const x2 = x + contentWidth * cos;
    const y2 = y - contentWidth * sin;
    const x3 = x + contentWidth * cos + contentHeight * sin;
    const y3 = y - contentWidth * sin + contentHeight * cos;
    const x4 = x + contentHeight * sin;
    const y4 = y + contentHeight * cos;

    const xMin = Math.min(x1, x2, x3, x4);
    const xMax = Math.max(x1, x2, x3, x4);
    const yMin = Math.min(y1, y2, y3, y4);
    const yMax = Math.max(y1, y2, y3, y4);

    return { x: xMin, y: yMin, width: xMax - xMin, height: yMax - yMin };
  },

  heightOfString(text, options) {
    const { x, y } = this;

    options = this._initOptions(options);
    options.height = Infinity; // don't break pages
    text = String(text ?? '');
    if (options.wordSpacing) {
      text = text.replace(COLLAPSIBLE_SPACES, ' ');
    }

    const lineGap = options.lineGap || this._lineGap || 0;
    const lineHeight = this.currentLineHeight(true) + lineGap;
    if (!options.width) return text.split('\n').length * lineHeight;

    try {
      // Never reuse the drawing wrapper or change the pending continuation.
      const continuation = options.continued ? this._wrapper : null;
      this.x -= continuation?.appliedIndent ?? 0;
      const wrapper = new LineWrapper(this, options);
      wrapper.continuedX = continuation?.continuedX ?? 0;
      wrapper.on('line', () => {
        this.y += lineHeight;
      });
      options.continued = false;
      wrapper.wrap(text, options);
      return this.y - y;
    } finally {
      this.x = x;
      this.y = y;
    }
  },

  list(list, x, y, options) {
    options = this._initOptions(x, y, options);

    const listType = options.listType || 'bullet';
    const unit = Math.round((this._font.ascender / 1000) * this._fontSize);
    const midLine = unit / 2;
    const r = options.bulletRadius || unit / 3;
    const indent =
      options.textIndent || (listType === 'bullet' ? r * 5 : unit * 2);
    const itemIndent =
      options.bulletIndent || (listType === 'bullet' ? r * 8 : unit * 2);

    // Labels stay at their own indentation and are measured independently.
    const labelOptions = { ...options, width: null };

    let level = 1;
    const items = [];
    const levels = [];
    const numbers = [];

    var flatten = function (list) {
      let n = level === 1 ? (options.start ?? 1) : 1;
      for (let i = 0; i < list.length; i++) {
        const item = list[i];
        if (Array.isArray(item)) {
          level++;
          flatten(item);
          level--;
        } else {
          items.push(item);
          levels.push(level);
          if (listType !== 'bullet') {
            numbers.push(n++);
          }
        }
      }
    };

    flatten(list);

    const drawListItem = function (listItem, i) {
      const wrapper = new LineWrapper(this, options);
      wrapper.on('line', this._line);

      level = 1;
      wrapper.once('firstLine', () => {
        let item, itemType, labelType, bodyType;
        if (options.structParent) {
          if (options.structTypes) {
            [itemType, labelType, bodyType] = options.structTypes;
          } else {
            [itemType, labelType, bodyType] = ['LI', 'Lbl', 'LBody'];
          }
        }

        if (itemType) {
          item = this.struct(itemType);
          options.structParent.add(item);
        } else if (options.structParent) {
          item = options.structParent;
        }

        let l;
        if ((l = levels[i++]) !== level) {
          const diff = itemIndent * (l - level);
          this.x += diff;
          wrapper.lineWidth -= diff;
          level = l;
        }

        if (item && (labelType || bodyType)) {
          item.add(
            this.struct(labelType || bodyType, [
              this.markStructureContent(labelType || bodyType),
            ]),
          );
        }
        switch (listType) {
          case 'bullet':
            this.circle(this.x - indent + r, this.y + midLine, r);
            this.fill();
            break;
          case 'numbered':
          case 'lettered': {
            var text = formatListLabel(numbers[i - 1], listType);
            this._fragment(text, this.x - indent, this.y, labelOptions);
            break;
          }
        }

        if (item && labelType && bodyType) {
          item.add(
            this.struct(bodyType, [this.markStructureContent(bodyType)]),
          );
        }
        if (item && item !== options.structParent) {
          item.end();
        }
      });

      wrapper.on('sectionStart', () => {
        const pos = indent + itemIndent * (level - 1);
        this.x += pos;
        wrapper.lineWidth -= pos;
      });

      wrapper.on('sectionEnd', () => {
        const pos = indent + itemIndent * (level - 1);
        this.x -= pos;
        wrapper.lineWidth += pos;
      });

      wrapper.wrap(listItem, options);
    };

    for (let i = 0; i < items.length; i++) {
      drawListItem.call(this, items[i], i);
    }

    return this;
  },

  _initOptions(x, y, options = {}) {
    if (x && typeof x === 'object') {
      options = x;
      x = null;
    }

    // clone options object
    const result = Object.assign({}, options);

    // extend options with previous values for continued text
    if (this._textOptions) {
      for (let key in this._textOptions) {
        const val = this._textOptions[key];
        if (key !== 'continued') {
          if (result[key] === undefined) {
            result[key] = val;
          }
        }
      }
    }

    // Update the current position
    if (x != null) {
      this.x = x;
    }
    if (y != null) {
      this.y = y;
    }

    // wrap to margins if no x or y position passed
    if (result.lineBreak !== false) {
      if (result.width == null) {
        result.width = this.page.width - this.x - this.page.margins.right;
      }
      result.width = Math.max(result.width, 0);
    }

    if (!result.columns) {
      result.columns = 0;
    }
    if (result.columnGap == null) {
      result.columnGap = 18;
    } // 1/4 inch

    // Normalize rotation to between 0 - 360
    result.rotation = Number(result.rotation ?? 0) % 360;
    if (result.rotation < 0) result.rotation += 360;

    return result;
  },

  _line(text, options = {}, wrapper) {
    this._fragment(text, this.x, this.y, options);

    if (wrapper) {
      const lineGap = options.lineGap || this._lineGap || 0;
      this.y += this.currentLineHeight(true) + lineGap;
    } else {
      this.x += renderedTextWidth(this, text, options, options.wordSpacing);
    }
  },

  _fragment(text, x, y, options) {
    let dy, encoded, i, positions, textWidth, words;
    text = `${text}`.replace(/\n/g, '');
    if (text.length === 0) {
      return;
    }

    // handle options
    const align = options.align || 'left';
    let wordSpacing = options.wordSpacing || 0;
    const characterSpacing = options.characterSpacing || 0;
    const horizontalScaling = options.horizontalScaling || 100;

    // text alignments
    if (options.lineWidth != null && options.width) {
      switch (align) {
        case 'right':
          textWidth = renderedTextWidth(
            this,
            text.trimEnd(),
            options,
            wordSpacing,
          );
          x += options.lineWidth - textWidth;
          break;

        case 'center':
          textWidth = renderedTextWidth(this, text, options, wordSpacing);
          x += options.lineWidth / 2 - textWidth / 2;
          break;

        case 'justify': {
          // calculate the word spacing value
          words = text.trim().split(/\s+/);
          textWidth = this.widthOfString(text.replace(/\s+/g, ''), options);
          var spaceWidth = this.widthOfString(' ') + characterSpacing;
          wordSpacing = Math.max(
            0,
            (options.lineWidth - textWidth) / Math.max(1, words.length - 1) -
              spaceWidth,
          );
          break;
        }
      }
    }

    // text baseline alignments based on http://wiki.apache.org/xmlgraphics-fop/LineLayout/AlignmentHandling
    if (typeof options.baseline === 'number') {
      dy = -options.baseline;
    } else {
      switch (options.baseline) {
        case 'svg-middle':
          dy = 0.5 * this._font.xHeight;
          break;
        case 'middle':
        case 'svg-central':
          dy = 0.5 * (this._font.descender + this._font.ascender);
          break;
        case 'bottom':
        case 'ideographic':
          dy = this._font.descender;
          break;
        case 'alphabetic':
          dy = 0;
          break;
        case 'mathematical':
          dy = 0.5 * this._font.ascender;
          break;
        case 'hanging':
          dy = 0.8 * this._font.ascender;
          break;
        case 'top':
          dy = this._font.ascender;
          break;
        default:
          dy = this._font.ascender;
      }
      dy = (dy / 1000) * this._fontSize;
    }

    const lineTop = y + dy - (this._font.ascender / 1000) * this._fontSize;
    const renderedWidth =
      options.link != null ||
      options.goTo != null ||
      options.underline ||
      options.strike
        ? renderedTextWidth(this, text, options, wordSpacing)
        : 0;

    // create link annotations if the link option is given
    if (options.link != null) {
      const linkOptions = {};
      const structParent = this._currentStructureElement;
      if (structParent?.dictionary.data.S === 'Link') {
        linkOptions.structParent = structParent;
      }
      this.link(
        x,
        lineTop,
        renderedWidth,
        this.currentLineHeight(),
        options.link,
        linkOptions,
      );
    }
    if (options.goTo != null) {
      this.goTo(
        x,
        lineTop,
        renderedWidth,
        this.currentLineHeight(),
        options.goTo,
      );
    }
    if (options.destination != null) {
      this.addNamedDestination(options.destination, 'XYZ', x, y, null);
    }

    // create underline
    if (options.underline) {
      this.save();
      if (!options.stroke) {
        this.strokeColor(...(this._fillColor || []));
      }

      const lineWidth =
        options.decorationThickness ??
        (this._fontSize < 10 ? 0.5 : Math.floor(this._fontSize / 10));
      this.lineWidth(lineWidth);

      const lineY =
        lineTop +
        this.currentLineHeight() -
        lineWidth +
        (options.underlineOffset ?? 0);
      this.moveTo(x, lineY);
      this.lineTo(x + renderedWidth, lineY);
      this.stroke();
      this.restore();
    }

    // create strikethrough line
    if (options.strike) {
      this.save();
      if (!options.stroke) {
        this.strokeColor(...(this._fillColor || []));
      }

      const lineWidth =
        options.decorationThickness ??
        (this._fontSize < 10 ? 0.5 : Math.floor(this._fontSize / 10));
      this.lineWidth(lineWidth);

      const lineY = lineTop + this.currentLineHeight() / 2;
      this.moveTo(x, lineY);
      this.lineTo(x + renderedWidth, lineY);
      this.stroke();
      this.restore();
    }

    this.save();

    // oblique (angle in degrees or boolean)
    if (options.oblique) {
      let skew;
      if (typeof options.oblique === 'number') {
        skew = -Math.tan((options.oblique * Math.PI) / 180);
      } else {
        skew = -0.25;
      }
      this.transform(1, 0, 0, 1, x, y);
      this.transform(1, 0, skew, 1, -skew * dy, 0);
      this.transform(1, 0, 0, 1, -x, -y);
    }

    // flip coordinate system
    this.transform(1, 0, 0, -1, 0, this.page.height);
    y = this.page.height - y - dy;

    // add current font to page if necessary
    if (this.page.fonts[this._font.id] == null) {
      this.page.fonts[this._font.id] = this._font.ref();
    }

    // begin the text object
    this.addContent('BT');

    // text position
    this.addContent(`1 0 0 1 ${number(x)} ${number(y)} Tm`);

    // font and font size
    this.addContent(`/${this._font.id} ${number(this._fontSize)} Tf`);

    // rendering mode
    const mode = options.fill && options.stroke ? 2 : options.stroke ? 1 : 0;
    if (mode) {
      this.addContent(`${mode} Tr`);
    }

    // Character spacing
    if (characterSpacing) {
      this.addContent(`${number(characterSpacing)} Tc`);
    }

    // Horizontal scaling
    if (horizontalScaling !== 100) {
      this.addContent(`${horizontalScaling} Tz`);
    }

    // Add the actual text
    // If we have a word spacing value, we need to encode each word separately
    // since the normal Tw operator only works on character code 32, which isn't
    // used for embedded fonts.
    if (wordSpacing) {
      words = text.trim().split(/\s+/);
      wordSpacing += this.widthOfString(' ') + characterSpacing;
      wordSpacing *= 1000 / this._fontSize;

      encoded = [];
      positions = [];
      for (let word of words) {
        const [encodedWord, positionsWord] = this._font.encode(
          word,
          options.features,
        );
        encoded = encoded.concat(encodedWord);
        positions = positions.concat(positionsWord);

        // add the word spacing to the end of the word
        // clone object because of cache
        const space = {};
        const object = positions[positions.length - 1];
        if (!object) continue;
        for (let key in object) {
          const val = object[key];
          space[key] = val;
        }
        space.xAdvance += wordSpacing;
        positions[positions.length - 1] = space;
      }
    } else {
      [encoded, positions] = this._font.encode(text, options.features);
    }

    const scale = this._fontSize / 1000;
    const commands = [];
    let last = 0;
    let hadOffset = false;

    // Adds a segment of text to the TJ command buffer
    const addSegment = (cur) => {
      if (last < cur) {
        const hex = encoded.slice(last, cur).join('');
        const advance =
          positions[cur - 1].xAdvance - positions[cur - 1].advanceWidth;
        commands.push(`<${hex}> ${number(-advance)}`);
      }

      last = cur;
    };

    // Flushes the current TJ commands to the output stream
    const flush = (i) => {
      addSegment(i);

      if (commands.length > 0) {
        this.addContent(`[${commands.join(' ')}] TJ`);
        commands.length = 0;
      }
    };

    for (i = 0; i < positions.length; i++) {
      // If we have an x or y offset, we have to break out of the current TJ command
      // so we can move the text position.
      const pos = positions[i];
      if (pos.xOffset || pos.yOffset) {
        // Flush the current buffer
        flush(i);

        // Move the text position and flush just the current character
        this.addContent(
          `1 0 0 1 ${number(x + pos.xOffset * scale)} ${number(
            y + pos.yOffset * scale,
          )} Tm`,
        );
        flush(i + 1);

        hadOffset = true;
      } else {
        // If the last character had an offset, reset the text position
        if (hadOffset) {
          this.addContent(`1 0 0 1 ${number(x)} ${number(y)} Tm`);
          hadOffset = false;
        }

        // Group segments that don't have any advance adjustments
        if (pos.xAdvance - pos.advanceWidth !== 0) {
          addSegment(i + 1);
        }
      }

      x += pos.xAdvance * scale;
    }

    // Flush any remaining commands
    flush(i);

    // end the text object
    this.addContent('ET');

    // restore flipped coordinate system
    this.restore();
  },
};
