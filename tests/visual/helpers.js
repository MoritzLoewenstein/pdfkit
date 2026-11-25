import { readFileSync } from 'node:fs';
import { expect } from 'vitest';
import PDFDocument from '../../lib/document.js';
import { documentToArrayBuffer } from '../../lib/document_util.js';
import { pdf2png } from './pdf2png.js';

export function fixture(path) {
  return new Uint8Array(readFileSync(new URL(`../${path}`, import.meta.url)));
}

const fonts = Object.fromEntries(
  ['Regular', 'Italic', 'Medium', 'MediumItalic'].map((face) => {
    const path = `fonts/Roboto-${face}.ttf`;
    return [`tests/${path}`, fixture(path)];
  }),
);

export async function runDocTest(options, fn) {
  if (typeof options === 'function') {
    fn = options;
    options = {};
  }

  const { failureThreshold = 0.01, ...documentOptions } = options;
  const doc = new PDFDocument({
    font: 'Roboto-Regular',
    fontData: fonts['tests/fonts/Roboto-Regular.ttf'],
    compress: false,
    ...documentOptions,
  });
  // The legacy cases name font fixtures by path; register those names as aliases.
  for (const [name, data] of Object.entries(fonts)) {
    doc.registerFont(name, data);
  }

  await fn(doc);
  const pdf = documentToArrayBuffer(doc);
  doc.end();
  for (const image of await pdf2png(await pdf)) {
    expect(image).toMatchImageSnapshot({
      failureThresholdType: 'percent',
      failureThreshold,
    });
  }
}
