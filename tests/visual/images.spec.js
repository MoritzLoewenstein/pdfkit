import { fixture, runDocTest } from './helpers.js';

const orientations = [
  'No orientation needed',
  'Flip horizonatal',
  'Rotate 180 degrees',
  'Flip vertically',
  'Flip horizontally and rotate 270 degrees CW',
  'Rotate 90 degrees CW',
  'Flip horizontally and rotate 90 degrees CW',
  'Rotate 270 degrees CW',
].map((label, index) => ({
  label: `${index + 1} - ${label}`,
  data: fixture(`images/orientation-${index + 1}.jpeg`),
}));

const alignmentHeading =
  'Images with EXIF orientation should properly align with fit/cover options:';
const centered = { align: 'center', valign: 'center' };

function drawOrientations(doc, heading, options, boxSize, documentOverride) {
  doc.fill('black').fillColor('black').fontSize(12);
  doc.text(heading, 40, 10, { lineBreak: false });

  for (const [index, { label, data }] of orientations.entries()) {
    const y = 30 + 94.0625 * index;
    const imageY = y + 14.0625;
    doc.text(label, 40, y, { lineBreak: false });
    doc.image(data, 40, imageY, {
      ...options,
      ...(documentOverride ? {} : { ignoreOrientation: true }),
    });
    if (boxSize) doc.rect(40, imageY, boxSize, boxSize).stroke('red');

    doc.text('(output)', 320, y, { lineBreak: false });
    doc.image(data, 320, imageY, {
      ...options,
      ...(documentOverride ? { ignoreOrientation: false } : {}),
    });
    if (boxSize) doc.rect(320, imageY, boxSize, boxSize).stroke('red');
  }
}

describe('images', () => {
  test('orientation', () =>
    runDocTest((doc) =>
      drawOrientations(
        doc,
        'EXIF orientation data may be present on some JPEG images.There are 8 exif orientation values:',
        { height: 80 },
      ),
    ));

  test('orientation - with cover and alignment', () =>
    runDocTest((doc) =>
      drawOrientations(
        doc,
        alignmentHeading,
        { ...centered, cover: [60, 60] },
        60,
      ),
    ));

  test('orientation - with fit and alignment', () =>
    runDocTest((doc) =>
      drawOrientations(
        doc,
        alignmentHeading,
        { ...centered, fit: [80, 80] },
        80,
      ),
    ));

  test('orientation - document option', () =>
    runDocTest({ ignoreOrientation: true }, (doc) =>
      drawOrientations(
        doc,
        'EXIF orientation support can be enabled on the entire PDFDocument:',
        { height: 80 },
        undefined,
        true,
      ),
    ));
});
