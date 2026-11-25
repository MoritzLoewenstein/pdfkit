import { beforeEach, describe, expect, test } from 'vitest';
import PDFDocument from '../../lib/document';
import LineWrapper from '../../lib/line_wrapper';

describe('LineWrapper', () => {
  let document;

  beforeEach(() => {
    document = new PDFDocument({
      ...globalThis.HELVETICA_OPTIONS,
      compress: false,
      margin: 0,
    });
  });

  test('ellipsis is present only on last line of multiline text', () => {
    // There is a weird edge case where ellipsis occurs on lines
    // in the middle of text due to number rounding errors
    //
    // There is probably a simpler combination of values but this is one I found in the wild
    document.y = 402.1999999999999;
    document.fontSize(7.26643598615917);
    const wrapper = new LineWrapper(document, {
      width: 300,
      height: 50.399999999999864,
      ellipsis: true,
    });
    let wrapperOutput = '';
    wrapper.on('line', (buffer) => {
      wrapperOutput += buffer;
      document.y += document.currentLineHeight(true);
    });
    wrapper.wrap('- A\n- B\n- C\n- D\n- E\n- F', {});
    expect(wrapperOutput).toBe('- A\n- B\n- C\n- D\n- E\n- F');
  });

  test('line break is handled correctly when at weird heights', () => {
    // There is probably a simpler combination of values but this is one I found in the wild
    document.y = 1 / 3;
    document.fontSize(Math.fround(42.3 / 3));
    let lineHeight = document.currentLineHeight(true);
    const wrapper = new LineWrapper(document, {
      width: 300,
      height: lineHeight * 3,
    });
    let wrapperOutput = '';
    wrapper.on('line', (buffer) => {
      wrapperOutput += buffer;
      document.y += lineHeight;
    });
    // Limit to 3/4 lines
    wrapper.wrap('A\nB\nC\nD', {});
    expect(wrapperOutput).toBe('A\nB\nC\n');
  });

  test('line break is handled correctly with ellipsis', () => {
    // There is probably a simpler combination of values but this is one I found in the wild
    document.y = 1 / 3;
    document.fontSize(Math.fround(42.3 / 3));
    let lineHeight = document.currentLineHeight(true);
    const wrapper = new LineWrapper(document, {
      width: 300,
      height: lineHeight * 3,
      ellipsis: true,
    });
    let wrapperOutput = '';
    wrapper.on('line', (buffer) => {
      wrapperOutput += buffer;
      document.y += lineHeight;
    });
    // Limit to 3/4 lines
    wrapper.wrap('A\nB\nC\nD', {});
    expect(wrapperOutput).toBe('A\nB\nC…');
  });

  test('emits events in order for a single-line text', () => {
    const wrapper = new LineWrapper(document, { width: 300 });
    const events = [];

    wrapper.on('sectionStart', () => events.push('sectionStart'));
    wrapper.on('firstLine', () => events.push('firstLine'));
    wrapper.on('lastLine', () => events.push('lastLine'));
    wrapper.on('line', () => events.push('line'));
    wrapper.on('sectionEnd', () => events.push('sectionEnd'));

    wrapper.wrap('Hello', {});

    expect(events).toEqual([
      'sectionStart',
      'firstLine',
      'lastLine',
      'line',
      'sectionEnd',
    ]);
  });

  test('emits events in order for a single-line text that triggers a page break', () => {
    const wrapper = new LineWrapper(document, { width: 300 });
    const events = [];

    document.text('at the bottom of the page', 0, 770);

    wrapper.on('sectionStart', () => events.push('sectionStart'));
    wrapper.on('firstLine', () => events.push('firstLine'));
    wrapper.on('lastLine', () => events.push('lastLine'));
    wrapper.on('line', () => {
      events.push('line');
      // mimic line height adjustment
      document.y += document.currentLineHeight(true);
    });
    wrapper.on('sectionEnd', () => events.push('sectionEnd'));

    wrapper.wrap('Hello', {});

    expect(events).toEqual([
      'sectionStart',
      'firstLine',
      'lastLine',
      'line',
      'sectionEnd',
    ]);
  });

  test('emits nested events when content spans in multiple pages', () => {
    const wrapper = new LineWrapper(document, { width: 300 });

    const events = [];

    document.text('near the bottom of the page', 0, 740);

    wrapper.on('sectionStart', () => events.push('sectionStart'));
    wrapper.on('firstLine', () => events.push('firstLine'));
    wrapper.on('lastLine', () => events.push('lastLine'));
    wrapper.on('line', () => {
      events.push('line');
      // mimic line height adjustment
      document.y += document.currentLineHeight(true);
    });
    wrapper.on('sectionEnd', () => events.push('sectionEnd'));

    wrapper.wrap(
      `multiple lines of text that should span across pages`.repeat(4),
      {},
    );

    expect(events).toEqual([
      'sectionStart',
      'firstLine',
      'line',
      'line',
      'line',
      'sectionEnd',
      'sectionStart',
      'line',
      'lastLine',
      'line',
      'sectionEnd',
    ]);
  });

  test('emits columnBreak then pageBreak on overflow', () => {
    // Set near bottom so first line triggers a section change immediately
    const lh = document.currentLineHeight(true);
    document.y = document.page.maxY() - lh + 0.5;

    const wrapper = new LineWrapper(document, { width: 300, columns: 2 });

    let columnBreaks = 0;
    let pageBreaks = 0;
    wrapper.on('columnBreak', () => columnBreaks++);
    wrapper.on('pageBreak', () => pageBreaks++);

    // First wrap should overflow to the next column
    wrapper.wrap('A', {});
    expect(columnBreaks).toBeGreaterThanOrEqual(1);

    // Move near bottom again; second overflow should create a new page
    document.y = document.page.maxY() - lh + 0.5;
    wrapper.wrap('B', {});
    expect(pageBreaks).toBeGreaterThanOrEqual(1);
  });

  test('runs each section hook once when clipping at the height limit', () => {
    const height = document.currentLineHeight(true);
    const wrapper = new LineWrapper(document, { width: 300, height });
    const events = [];
    wrapper.on('sectionStart', () => events.push('start'));
    wrapper.on('line', () => {
      document.y += height;
    });
    wrapper.on('sectionEnd', () => events.push('end'));
    wrapper.wrap('first\nsecond', {});
    expect(events).toEqual(['start', 'end']);
  });

  test.each([
    { columns: 50 },
    { columns: 3, columnGap: 400 },
    { indent: 500, indentAllLines: true },
    { columns: 50, characterSpacing: 2 },
  ])('consumes every character with a negative line width (%o)', (layout) => {
    let pages = 1;
    document.on('pageAdded', () => {
      if (++pages > 20) throw new Error('text keeps adding pages');
    });
    const options = { width: 100, ...layout };
    const wrapper = new LineWrapper(document, options);
    const lines = [];
    wrapper.on('line', (line) => {
      lines.push(line);
      document.y += document.currentLineHeight(true);
    });
    wrapper.wrap('hello world', options);
    expect(lines.join('')).toBe('hello world');
  });

  test.each([false, true])(
    'keeps all lines indented through paragraphs and page breaks (orphan: %s)',
    (orphan) => {
      const options = { width: 300, indent: 50, indentAllLines: true };
      document.x = 30;
      document.y = document.page.maxY() - (orphan ? 2 : 20);
      const wrapper = new LineWrapper(document, options);
      let pages = 1;
      document.on('pageAdded', () => pages++);
      wrapper.on('line', () => {
        expect(document.x).toBe(80);
        expect(wrapper.lineWidth).toBe(250);
        document.y += document.currentLineHeight(true);
      });
      wrapper.wrap('word word\n'.repeat(150), options);
      expect(pages).toBeGreaterThan(2);
      expect(document.x).toBe(30);
    },
  );

  test.each([
    ['a ', 'design-system', 'a design-', 'system'],
    [
      'see ',
      'https://github.com/foliojs/pdfkit',
      'see https://github.com/foliojs/',
      'pdfkit',
    ],
  ])(
    'keeps "%s%s" in one piece with whitespace wrapping',
    (prefix, word, first, second) => {
      const wrap = (lineBreak) => {
        const options = {
          width: document.widthOfString(prefix + word) - 1,
          lineBreak,
        };
        const wrapper = new LineWrapper(document, options);
        const lines = [];
        wrapper.on('line', (line) => lines.push(line.trimEnd()));
        wrapper.wrap(prefix + word, options);
        return lines;
      };
      expect(wrap()).toEqual([first, second]);
      expect(wrap('whitespace')).toEqual([prefix.trim(), word]);
    },
  );
});
