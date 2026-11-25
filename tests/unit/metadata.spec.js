import { beforeEach, describe, expect, test } from 'vitest';
import PDFDocument from '../../lib/document';
import PDFMetadata from '../../lib/metadata';
import { logData } from './helpers';

describe('PDFMetadata', () => {
  let metadata;
  beforeEach(() => {
    metadata = new PDFMetadata();
  });

  test('initialising metadata', () => {
    expect(metadata._metadata).toBeDefined();
    expect(metadata.getLength()).toBeGreaterThan(0);
    expect(typeof metadata._metadata).toBe('string');
  });

  test('contains appended XML', () => {
    let xml = `
        <dc:title>
            <rdf:Alt>
                <rdf:li xml:lang="x-default">Test</rdf:li>
            </rdf:Alt>
        </dc:title>
        `;
    metadata.append(xml);
    expect(metadata.getXML()).toContain(xml);
  });

  test('closing tags', () => {
    let length = metadata.getLength();
    metadata.end();
    expect(metadata.getLength()).toBeGreaterThan(length);
  });
});

describe('document information in XMP', () => {
  test('escapes metadata values, keeps raw XML, and writes the UTF-8 length', () => {
    const value =
      '中文 😀 R&D <draft> "quoted" \'text\' &amp; ]]>\r\n\t\u0000\uD800';
    const escaped =
      '中文 😀 R&amp;D &lt;draft&gt; &quot;quoted&quot; &apos;text&apos; &amp;amp; ]]&gt;&#xD;\n\t';
    const doc = new PDFDocument({
      ...globalThis.DEFAULT_OPTIONS,
      pdfVersion: '1.4',
      subset: 'PDF/A-1',
      info: {
        Creator: 'Editor',
        Producer: `Generator ${value}`,
        Title: value,
        Author: value,
        Subject: value,
        Keywords: value,
      },
    });
    const raw =
      '<rdf:Description rdf:about="" xmlns:test="urn:test"><test:value>A&amp;B</test:value></rdf:Description>';
    doc.appendXML(raw);
    doc.info.Creator += ` ${value}`;
    const data = logData(doc);
    doc.end();

    const {
      id,
      data: { Length },
    } = doc.metadataRef;
    const bytes = data[data.indexOf(`${id} 0 obj`) + 3];
    const xml = new TextDecoder().decode(bytes);
    expect(Length).toBe(bytes.length);
    expect(xml).toContain('<pdfaid:part>1</pdfaid:part>');
    expect(xml).toContain(raw);
    expect(xml).toContain(
      `<xmp:CreatorTool>Editor ${escaped}</xmp:CreatorTool>`,
    );
    expect(xml).toContain(`<pdf:Producer>Generator ${escaped}</pdf:Producer>`);
    expect(xml).toContain(`<pdf:Keywords>${escaped}</pdf:Keywords>`);
    expect(xml).toContain(`<rdf:li>${escaped}</rdf:li>`);
    expect(
      xml.split(`<rdf:li xml:lang="x-default">${escaped}</rdf:li>`),
    ).toHaveLength(3);
    expect(doc.info.Producer).toBe(`Generator ${value}`);
  });
});
