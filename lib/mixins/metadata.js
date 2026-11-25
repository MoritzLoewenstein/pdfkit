import { stringToUint8Array } from 'uint8array-extras';
import PDFMetadata from '../metadata';

function escapeXML(value) {
  return String(value)
    .replace(
      // biome-ignore lint/suspicious/noControlCharactersInRegex: XML 1.0 permits only these characters.
      /[^\u0009\u000A\u000D\u0020-\uD7FF\uE000-\uFFFD\u{10000}-\u{10FFFF}]/gu,
      '',
    )
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;')
    .replaceAll('\r', '&#xD;');
}

export default {
  initMetadata() {
    this.metadata = new PDFMetadata();
  },

  appendXML(xml, newline = true) {
    this.metadata.append(xml, newline);
  },

  _addInfo() {
    this.appendXML(`
        <rdf:Description rdf:about="" xmlns:xmp="http://ns.adobe.com/xap/1.0/">
            <xmp:CreateDate>${this.info.CreationDate.toISOString().split('.')[0] + 'Z'}</xmp:CreateDate>
            <xmp:CreatorTool>${escapeXML(this.info.Creator)}</xmp:CreatorTool>
        </rdf:Description>
        `);

    if (this.info.Title || this.info.Author || this.info.Subject) {
      this.appendXML(`
            <rdf:Description rdf:about="" xmlns:dc="http://purl.org/dc/elements/1.1/">
            `);

      if (this.info.Title) {
        this.appendXML(`
                <dc:title>
                    <rdf:Alt>
                        <rdf:li xml:lang="x-default">${escapeXML(this.info.Title)}</rdf:li>
                    </rdf:Alt>
                </dc:title>
                `);
      }

      if (this.info.Author) {
        this.appendXML(`
                <dc:creator>
                    <rdf:Seq>
                        <rdf:li>${escapeXML(this.info.Author)}</rdf:li>
                    </rdf:Seq>
                </dc:creator>
                `);
      }

      if (this.info.Subject) {
        this.appendXML(`
                <dc:description>
                    <rdf:Alt>
                        <rdf:li xml:lang="x-default">${escapeXML(this.info.Subject)}</rdf:li>
                    </rdf:Alt>
                </dc:description>
                `);
      }

      this.appendXML(`
            </rdf:Description>
            `);
    }

    this.appendXML(
      `
        <rdf:Description rdf:about="" xmlns:pdf="http://ns.adobe.com/pdf/1.3/">
            <pdf:Producer>${escapeXML(this.info.Producer)}</pdf:Producer>`,
      false,
    );

    if (this.info.Keywords) {
      this.appendXML(
        `
            <pdf:Keywords>${escapeXML(this.info.Keywords)}</pdf:Keywords>`,
        false,
      );
    }

    this.appendXML(`
        </rdf:Description>
        `);
  },

  endMetadata() {
    this._addInfo();

    this.metadata.end();

    /*
        Metadata was introduced in PDF 1.4, so adding it to 1.3
        will likely only take up more space.
        */
    if (this.version != 1.3) {
      this.metadataRef = this.ref({
        Type: 'Metadata',
        Subtype: 'XML',
      });
      this.metadataRef.compress = false;
      this.metadataRef.write(stringToUint8Array(this.metadata.getXML()));
      this.metadataRef.end();
      this._root.data.Metadata = this.metadataRef;
    }
  },
};
