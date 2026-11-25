import { configureToMatchImageSnapshot } from 'jest-image-snapshot';
import { expect } from 'vitest';

expect.extend({
  toMatchImageSnapshot: configureToMatchImageSnapshot({ runInProcess: true }),
});
