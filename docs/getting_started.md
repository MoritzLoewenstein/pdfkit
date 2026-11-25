# Getting Started with PDFKit

### Installation

Installation uses the [npm](http://npmjs.org/) package manager. Just type the
following command after installing npm.

    npm install @moritzloewenstein/pdfkit

### Creating a document

Create a `PDFDocument` with in-memory data for its default font. In Node.js,
your application can read the font before constructing the document:

    import { createWriteStream, readFileSync } from 'node:fs';
    import PDFDocument from '@moritzloewenstein/pdfkit';

    const fontData = readFileSync('fonts/Roboto-Regular.ttf');
    const doc = new PDFDocument({ font: 'Body', fontData });

`doc.stream` is a Web `ReadableStream`. In Node.js, you can also use `pipe`
to write to a file stream or an HTTP response. Call `end()` to finalize the PDF.

    doc.pipe(createWriteStream('/path/to/file.pdf'));    // write to PDF
    doc.pipe(res);                                       // HTTP response

    // add stuff to PDF here using methods described below...

    // finalize the PDF and end the stream
    doc.end();

The `write` and `output` methods found in PDFKit before version 0.5 are now deprecated.

## Using PDFKit in the browser

Load the font as bytes, then use `toBlob(doc)` to collect the PDF for a preview
or download. Use `toBytes(doc)` instead to get a `Uint8Array`.

    import PDFDocument, { toBlob } from '@moritzloewenstein/pdfkit';

    const fontData = await (await fetch('/fonts/Roboto-Regular.ttf')).arrayBuffer();
    const doc = new PDFDocument({ font: 'Roboto', fontData });
    doc.text('Hello, PDF!');
    doc.end();
    iframe.src = URL.createObjectURL(await toBlob(doc));

The helpers consume `doc.stream`; don't also pipe or read from the same stream.
Revoke the object URL once you no longer need it.

This fork does not bundle built-in fonts. Provide the default font name and
its data as `font` and `fontData`; see [Fonts](text.md#fonts).

## Document options

New documents default to PDF 1.7. PDF/A-1 documents default to PDF 1.4.
Set `pdfVersion` explicitly if the recipient requires an older version.

Set `pageLayout` to control how a PDF viewer displays pages: `singlePage`,
`oneColumn`, `twoColumnLeft`, `twoColumnRight`, `twoPageLeft`, or `twoPageRight`.
In the two-column and two-page layouts, `Left` and `Right` indicate which side
contains odd-numbered pages.

Set `objectStreams: true` to pack non-stream objects into object streams and
replace the cross-reference table with a cross-reference stream. This can make
documents with many objects smaller. It requires `pdfVersion: '1.5'` or later
and cannot be combined with encryption or PDF/A-1.

## Adding pages

The first page of a PDFKit document is added for you automatically when you
create the document unless you provide `autoFirstPage: false`. Subsequent pages must be added by you. Luckily, it is
quite simple!

    doc.addPage()

Pass `onPageAdded: doc => doc.text('Page Title')` in the constructor options
to draw on every new page, including the automatic first page. To handle pages
added after construction only, you can also use the `pageAdded` event.

    doc.on('pageAdded', () => doc.text("Page Title"));

You can also set some options for the page, such as its size and orientation.

The `layout` property can be either `portrait` (the default) or `landscape`.
The `size` property can be either an array specifying `[width, height]` in PDF
points (72 per inch), or a string specifying a predefined size. A
list of the predefined paper sizes can be seen [here](http://pdfkit.org/docs/paper_sizes.html). The
default is `letter`.

Passing a page options object to the `PDFDocument` constructor will
set the default paper size and layout for every page in the document, which is
then overridden by individual options passed to the `addPage` method.

You can set the page margins in two ways. The first is by setting the `margin` / `margins`
property to a single value, which applies that to all edges. The
other way is to provide an object with `top`, `right`, `bottom`, and `left` values.
By default, using a number this will be in points (the default PDF unit),
however you can provide any of the following units inside a string
and this will be converted for you:
`em`, `in`, `px`, `cm`, `mm`, `pc`, `ex`, `ch`, `rem`, `vw`, `vmin`, `vmax`, `%`, `pt`.
For those which are based on text sizes this will take the size of the font for the page 
(excluding `rem` which is always the document root font size)
The default is a 1 inch (72 point) margin
on all sides.

For example:

    // Add a 50 point margin on all sides
    doc.addPage({ margin: 50 });

    // Add a 2 inch margin on all sides
    doc.addPage({ margin: '2in' });

    // Add a 2em(28pt) margin using the font size
    doc.addPage({ fontSize: 14, margin: '2em' });

    // Add different margins on each side
    doc.addPage({
      margins: {
        top: 50,
        bottom: 50,
        left: 72,
        right: 72
      }
    });

## Switching to previous pages

PDFKit normally flushes pages to the output file immediately when a new page is created, making
it impossible to jump back and add content to previous pages. This is normally not an issue, but
in some circumstances it can be useful to add content to pages after the whole document, or a part
of the document, has been created already. Examples include adding page numbers, or filling in other
parts of information you don't have until the rest of the document has been created.

PDFKit has a `bufferPages` option in versions v0.7.0 and later that allows you to control when
pages are flushed to the output file yourself rather than letting PDFKit handle that for you. To use
it, just pass `bufferPages: true` as an option to the `PDFDocument` constructor. Then, you can call
`doc.switchToPage(pageNumber)` to switch to a previous page (page numbers start at 0).

When you're ready to flush the buffered pages to the output file, call `flushPages`.
This method is automatically called by `doc.end()`, so if you just want to buffer all pages in the document, you
never need to call it. Finally, there is a `bufferedPageRange` method, which returns the range
of pages that are currently buffered. Here is a small example that shows how you might add page
numbers to a document.

    // create a document, and enable bufferPages mode
    let i;
    let end;
    const doc = new PDFDocument({
      font: 'Body', fontData,
      bufferPages: true});

    // add some content...
    doc.addPage();
    // ...
    doc.addPage();

    // see the range of buffered pages
    const range = doc.bufferedPageRange(); // => { start: 0, count: 2 }

    for (i = range.start, end = range.start + range.count, range.start <= end; i < end; i++) {
      doc.switchToPage(i);
      doc.text(`Page ${i + 1} of ${range.count}`);
    }

    // manually flush pages that have been buffered
    doc.flushPages();

    // or, if you are at the end of the document anyway,
    // doc.end() will call it for you automatically.
    doc.end();

## Page labels

Call `addPageLabel(pageIndex, options)` with the zero-based index where a range
starts. Labels change what PDF viewers show, not what is drawn on the page.

    doc.addPageLabel(0, { style: 'lowerRoman' }); // i, ii
    doc.addPageLabel(2, { style: 'decimal' });    // 1, 2, …
    doc.addPageLabel(10, { style: 'decimal', prefix: 'A-', start: 3 }); // A-3, A-4, …

`style` can be `decimal`, `upperRoman`, `lowerRoman`, `upperAlpha`, or
`lowerAlpha`. Without a style, only `prefix` is shown. `start` defaults to 1.

## Setting default font

Pass a name as `font` and its bytes or a parsed fontkit font as `fontData`.
The name becomes a registered alias within the document. See [Fonts](text.md#fonts)
for supported formats and how to select additional fonts.

## Setting document metadata

PDF documents can have various metadata associated with them, such as the
title, or author of the document. You can add that information by adding it to
the `doc.info` object, or by passing an info object into the document at
creation time.

Here is a list of all of the properties you can add to the document metadata.
According to the PDF spec, each property must have its first letter
capitalized.

- `Title` - the title of the document
- `Author` - the name of the author
- `Subject` - the subject of the document
- `Keywords` - keywords associated with the document
- `Creator` - the tool that created the source document
- `Producer` - the tool that generated the PDF
- `CreationDate` - the date the document was created (added automatically by PDFKit)
- `ModDate` - the date the document was last modified

## Encryption and Access Privileges

To encrypt a PDF or set access permissions, explicitly set `pdfVersion: '1.7ext3'`
(PDF 1.7 Extension Level 3, AES-256 revision 5). Supplying a non-empty user or
owner password with any other version, including the default PDF 1.7, throws an
error. Older versions remain available for unencrypted output. PDF/A does not
allow encryption.

To enable encryption, provide a user password when creating the `PDFDocument` in `options` object.
The PDF file will be encrypted when a user password is provided, and users will be prompted to enter
the password to decrypt the file when opening it.

- `userPassword` - the user password (string value)

To set access privileges for the PDF file, you need to provide an owner password and permission
settings in the `option` object when creating `PDFDocument`. By default, all operations are disallowed.
You need to explicitly allow certain operations.

- `ownerPassword` - the owner password (string value)
- `permissions` - the object specifying PDF file permissions

Following settings are allowed in `permissions` object:

- `printing` - whether printing is allowed. Specify `"lowResolution"` to allow degraded printing, or `"highResolution"` to allow printing with high resolution
- `modifying` - whether modifying the file is allowed. Specify `true` to allow modifying document content
- `copying` - whether copying text or graphics is allowed. Specify `true` to allow copying
- `annotating` - whether annotating, form filling is allowed. Specify `true` to allow annotating and form filling
- `fillingForms` - whether form filling and signing is allowed. Specify `true` to allow filling in form fields and signing
- `contentAccessibility` - whether copying text for accessibility is allowed. Specify `true` to allow copying for accessibility
- `documentAssembly` - whether assembling document is allowed. Specify `true` to allow document assembly

You can specify either user password, owner password or both passwords.
Behavior differs according to passwords you provides:

- When only user password is provided,
  users with user password are able to decrypt the file and have full access to the document.
- When only owner password is provided,
  users are able to decrypt and open the document without providing any password,
  but the access is limited to those operations explicitly permitted.
  Users with owner password have full access to the document.
- When both passwords are provided,
  users with user password are able to decrypt the file
  but only have limited access to the file according to permission settings.
  Users with owner password have full access to the document.

Note that PDF file itself cannot enforce access privileges.
When file is decrypted, PDF viewer applications have full access to the file content,
and it is up to viewer applications to respect permission settings.

Passwords are truncated to 127 bytes of their UTF-8 representation.

## PDF/A

PDF/A is a standard (ISO 19005-1:2005) which defines rules for electornic documents intended for long-term archiving.
The restrictions on PDF/A documents are:

- Cannot be encrypted
- Fonts must be embedded
- No JavaScript
- No audio content
- No video content
- Addition of XMP metadata
- Must define color spaces

Currently, PDFKit aims to support PDF/A-1b, PDF/A-2b, PDF/A-3b and PDF/A-1a, PDF/A-2a, PDF/A-3a standards, also known as level B conformance and level A conformance, respectively.

In order to create PDF/A documents, set `subset` to either `PDF/A-1` or `PDF/A-1b` for level B (basic) conformance, or `PDF/A-1a` for level A (accessible) conformance when creating the `PDFDocument` in `options` object.

Similary, use `PDF/A-2` or `PDF/A-2b` for PDF/A-2 level B conformance and `PDF/A-2a` for PDF/A-2 level A conformance. `PDF/A-3` or `PDF/A-3b` can be used for PDF/A-3 level B conformance and `PDF/A-3a` for PDF/A-3 level A conformance.

PDF/A-1 defaults to PDF 1.4. PDF/A-2 and PDF/A-3 use the ordinary PDF 1.7
default. Set `tagged: true` for level A conformance.

In order to verify the generated document for PDF/A and its subsets conformance, veraPDF is an excellent open source validator.

PDF/A requires embedded fonts. Supply embeddable font data (for example, a
TrueType font) as `fontData` for the document's default font, and pass any
additional font sources to `font()` or `registerFont()`.

### Adding content

Once you've created a `PDFDocument` instance, you can add content to the
document. Check out the other sections described in this document to
learn about each type of content you can add.

That's the basics! Now let's move on to PDFKit's powerful vector graphics
abilities.
