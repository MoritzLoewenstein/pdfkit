import { base64ToUint8Array } from 'uint8array-extras';
import iccProfileUrl from './data/sRGB_IEC61966_2_1.icc?url&inline';

let iccProfile;

export default {
  initPDFA(pSubset) {
    if (pSubset.charAt(pSubset.length - 3) === '-') {
      this.subset_conformance = pSubset
        .charAt(pSubset.length - 1)
        .toUpperCase();
      this.subset = parseInt(pSubset.charAt(pSubset.length - 2));
    } else {
      // Default to Basic conformance when user doesn't specify
      this.subset_conformance = 'B';
      this.subset = parseInt(pSubset.charAt(pSubset.length - 1));
    }
  },

  endSubset() {
    this._addPdfaMetadata();
    this._addColorOutputIntent();
  },

  _addColorOutputIntent() {
    // Decode the inlined binary asset on first use, without filesystem I/O.
    iccProfile ??= base64ToUint8Array(iccProfileUrl.split(',')[1]);
    const colorProfileRef = this.ref({ N: 3 });
    colorProfileRef.write(iccProfile);
    colorProfileRef.end();

    const intentRef = this.ref({
      Type: 'OutputIntent',
      S: 'GTS_PDFA1',
      Info: new String('sRGB IEC61966-2.1'),
      OutputConditionIdentifier: new String('sRGB IEC61966-2.1'),
      DestOutputProfile: colorProfileRef,
    });
    intentRef.end();

    this._root.data.OutputIntents = [intentRef];
  },

  _getPdfaid() {
    return `
        <rdf:Description xmlns:pdfaid="http://www.aiim.org/pdfa/ns/id/" rdf:about="">
            <pdfaid:part>${this.subset}</pdfaid:part>
            <pdfaid:conformance>${this.subset_conformance}</pdfaid:conformance>
        </rdf:Description>
        `;
  },

  _addPdfaMetadata() {
    this.appendXML(this._getPdfaid());
  },
};
