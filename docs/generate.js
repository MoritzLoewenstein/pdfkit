import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { runInNewContext } from 'node:vm';
import { classHighlighter, highlightCode } from '@lezer/highlight';
import { parser } from '@lezer/javascript';
import MarkdownIt from 'markdown-it';
import sharp from 'sharp';
import { createServer } from 'vite';

export const docsDir = import.meta.dirname;
export const outputDir = fileURLToPath(
  new URL('../public/docs', import.meta.url),
);
export const chapters = [
  'getting_started.md',
  'paper_sizes.md',
  'vector.md',
  'text.md',
  'images.md',
  'outline.md',
  'annotations.md',
  'forms.md',
  'destinations.md',
  'attachments.md',
  'accessibility.md',
  'table.md',
  'you_made_it.md',
];

export const markdown = new MarkdownIt();
const lorem =
  'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Etiam in suscipit purus. Vestibulum ante ipsum primis in faucibus orci luctus et ultrices posuere cubilia Curae; Vivamus nec hendrerit felis. Morbi aliquam facilisis risus eu lacinia. Sed eu leo in turpis fringilla hendrerit. Ut nec accumsan nisl. Suspendisse rhoncus nisl posuere tortor tempus et dapibus elit porta. Cras leo neque, elementum a rhoncus ut, vestibulum non nibh. Phasellus pretium justo turpis. Etiam vulputate, odio vitae tincidunt ultricies, eros odio dapibus nisi, ut tincidunt lacus arcu eu elit. Aenean velit erat, vehicula eget lacinia ut, dignissim non tellus. Aliquam nec lacus mi, sed vestibulum nunc. Suspendisse potenti. Curabitur vitae sem turpis. Vestibulum sed neque eget dolor dapibus porttitor at sit amet sem. Fusce a turpis lorem. Vestibulum ante ipsum primis in faucibus orci luctus et ultrices posuere cubilia Curae;';

const fontFiles = {
  body: 'Merriweather-Regular.ttf',
  heading: 'Alegreya-Bold.ttf',
  title: 'AlegreyaSans-Light.ttf',
  code: 'SourceCodePro-Regular.ttf',
  inlineCode: 'SourceCodePro-Bold.ttf',
};

const readAsset = (file) => readFile(join(docsDir, file));

export async function withPdfKit(generate) {
  // Vite resolves the fork's extensionless source imports without requiring a
  // prior library build or starting a listening server.
  const vite = await createServer({
    configFile: false,
    root: join(docsDir, '..'),
    appType: 'custom',
    server: { middlewareMode: true, watch: null, ws: false },
  });
  try {
    const { PDFDocument, toBytes } =
      await vite.ssrLoadModule('/lib/document.js');
    const fonts = Object.fromEntries(
      await Promise.all(
        Object.entries(fontFiles).map(async ([name, file]) => [
          name,
          await readAsset(`fonts/${file}`),
        ]),
      ),
    );
    await generate({ PDFDocument, toBytes, fonts });
  } finally {
    await vite.close();
  }
}

export function isCode(token) {
  return token.type === 'code_block' || token.type === 'fence';
}

function isJavaScript(language) {
  return ['', 'js', 'javascript'].includes(language.trim());
}

export function codeFragments(code, language) {
  if (!isJavaScript(language)) return [{ text: code, classes: '' }];
  const fragments = [];
  highlightCode(
    code,
    parser.parse(code),
    classHighlighter,
    (text, classes = '') => fragments.push({ text, classes }),
    () => fragments.push({ text: '\n', classes: '' }),
  );
  return fragments;
}

export function exampleCode(image, blocks, filename) {
  if (!/^\d+$/.test(image.content)) return undefined;
  const token = blocks[Number(image.content)];
  if (!token || !isJavaScript(token.info)) {
    throw new Error(
      `${filename}: no JavaScript example at index ${image.content}`,
    );
  }
  return token.content;
}

export async function examplePreview(
  { PDFDocument, toBytes, fonts },
  code,
  name,
) {
  try {
    const doc = await runInNewContext(
      `(async () => {\n${code}\nreturn doc;\n})()`,
      {
        PDFDocument,
        doc: new PDFDocument({ font: 'Body', fontData: fonts.body, margin: 0 }),
        imageBytes: await readAsset('images/test.jpeg'),
        readAsset,
        lorem,
      },
      { filename: name },
    );
    doc.end();
    const { getDocument } = await import('pdfjs-dist/legacy/build/pdf.mjs');
    const pdfjsDir = new URL(
      '../../',
      import.meta.resolve('pdfjs-dist/legacy/build/pdf.mjs'),
    );
    const task = getDocument({
      data: await toBytes(doc),
      useSystemFonts: false,
      standardFontDataUrl: fileURLToPath(new URL('standard_fonts/', pdfjsDir)),
      wasmUrl: fileURLToPath(new URL('wasm/', pdfjsDir)),
    });

    try {
      const pdf = await task.promise;
      const page = await pdf.getPage(1);
      const viewport = page.getViewport({ scale: 150 / 72 });
      const factory = pdf.canvasFactory;
      const canvas = factory.create(
        Math.ceil(viewport.width),
        Math.ceil(viewport.height),
      );
      try {
        await page.render({
          canvas: canvas.canvas,
          viewport,
          background: '#fff',
        }).promise;
        return await sharp(canvas.canvas.toBuffer('image/png'))
          .trim({ background: '#fff', threshold: 0 })
          .png()
          .toBuffer();
      } finally {
        page.cleanup();
        factory.destroy(canvas);
      }
    } finally {
      await task.destroy();
    }
  } catch (cause) {
    throw new Error(`Couldn't render ${name}`, { cause });
  }
}

const highlightColors = {
  'tok-atom': '#b11f70',
  'tok-bool': '#b11f70',
  'tok-comment': '#606b72',
  'tok-keyword': '#9c3110',
  'tok-number': '#006e73',
  'tok-operator': '#5457ac',
  'tok-propertyName': '#116d64',
  'tok-string': '#b01336',
  'tok-variableName': '#116d64',
};

function renderCode(doc, token, fonts) {
  const code = token.content.replace(/\n$/, '');
  for (const { text, classes } of codeFragments(code, token.info)) {
    const color = classes
      .split(' ')
      .map((name) => highlightColors[name])
      .find(Boolean);
    const lines = text.split('\n');
    for (let i = 0; i < lines.length; i++) {
      if (i > 0) doc.text('\n', { continued: false });
      if (lines[i]) {
        doc
          .font(fonts.code, 9)
          .fillColor(color || '#24292f')
          .text(lines[i], { continued: true });
      }
    }
  }
  doc.text('', { continued: false });
  doc.moveDown(0.7);
}

function inlineText(token) {
  return token.children
    .map((child) => (child.type.endsWith('break') ? ' ' : child.content))
    .join('');
}

function renderInline(doc, token, fonts, prefix = '') {
  const fragments = prefix ? [{ value: prefix }] : [];
  let link = null;
  let emphasis = false;
  for (const child of token.children) {
    if (child.type === 'link_open') link = child.attrGet('href');
    else if (child.type === 'link_close') link = null;
    else if (child.type === 'em_open' || child.type === 'strong_open')
      emphasis = true;
    else if (child.type === 'em_close' || child.type === 'strong_close')
      emphasis = false;
    else if (child.content || child.type.endsWith('break')) {
      fragments.push({
        value: child.type.endsWith('break') ? ' ' : child.content,
        code: child.type === 'code_inline',
        link,
        emphasis,
      });
    }
  }
  for (const [index, { value, code, link, emphasis }] of fragments.entries()) {
    doc
      .font(code ? fonts.inlineCode : emphasis ? fonts.heading : fonts.body, 10)
      .fillColor(link ? '#174478' : 'black')
      .text(value, {
        link: link ?? null,
        continued: index < fragments.length - 1,
      });
  }
  doc.moveDown(0.7);
}

async function renderChapter(doc, filename, kit) {
  const { fonts } = kit;
  const tokens = markdown.parse(
    await readFile(join(docsDir, filename), 'utf8'),
    {},
  );
  const blocks = tokens.filter(isCode);
  const lists = [];
  let prefix = '';
  let previousHeading = '';
  let chapterOutline;

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    switch (token.type) {
      case 'heading_open': {
        const tag = token.tag;
        const title = inlineText(tokens[++i]);
        if (tag === 'h1' || (tag === 'h2' && !previousHeading)) doc.addPage();
        if (tag === 'h1') chapterOutline = doc.outline.addItem(title);
        if (tag === 'h2') chapterOutline?.addItem(title);
        doc
          .font(fonts.heading, tag === 'h1' ? 25 : 18)
          .fillColor('black')
          .text(title);
        doc.moveDown(0.55);
        previousHeading = tag;
        break;
      }
      case 'inline': {
        const [image] = token.children;
        if (image?.type === 'image' && token.children.length === 1) {
          const code = exampleCode(image, blocks, filename);
          const src = image.attrGet('src');
          if (code === undefined && /^(?:[a-z]+:|\/)/i.test(src)) {
            renderInline(doc, token, fonts, prefix);
          } else {
            const bytes =
              code === undefined
                ? await readAsset(src)
                : await examplePreview(
                    kit,
                    code,
                    `${filename} example ${image.content}`,
                  );
            const { width, height } = await sharp(bytes).metadata();
            const { margins } = doc.page;
            const maxWidth = doc.page.width - margins.left - margins.right;
            const maxHeight = doc.page.height - margins.top - margins.bottom;
            const heightHint = Number(image.attrGet('title'));
            const scale = Math.min(
              code === undefined ? 1 : 72 / 150,
              maxWidth / width,
              (heightHint || maxHeight) / height,
            );
            if (doc.y + height * scale > doc.page.height - margins.bottom)
              doc.addPage();
            doc.image(bytes, { x: margins.left, width: width * scale });
            doc.moveDown(1);
          }
        } else {
          renderInline(doc, token, fonts, prefix);
        }
        prefix = '';
        previousHeading = '';
        break;
      }
      case 'bullet_list_open':
        lists.push(null);
        break;
      case 'ordered_list_open':
        lists.push(Number(token.attrGet('start') ?? 1));
        break;
      case 'bullet_list_close':
      case 'ordered_list_close':
        lists.pop();
        break;
      case 'list_item_open':
        prefix =
          lists.at(-1) === null ? '•  ' : `${lists[lists.length - 1]++}.  `;
        break;
      case 'fence':
      case 'code_block':
        renderCode(doc, token, fonts);
        previousHeading = '';
        break;
      case 'hr':
        doc.addPage();
        previousHeading = 'hr';
        break;
      case 'table_open': {
        const rows = [];
        let alignment;
        while (tokens[++i].type !== 'table_close') {
          const part = tokens[i];
          if (part.type === 'tr_open') rows.push([]);
          if (part.type === 'th_open' || part.type === 'td_open') {
            alignment = part.attrGet('style')?.match(/text-align:(\w+)/)?.[1];
          }
          if (part.type === 'inline')
            rows.at(-1).push({
              text: inlineText(part),
              ...(alignment && { align: { x: alignment } }),
            });
        }
        doc.font(fonts.body, 9).fillColor('black');
        doc.table({ data: rows });
        doc.moveDown(1);
        previousHeading = '';
        break;
      }
    }
  }
}

async function generateGuide(kit) {
  const { PDFDocument, fonts, toBytes } = kit;
  const { version } = JSON.parse(
    await readFile(join(docsDir, '../package.json'), 'utf8'),
  );
  const doc = new PDFDocument({
    font: 'Body',
    fontData: fonts.body,
    info: { Title: 'PDFKit Guide' },
  });
  doc.outline.addItem('PDFKit Guide');
  doc.y = doc.page.height / 2 - 70;
  doc.font(fonts.title, 60).text('PDFKit Guide', { align: 'center' });
  doc.font(fonts.heading, 20).text('By Devon Govett', { align: 'center' });
  doc
    .font(fonts.body, 10)
    .moveDown(0.5)
    .text(`Version ${version}`, { align: 'center' });
  for (const filename of chapters) await renderChapter(doc, filename, kit);
  doc.end();
  await mkdir(outputDir, { recursive: true });
  await writeFile(join(outputDir, 'guide.pdf'), await toBytes(doc));
}

if (
  process.argv[1] &&
  pathToFileURL(process.argv[1]).href === import.meta.url
) {
  await withPdfKit(generateGuide);
  console.log(`Wrote ${join(outputDir, 'guide.pdf')}`);
}
