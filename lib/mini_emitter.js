class MiniEmitter {
  constructor() {
    this._events = new Map();
  }
  on(event, listener) {
    const list = this._events.get(event) || [];
    list.push(listener);
    this._events.set(event, list);
    return this;
  }
  once(event, listener) {
    const wrap = (...args) => {
      this.removeListener(event, wrap);
      listener.apply(this, args);
    };
    return this.on(event, wrap);
  }
  removeListener(event, listener) {
    const list = this._events.get(event);
    if (!list) return this;
    const i = list.indexOf(listener);
    if (i !== -1) list.splice(i, 1);
    if (list.length === 0) this._events.delete(event);
    else this._events.set(event, list);
    return this;
  }
  off(event, listener) {
    return this.removeListener(event, listener);
  }
  emit(event, ...args) {
    const list = this._events.get(event);
    if (!list) return false;
    for (const l of [...list]) l.apply(this, args);
    return true;
  }
}

export default MiniEmitter;
