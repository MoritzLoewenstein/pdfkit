export const example = `// The playground provides the two Roboto Mono fonts as bytes.
const doc = new PDFDocument({ font: 'RobotoMono', fontData });
doc.registerFont('RobotoMonoItalic', fontItalicData);
const output = toBlob(doc);

doc.fontSize(25).text('Here is some vector graphics...', 70, 80);

doc.moveTo(100, 150).lineTo(100, 250).lineTo(200, 250).fill('#FF3300');
doc.circle(280, 200, 50).fill('#6600FF');

// Draw an SVG path with the even-odd winding rule.
doc.save()
  .scale(0.6)
  .translate(470, 130)
  .path('M 250,75 L 323,301 131,161 369,161 177,301 z')
  .fill('red', 'even-odd')
  .restore();

// Fill with a gradient and an uncolored tiling pattern.
const gradient = doc.linearGradient(100, 300, 200, 300)
  .stop(0, 'green')
  .stop(0.5, 'red')
  .stop(1, 'green');
doc.rect(100, 300, 100, 100).fill(gradient);

const stripes = doc.pattern([1, 1, 4, 4], 3, 3, '1 w 0 1 m 4 5 l s 2 0 m 5 3 l s');
doc.circle(280, 350, 50).fill([stripes, 'blue']);
doc.rect(380, 300, 100, 100)
  .fillColor('lime')
  .strokeColor([stripes, 'orange'])
  .lineWidth(5)
  .fillAndStroke();

doc.fillColor('black')
  .text('And here is some wrapped text...', 70, 450)
  .font('RobotoMonoItalic', 10)
  .moveDown()
  .text(lorem, { width: 412, columns: 2, height: 230, ellipsis: true });

doc.end();
return await output;`;
