## Note

This is a personal wip fork of the [pdfkit project](https://github.com/foliojs/pdfkit). Dont expect a working library (yet).

# PDFKit

A JavaScript PDF generation library for Node and the browser.

## Description

PDFKit is a PDF document generation library for Node and the browser that makes creating complex, multi-page, printable
documents easy. The API embraces chainability, and includes both low level functions as well as abstractions for higher
level functionality. The PDFKit API is designed to be simple, so generating complex documents is often as simple as
a few function calls.

Check out some of the [documentation and examples](http://pdfkit.org/docs/getting_started.html) to see for yourself!
You can also read the guide as a [self-generated PDF](http://pdfkit.org/docs/guide.pdf) with example output displayed inline.
If you'd like to see how it was generated, check out the README in the [docs](https://github.com/foliojs/pdfkit/tree/master/docs)
folder.

You can also try out an interactive in-browser demo of PDFKit [here](http://pdfkit.org/demo/browser.html).

## Installation

Installation uses the [npm](http://npmjs.org/) package manager. Just type the following command after installing npm.

    npm install @moritzloewenstein/pdfkit

This fork is ESM-only. Use `import`; CommonJS `require()` is not supported.

## Features

- Vector graphics
  - HTML5 canvas-like API
  - Path operations
  - SVG path parser for easy path creation
  - Transformations
  - Linear and radial gradients
- Text
  - Line wrapping (with soft hyphen recognition)
  - Text alignments
  - Bulleted lists
- Font embedding
  - Supports TrueType (.ttf), OpenType (.otf), WOFF, WOFF2, TrueType Collections (.ttc), and Datafork TrueType (.dfont) fonts
  - Font subsetting
  - See [fontkit](http://github.com/foliojs/fontkit) for more details on advanced glyph layout support.
- Image embedding
  - Supports JPEG and PNG files (including indexed PNGs, and PNGs with transparency)
- Annotations
  - Links
  - Notes
  - Highlights
  - Underlines
  - etc.
- AcroForms
- Outlines
- PDF security
  - Encryption
  - Access privileges (printing, copying, modifying, annotating, form filling, content accessibility, document assembly)
- Accessibility support (marked content, logical structure, Tagged PDF, PDF/UA)

## Coming soon!

- Patterns fills
- Higher level APIs for creating tables and laying out content
- More performance optimizations
- Even more awesomeness, perhaps written by you! Please fork this repository and send me pull requests.

## Example

```javascript
import { readFile, writeFile } from 'node:fs/promises';
import PDFDocument, { toBytes } from '@moritzloewenstein/pdfkit';

const fontData = await readFile('fonts/Roboto-Regular.ttf');
const doc = new PDFDocument({ font: 'Roboto', fontData });
doc.fontSize(25).text('Some text with an embedded font!');
doc.image(await readFile('images/example.png'), { fit: [250, 300] });
doc.addPage().circle(150, 150, 40).fill('#FF3300');
doc.end();
await writeFile('output.pdf', await toBytes(doc));
```

For more, see the [examples](examples/README.md) and the [Getting Started guide](docs/getting_started.md).

## Browser Usage

Import the package with your browser bundler, fetch font bytes with `fetch`, and
use `toBlob(doc)` after `doc.end()`. No Node.js polyfills or `blob-stream` are needed.
Run `npm run dev` in this repository to try the editable playground.

## Documentation

For complete API documentation and more examples, see the [PDFKit website](http://pdfkit.org/).

## License

PDFKit is available under the MIT license.
