import { base64ToUint8Array, isUint8Array } from 'uint8array-extras';
import { md5Hex } from '../crypto/md5';
import { escapeName } from '../object';

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
    const { name = 'attachment', relationship = 'Unspecified' } = options;

    const refBody = {
      Type: 'EmbeddedFile',
      Params: {},
    };
    let data;

    if (!src) {
      throw new Error('No src specified');
    }
    if (isUint8Array(src)) {
      data = src;
    } else if (src instanceof ArrayBuffer) {
      data = new Uint8Array(src);
    } else {
      const match = /^data:(.*?);base64,(.*)$/.exec(src);
      if (match) {
        if (match[1]) {
          refBody.Subtype = escapeName(match[1]);
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
      refBody.Subtype = escapeName(options.type);
    }

    // add checksum and size information
    refBody.Params.CheckSum = new String(md5Hex(data));
    refBody.Params.Size = data.byteLength;

    // save some space when embedding the same file again
    // if a file with the same name and metadata exists, reuse its reference
    let ref;
    this._fileRegistry ??= new Map();
    const file = this._fileRegistry.get(name);
    if (file && isEqual(refBody, file)) {
      ref = file.ref;
    } else {
      ref = this.ref(refBody);
      ref.end(data);

      this._fileRegistry.set(name, { ...refBody, ref });
    }
    // add filespec for embedded file
    const fileSpecBody = {
      Type: 'Filespec',
      AFRelationship: relationship,
      F: new String(name),
      EF: { F: ref },
      UF: new String(name),
    };
    if (options.description) {
      fileSpecBody.Desc = new String(options.description);
    }
    const filespec = this.ref(fileSpecBody);
    filespec.end();

    if (!options.hidden) {
      this.addNamedEmbeddedFile(name, filespec);
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
    a.Params.CreationDate?.getTime() === b.Params.CreationDate?.getTime() &&
    a.Params.ModDate?.getTime() === b.Params.ModDate?.getTime()
  );
}
