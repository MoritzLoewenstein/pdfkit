//import { toMatchImageSnapshot } from 'jest-image-snapshot';

import { readFileSync } from 'node:fs';
import { beforeEach, expect } from 'vitest';
import toContainChunk from './toContainChunk';
import toContainText from './toContainText';

expect.extend(toContainChunk);
expect.extend(toContainText);
//expect.extend({ toMatchImageSnapshot });

beforeEach(() => {
  const fontDataRoboto = readFileSync('tests/fonts/Roboto-Regular.ttf');
  const fontDataRobotoMono = readFileSync('tests/fonts/RobotoMono-Regular.ttf');
  const fontDataHelvetica = readFileSync('tests/fonts/Helvetica.ttf');
  globalThis.DEFAULT_OPTIONS = {
    font: 'Roboto-Regular',
    fontData: new Uint8Array(fontDataRobotoMono.buffer),
    compress: false,
  };
  globalThis.HELVETICA_OPTIONS = {
    font: 'Helvetica',
    fontData: new Uint8Array(fontDataHelvetica.buffer),
    compress: false,
  };
  globalThis.ROBOTO_DATA = new Uint8Array(fontDataRoboto);
  return () => {
    delete globalThis.DEFAULT_OPTIONS;
    delete globalThis.HELVETICA_OPTIONS;
    delete globalThis.ROBOTO_DATA;
  };
});
