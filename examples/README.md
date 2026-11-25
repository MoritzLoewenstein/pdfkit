# Running the PDFKit examples

Install dependencies and run `npm run build` from the repository root before
running the Node examples. They import the built package by name. For example,
`node examples/png.js` writes `png.pdf` to your current directory. The other
scripts in this directory work the same way; run them from a scratch directory
to keep the checked-in PDFs untouched. `tiger.js` is an SVG path fixture, not a
standalone generator.

Run `npm run dev` and open the root page for the editable playground, or choose
**Fixed preview** for the non-editable browser example. Edit the first call to
`text()` and wait for the preview to update, then reload to check that your changes
are restored. A JavaScript error is shown below the editor without discarding the
last successful PDF.

Run `npm run playground:build` to build both pages into `dist-playground/`, or
`npm run playground:preview` to serve that static build locally.

Playground code runs in your browser on the page's origin. Only run code you
trust. `PDFDocument`, `toBlob`, `fontData` (Roboto Mono Regular),
`fontItalicData` (Roboto Mono Italic), and `lorem` are available in the editor.
Supply the font bytes when creating a document; call `doc.end()` and return
the Blob from `toBlob(doc)` to preview it.
