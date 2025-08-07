import CryptoJS from 'crypto-js';
import { base64ToUint8Array } from 'uint8array-extras';

export default {
  /**
   * Embed contents of `src` in PDF
   * @param {Uint8Array | ArrayBuffer | string} src input Uint8Array, ArrayBuffer, base64 encoded string
   * @param {object} options
   *  * options.name: filename to be shown in PDF, will use `src` if none set
   *  * options.type: filetype to be shown in PDF
   *  * options.description: description to be shown in PDF
   *  * options.hidden: if true, do not add attachment to EmbeddedFiles dictionary. Useful for file attachment annotations
   *  * options.creationDate: override creation date
   *  * options.modifiedDate: override modified date
   *  * options.relationship: Relationship between the PDF document and its attached file. Can be 'Alternative', 'Data', 'Source', 'Supplement' or 'Unspecified'.
   * @returns filespec reference
   */
  file(src, options = {}) {
    options.name = options.name || src;
    options.relationship = options.relationship || 'Unspecified';

    const refBody = {
      Type: 'EmbeddedFile',
      Params: {},
    };
    let data;

    if (!src) {
      throw new Error('No src specified');
    }
    if (src instanceof Uint8Array) {
      data = src;
    } else if (src instanceof ArrayBuffer) {
      data = new Uint8Array(src);
    } else {
      const match = /^data:(.*?);base64,(.*)$/.exec(src);
      if (match) {
        if (match[1]) {
          refBody.Subtype = match[1].replace('/', '#2F');
        }
        data = base64ToUint8Array(match[2]);
      } else {
        throw new Error(
          'invalid src, must be Uint8Array, ArrayBuffer or base64 encoded string',
        );
      }
    }

    // override creation date and modified date
    if (options.creationDate instanceof Date) {
      refBody.Params.CreationDate = options.creationDate;
    }
    if (options.modifiedDate instanceof Date) {
      refBody.Params.ModDate = options.modifiedDate;
    }
    // add optional subtype
    if (options.type) {
      refBody.Subtype = options.type.replace('/', '#2F');
    }

    // add checksum and size information
    const checksum = CryptoJS.MD5(
      CryptoJS.lib.WordArray.create(data),
    );
    refBody.Params.CheckSum = new String(checksum);
    refBody.Params.Size = data.byteLength;

    // save some space when embedding the same file again
    // if a file with the same name and metadata exists, reuse its reference
    let ref;
    if (!this._fileRegistry) this._fileRegistry = {};
    let file = this._fileRegistry[options.name];
    if (file && isEqual(refBody, file)) {
      ref = file.ref;
    } else {
      ref = this.ref(refBody);
      ref.end(data);

      this._fileRegistry[options.name] = { ...refBody, ref };
    }
    // add filespec for embedded file
    const fileSpecBody = {
      Type: 'Filespec',
      AFRelationship: options.relationship,
      F: new String(options.name),
      EF: { F: ref },
      UF: new String(options.name),
    };
    if (options.description) {
      fileSpecBody.Desc = new String(options.description);
    }
    const filespec = this.ref(fileSpecBody);
    filespec.end();

    if (!options.hidden) {
      this.addNamedEmbeddedFile(options.name, filespec);
    }

    // Add file to the catalogue to be PDF/A3 compliant
    if (this._root.data.AF) {
      this._root.data.AF.push(filespec);
    } else {
      this._root.data.AF = [filespec];
    }

    return filespec;
  },
};

/** check two embedded file metadata objects for equality */
function isEqual(a, b) {
  return (
    a.Subtype === b.Subtype &&
    a.Params.CheckSum.toString() === b.Params.CheckSum.toString() &&
    a.Params.Size === b.Params.Size &&
    a.Params.CreationDate.getTime() === b.Params.CreationDate.getTime() &&
    ((a.Params.ModDate === undefined && b.Params.ModDate === undefined) ||
      a.Params.ModDate.getTime() === b.Params.ModDate.getTime())
  );
}
