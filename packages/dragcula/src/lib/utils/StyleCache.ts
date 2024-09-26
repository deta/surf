export class StyleCache {
  items = new Map<HTMLElement, Record<string, string[]>>();

  push(node: HTMLElement, prop: string, newVal?: string) {
    if (!this.items.has(node)) this.items.set(node, {});
    const cache = this.items.get(node);
    if (!cache![prop]) cache![prop] = [];
    cache![prop].push(node.style.getPropertyValue(prop));
    if (newVal) node.style.setProperty(prop, newVal);
  }
  pushMany(node: HTMLElement, styles: Record<string, string>) {
    for (const [prop, newVal] of Object.entries(styles)) {
      this.push(node, prop, newVal);
    }
  }
  pop(node: HTMLElement, prop: string) {
    const cache = this.items.get(node);
    if (!cache) return;
    if (cache[prop] && cache[prop].length > 0) {
      const val = cache[prop].pop() as string;
      if (val === "") node.style.removeProperty(prop);
      else node.style.setProperty(prop, val);
    }
    if (cache[prop].length <= 0) {
      delete cache[prop];
    }
    if (Object.entries(cache).length <= 0) {
      this.items.delete(node);
    }
  }
  popAll(node: HTMLElement, omit?: string[]) {
    const cache = this.items.get(node);
    if (!cache) return;
    for (const key in cache) {
      if (omit && omit.includes(key)) continue;
      this.pop(node, key);
    }
    if (Object.entries(cache).length <= 0) {
      this.items.delete(node);
    }
  }
  /// Resets property to the first stored value
  reset(node: HTMLElement, prop: string) {
    const cache = this.items.get(node);
    if (!cache) return;
    if (cache[prop] && cache[prop].length > 0) {
      const val = cache[prop].shift() as string;
      if (val === "") node.style.removeProperty(prop);
      else node.style.setProperty(prop, val);
      delete cache[prop];
    }
    if (Object.entries(cache).length <= 0) {
      this.items.delete(node);
    }
  }
  resetAll(node: HTMLElement, omit?: string[]) {
    const cache = this.items.get(node);
    if (!cache) return;
    for (const key in cache) {
      if (omit && omit.includes(key)) continue;
      this.reset(node, key);
    }
    if (Object.entries(cache).length <= 0) {
      this.items.delete(node);
    }
  }
  // TODO: Rename to reset all (resetAll -> resetNode)
  resetEverything() {
    for (const [node, cache] of this.items.entries()) {
      for (const prop in cache) {
        this.resetAll(node);
      }
    }
  }

  //apply(node: HTMLElement, prop: string) { }
  //applyAll(node: HTMLElement, omit?: string[]) { }
  transfer(node: HTMLElement, newNode: HTMLElement) {}

  dump(label = "") {
    return;
    log.log("Dumping style cache", label, this.items.size);
    for (const [node, cache] of this.items.entries()) {
      log.group(`[StyleCache] ${label} :: Node`, node);
      log.table(cache);
      log.groupEnd();
    }
  }
}
