import { copyFile, cp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import pug from 'pug';
import {
  chapters,
  codeFragments,
  docsDir,
  exampleCode,
  examplePreview,
  isCode,
  markdown,
  outputDir,
  withPdfKit,
} from './generate.js';

const escapeHtml = markdown.utils.escapeHtml;
markdown.options.highlight = (code, language) =>
  codeFragments(code, language)
    .map(({ text, classes }) =>
      classes
        ? `<span class="${classes}">${escapeHtml(text)}</span>`
        : escapeHtml(text),
    )
    .join('');
markdown.renderer.rules.code_block = (tokens, i, options) =>
  `<pre><code class="language-javascript">${options.highlight(tokens[i].content, 'javascript')}</code></pre>\n`;

function preparePage(tokens, chapterLinks) {
  const headers = [];
  const ids = new Set();
  for (const [index, token] of tokens.entries()) {
    if (token.type === 'heading_open') {
      const title = tokens[index + 1].children
        .map((child) => child.content)
        .join('');
      const slug =
        title
          .trim()
          .toLowerCase()
          .replace(/[^\p{L}\p{N}\s_-]/gu, '')
          .replace(/\s+/g, '-') || 'section';
      let id = slug;
      for (let suffix = 1; ids.has(id); suffix++) id = `${slug}-${suffix}`;
      ids.add(id);
      token.attrSet('id', id);
      headers.push({ title, id });
    }

    for (const child of token.children ?? []) {
      if (child.type !== 'link_open') continue;
      const [target, hash] = child.attrGet('href').split('#');
      if (chapterLinks.has(target)) {
        child.attrSet(
          'href',
          `${chapterLinks.get(target)}${hash ? `#${hash}` : ''}`,
        );
      }
    }
  }
  return headers;
}

await withPdfKit(async (kit) => {
  await mkdir(join(outputDir, 'img'), { recursive: true });
  await Promise.all([
    ...['website.css', 'website.js'].map((file) =>
      copyFile(join(docsDir, file), join(outputDir, file)),
    ),
    cp(join(docsDir, 'images'), join(outputDir, 'images'), { recursive: true }),
    copyFile(
      join(docsDir, '../examples/kitchen-sink.pdf'),
      join(outputDir, 'kitchen-sink.pdf'),
    ),
  ]);

  const chapterLinks = new Map(
    chapters.map((file) => [file, file.replace(/\.md$/, '.html')]),
  );
  const pages = [];
  for (const [file, url] of [['../README.md', 'index.html'], ...chapterLinks]) {
    const tokens = markdown.parse(
      await readFile(join(docsDir, file), 'utf8'),
      {},
    );
    const headers = preparePage(tokens, chapterLinks);
    const blocks = tokens.filter(isCode);
    let previewIndex = 0;
    for (const token of tokens) {
      const image = token.children?.length === 1 && token.children[0];
      if (image?.type !== 'image') continue;
      const code = exampleCode(image, blocks, file);
      if (code === undefined) continue;
      const preview = await examplePreview(
        kit,
        code,
        `${file} example ${image.content}`,
      );
      const src = `img/${url.replace(/\.html$/, '')}-${previewIndex++}.png`;
      await writeFile(join(outputDir, src), preview);
      image.attrSet('src', src);
      image.children[0].content = `Output of example ${image.content}`;
      if (image.attrGet('title') && /^\d+$/.test(image.attrGet('title'))) {
        image.attrs = image.attrs.filter(([name]) => name !== 'title');
      }
    }
    const title = tokens.find(
      (token) => token.type === 'heading_open' && token.tag === 'h1',
    );
    const titleIndex = headers.findIndex(
      ({ id }) => id === title?.attrGet('id'),
    );
    const [pageTitle] = titleIndex === -1 ? [] : headers.splice(titleIndex, 1);
    pages.push({
      url,
      title: pageTitle?.title ?? headers[0]?.title ?? file,
      headers,
      content: markdown.renderer.render(tokens, markdown.options, {}),
    });
  }

  const render = pug.compileFile(join(docsDir, 'template.pug'));
  for (const [index, page] of pages.entries()) {
    await writeFile(join(outputDir, page.url), render({ page, pages, index }));
  }
});

console.log(`Wrote website to ${outputDir}`);
