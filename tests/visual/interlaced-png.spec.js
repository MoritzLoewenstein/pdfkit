import { fixture, runDocTest } from './helpers.js';

// These images occupy a small fraction of the page; use a tighter page tolerance.
const snapshotOptions = { failureThreshold: 0.001 };

describe('interlaced PNG (Adam7)', () => {
  test.each([
    ['grayscale', 'interlaced-grayscale-8bit.png', 'Grayscale', 100],
    ['RGB', 'interlaced-rgb-8bit.png', 'RGB', 100],
    ['RGB 16bit', 'interlaced-rgb-16bit.png', 'RGB 16-bit', 100],
    ['palette', 'interlaced-pallete-8bit.png', 'Palette', 100],
    ['RGBA', 'interlaced-rgb-alpha-8bit.png', 'RGBA', 100],
  ])('interlaced %s renders correctly', (_kind, path, caption, width) =>
    runDocTest(snapshotOptions, (doc) => {
      doc.text(`Interlaced ${caption} PNG (Adam7)`, 50, 30);
      doc.image(fixture(`images/${path}`), 50, 50, { width });
    }),
  );

  test('issue #414 - interlaced palette PNG renders correctly', () =>
    runDocTest(snapshotOptions, (doc) => {
      doc.text('Issue #414: Interlaced Palette PNG', 50, 30);
      doc.image(fixture('images/issue-414-interlaced.png'), 50, 50, {
        width: 300,
      });
    }));
});
