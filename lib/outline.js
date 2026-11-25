class PDFOutline {
  constructor(document, parent, title, dest, options = {}) {
    this.document = document;
    this.options = options;
    this.outlineData = {};

    if (dest !== null) {
      const { fit = true, left = 0, top = 0, zoom = 0 } = options;
      this.outlineData.Dest = fit
        ? [dest, 'Fit']
        : [dest, 'XYZ', left, dest.data.MediaBox[3] - top, zoom];
    }

    if (parent !== null) {
      this.outlineData['Parent'] = parent;
    }

    if (title !== null) {
      this.outlineData['Title'] = new String(title);
    }

    this.dictionary = this.document.ref(this.outlineData);
    this.children = [];
  }

  addItem(title, options = {}) {
    const dest =
      options.pageNumber == null
        ? this.document.page?.dictionary
        : this.document._root.data.Pages.data.Kids[options.pageNumber];
    if (!dest) throw new Error('Outline destination page does not exist');

    const result = new PDFOutline(
      this.document,
      this.dictionary,
      title,
      dest,
      options,
    );
    this.children.push(result);

    return result;
  }

  endOutline() {
    if (this.children.length > 0) {
      if (this.options.expanded) {
        this.outlineData.Count = this.children.length;
      }

      const first = this.children[0],
        last = this.children[this.children.length - 1];
      this.outlineData.First = first.dictionary;
      this.outlineData.Last = last.dictionary;

      for (let i = 0, len = this.children.length; i < len; i++) {
        const child = this.children[i];
        if (i > 0) {
          child.outlineData.Prev = this.children[i - 1].dictionary;
        }
        if (i < this.children.length - 1) {
          child.outlineData.Next = this.children[i + 1].dictionary;
        }
        child.endOutline();
      }
    }

    return this.dictionary.end();
  }
}

export default PDFOutline;
