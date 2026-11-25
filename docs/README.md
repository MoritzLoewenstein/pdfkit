# PDFKit Guide

The website and PDF guide are generated from the Markdown files in this
directory. From the repository root, use Node.js 22.13 or later and run:

```sh
npm ci
npm run docs
npm run dev
```

Open the root page on the Vite dev server to go to `/docs/index.html`.
`npm run pdf-guide` writes `public/docs/guide.pdf` and `npm run website` builds
the HTML, styles and preview images in `public/docs/`. Neither command needs a
prior library build or ImageMagick. Keep these generated files out of commits.

The generators use Markdown-it for Markdown, Lezer for JavaScript highlighting,
and PDF.js and Sharp to render and crop previews of the first page of each
example PDF. The preview images are not interactive. The examples run against
the fork's own Vite-loaded source and use in-memory font and image bytes.
Only generate docs from source you trust: the example runner is not a sandbox
for untrusted code.

## Authoring

- Put `![0]()` in its own paragraph to show the first code block's output.
  Numbering starts at zero in each file and counts both fenced and indented code
  blocks. The referenced code must be JavaScript. In `![0](preview.png "120")`,
  the numeric title caps the PDF preview height at 120 points; the generator
  does not use the image path for numbered examples. Use descriptive alt text
  for a static image (for example, a screenshot of an interactive form).
- Runnable snippets receive an open `doc` with an embedded default font, the
  sample `lorem` text, `imageBytes` from `images/test.jpeg`, and an async
  `readAsset(path)` helper for files relative to this directory. The generator
  calls `doc.end()` after the snippet completes.
- Chapter headings (`#`) start new PDF pages. Section headings (`##`) start a
  new PDF page unless they follow a heading or explicit page break. A
  horizontal rule (`* * *` or `---`) inserts a PDF page break.

## GitHub Pages

The [Pages workflow](../.github/workflows/pages.yml) builds and deploys the site
from `main`. The homepage redirects to `/docs/index.html`, and the docs sidebar
links to `/playground/`. To build the same static site locally, run `npm run docs`
before `npm run playground:build`; the output is in `dist-playground/`.

To set up the public site, select **GitHub Actions** as the source in
**Settings → Pages**. Set the custom domain to `pdfkit.moritzloewenstein.com`
and add a DNS CNAME for `pdfkit` pointing to `moritzloewenstein.github.io`.
Enable **Enforce HTTPS** once GitHub provisions the certificate.
