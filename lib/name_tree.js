/*
PDFNameTree - represents a name tree object
*/

import PDFTree from './tree';

class PDFNameTree extends PDFTree {
  _compareKeys(a, b) {
    // UTF-16BE keys start with a BOM, sorting after every ASCII key.
    const nonAscii = /\P{ASCII}/u;
    return (
      Number(nonAscii.test(a)) - Number(nonAscii.test(b)) ||
      (a < b ? -1 : a > b ? 1 : 0)
    );
  }

  _keysName() {
    return 'Names';
  }

  _dataForKey(k) {
    return new String(k);
  }
}

export default PDFNameTree;
