import md5omatic from 'md5-o-matic';
import { stringToUint8Array } from 'uint8array-extras';

export default class PDFSecurity {
  static generateFileID(info = {}) {
    let infoStr = `${info.CreationDate.getTime()}\n`;

    for (let key in info) {
      // eslint-disable-next-line no-prototype-builtins
      if (!Object.hasOwn(info, key)) {
        continue;
      }
      infoStr += `${key}: ${info[key].valueOf()}\n`;
    }

    const hash = md5omatic(infoStr);
    return stringToUint8Array(hash);
  }

  static create(document, options = {}) {
    if (!options.ownerPassword && !options.userPassword) {
      return null;
    }
    throw new Error('security.js not implemented');
  }
}
