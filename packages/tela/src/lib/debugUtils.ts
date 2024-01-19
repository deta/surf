// http-url:https://unpkg.com/@sveu/shared@1.0.1/chunk-G47UHES5.js
function toNumber(value, options = {}) {
  const { method, radix, nanToZero } = options;
  let _method = "parseFloat";
  if (method === "int") _method = "parseInt";
  let resolved = typeof value === "number" ? value : Number[_method](value, radix);
  if (nanToZero && isNaN(resolved)) resolved = 0;
  return resolved;
}

// http-url:https://unpkg.com/svelte@4.2.2/src/runtime/internal/utils.js
function noop() {}
function safe_not_equal(a, b) {
  return a != a ? b == b : a !== b || (a && typeof a === "object") || typeof a === "function";
}
function subscribe(store, ...callbacks) {
  if (store == null) {
    for (const callback of callbacks) {
      callback(void 0);
    }
    return noop;
  }
  const unsub = store.subscribe(...callbacks);
  return unsub.unsubscribe ? () => unsub.unsubscribe() : unsub;
}
function get_store_value(store) {
  let value;
  subscribe(store, (_) => (value = _))();
  return value;
}

// http-url:https://unpkg.com/svelte@4.2.2/src/runtime/internal/globals.js
var globals =
  typeof window !== "undefined"
    ? window
    : typeof globalThis !== "undefined"
    ? globalThis
    : // @ts-ignore Node typings have this
      global;

// http-url:https://unpkg.com/svelte@4.2.2/src/runtime/internal/ResizeObserverSingleton.js
var ResizeObserverSingleton = class _ResizeObserverSingleton {
  /**
   * @private
   * @readonly
   * @type {WeakMap<Element, import('./private.js').Listener>}
   */
  _listeners = "WeakMap" in globals ? /* @__PURE__ */ new WeakMap() : void 0;
  /**
   * @private
   * @type {ResizeObserver}
   */
  _observer = void 0;
  /** @type {ResizeObserverOptions} */
  options;
  /** @param {ResizeObserverOptions} options */
  constructor(options) {
    this.options = options;
  }
  /**
   * @param {Element} element
   * @param {import('./private.js').Listener} listener
   * @returns {() => void}
   */
  observe(element2, listener) {
    this._listeners.set(element2, listener);
    this._getObserver().observe(element2, this.options);
    return () => {
      this._listeners.delete(element2);
      this._observer.unobserve(element2);
    };
  }
  /**
   * @private
   */
  _getObserver() {
    return (
      this._observer ??
      (this._observer = new ResizeObserver((entries) => {
        for (const entry of entries) {
          _ResizeObserverSingleton.entries.set(entry.target, entry);
          this._listeners.get(entry.target)?.(entry);
        }
      }))
    );
  }
};
ResizeObserverSingleton.entries = "WeakMap" in globals ? /* @__PURE__ */ new WeakMap() : void 0;

// http-url:https://unpkg.com/svelte@4.2.2/src/runtime/internal/dom.js
function insert(target, node, anchor) {
  target.insertBefore(node, anchor || null);
}
function detach(node) {
  if (node.parentNode) {
    node.parentNode.removeChild(node);
  }
}
function element(name) {
  return document.createElement(name);
}
function attr(node, attribute, value) {
  if (value == null) node.removeAttribute(attribute);
  else if (node.getAttribute(attribute) !== value) node.setAttribute(attribute, value);
}
function get_custom_elements_slots(element2) {
  const result2 = {};
  element2.childNodes.forEach(
    /** @param {Element} node */
    (node) => {
      result2[node.slot || "default"] = true;
    }
  );
  return result2;
}

// http-url:https://unpkg.com/svelte@4.2.2/src/runtime/internal/lifecycle.js
var current_component;
function get_current_component() {
  if (!current_component) throw new Error("Function called outside component initialization");
  return current_component;
}
function onDestroy(fn) {
  get_current_component().$$.on_destroy.push(fn);
}

// http-url:https://unpkg.com/svelte@4.2.2/src/shared/boolean_attributes.js
var _boolean_attributes =
  /** @type {const} */
  [
    "allowfullscreen",
    "allowpaymentrequest",
    "async",
    "autofocus",
    "autoplay",
    "checked",
    "controls",
    "default",
    "defer",
    "disabled",
    "formnovalidate",
    "hidden",
    "inert",
    "ismap",
    "loop",
    "multiple",
    "muted",
    "nomodule",
    "novalidate",
    "open",
    "playsinline",
    "readonly",
    "required",
    "reversed",
    "selected"
  ];
var boolean_attributes = /* @__PURE__ */ new Set([..._boolean_attributes]);

// http-url:https://unpkg.com/svelte@4.2.2/src/runtime/internal/Component.js
var SvelteElement;
if (typeof HTMLElement === "function") {
  SvelteElement = class extends HTMLElement {
    /** The Svelte component constructor */
    $$ctor;
    /** Slots */
    $$s;
    /** The Svelte component instance */
    $$c;
    /** Whether or not the custom element is connected */
    $$cn = false;
    /** Component props data */
    $$d = {};
    /** `true` if currently in the process of reflecting component props back to attributes */
    $$r = false;
    /** @type {Record<string, CustomElementPropDefinition>} Props definition (name, reflected, type etc) */
    $$p_d = {};
    /** @type {Record<string, Function[]>} Event listeners */
    $$l = {};
    /** @type {Map<Function, Function>} Event listener unsubscribe functions */
    $$l_u = /* @__PURE__ */ new Map();
    constructor($$componentCtor, $$slots, use_shadow_dom) {
      super();
      this.$$ctor = $$componentCtor;
      this.$$s = $$slots;
      if (use_shadow_dom) {
        this.attachShadow({ mode: "open" });
      }
    }
    addEventListener(type2, listener, options) {
      this.$$l[type2] = this.$$l[type2] || [];
      this.$$l[type2].push(listener);
      if (this.$$c) {
        const unsub = this.$$c.$on(type2, listener);
        this.$$l_u.set(listener, unsub);
      }
      super.addEventListener(type2, listener, options);
    }
    removeEventListener(type2, listener, options) {
      super.removeEventListener(type2, listener, options);
      if (this.$$c) {
        const unsub = this.$$l_u.get(listener);
        if (unsub) {
          unsub();
          this.$$l_u.delete(listener);
        }
      }
    }
    async connectedCallback() {
      this.$$cn = true;
      if (!this.$$c) {
        let create_slot = function (name) {
          return () => {
            let node;
            const obj = {
              c: function create() {
                node = element("slot");
                if (name !== "default") {
                  attr(node, "name", name);
                }
              },
              /**
               * @param {HTMLElement} target
               * @param {HTMLElement} [anchor]
               */
              m: function mount(target, anchor) {
                insert(target, node, anchor);
              },
              d: function destroy(detaching) {
                if (detaching) {
                  detach(node);
                }
              }
            };
            return obj;
          };
        };
        await Promise.resolve();
        if (!this.$$cn) {
          return;
        }
        const $$slots = {};
        const existing_slots = get_custom_elements_slots(this);
        for (const name of this.$$s) {
          if (name in existing_slots) {
            $$slots[name] = [create_slot(name)];
          }
        }
        for (const attribute of this.attributes) {
          const name = this.$$g_p(attribute.name);
          if (!(name in this.$$d)) {
            this.$$d[name] = get_custom_element_value(name, attribute.value, this.$$p_d, "toProp");
          }
        }
        this.$$c = new this.$$ctor({
          target: this.shadowRoot || this,
          props: {
            ...this.$$d,
            $$slots,
            $$scope: {
              ctx: []
            }
          }
        });
        const reflect_attributes = () => {
          this.$$r = true;
          for (const key in this.$$p_d) {
            this.$$d[key] = this.$$c.$$.ctx[this.$$c.$$.props[key]];
            if (this.$$p_d[key].reflect) {
              const attribute_value = get_custom_element_value(
                key,
                this.$$d[key],
                this.$$p_d,
                "toAttribute"
              );
              if (attribute_value == null) {
                this.removeAttribute(this.$$p_d[key].attribute || key);
              } else {
                this.setAttribute(this.$$p_d[key].attribute || key, attribute_value);
              }
            }
          }
          this.$$r = false;
        };
        this.$$c.$$.after_update.push(reflect_attributes);
        reflect_attributes();
        for (const type2 in this.$$l) {
          for (const listener of this.$$l[type2]) {
            const unsub = this.$$c.$on(type2, listener);
            this.$$l_u.set(listener, unsub);
          }
        }
        this.$$l = {};
      }
    }
    // We don't need this when working within Svelte code, but for compatibility of people using this outside of Svelte
    // and setting attributes through setAttribute etc, this is helpful
    attributeChangedCallback(attr2, _oldValue, newValue) {
      if (this.$$r) return;
      attr2 = this.$$g_p(attr2);
      this.$$d[attr2] = get_custom_element_value(attr2, newValue, this.$$p_d, "toProp");
      this.$$c?.$set({ [attr2]: this.$$d[attr2] });
    }
    disconnectedCallback() {
      this.$$cn = false;
      Promise.resolve().then(() => {
        if (!this.$$cn) {
          this.$$c.$destroy();
          this.$$c = void 0;
        }
      });
    }
    $$g_p(attribute_name) {
      return (
        Object.keys(this.$$p_d).find(
          (key) =>
            this.$$p_d[key].attribute === attribute_name ||
            (!this.$$p_d[key].attribute && key.toLowerCase() === attribute_name)
        ) || attribute_name
      );
    }
  };
}
function get_custom_element_value(prop, value, props_definition, transform) {
  const type2 = props_definition[prop]?.type;
  value = type2 === "Boolean" && typeof value !== "boolean" ? value != null : value;
  if (!transform || !props_definition[prop]) {
    return value;
  } else if (transform === "toAttribute") {
    switch (type2) {
      case "Object":
      case "Array":
        return value == null ? null : JSON.stringify(value);
      case "Boolean":
        return value ? "" : null;
      case "Number":
        return value == null ? null : value;
      default:
        return value;
    }
  } else {
    switch (type2) {
      case "Object":
      case "Array":
        return value && JSON.parse(value);
      case "Boolean":
        return value;
      case "Number":
        return value != null ? +value : value;
      default:
        return value;
    }
  }
}

// http-url:https://unpkg.com/svelte@4.2.2/src/runtime/store/index.js
var subscriber_queue = [];
function readable(value, start) {
  return {
    subscribe: writable(value, start).subscribe
  };
}
function writable(value, start = noop) {
  let stop;
  const subscribers = /* @__PURE__ */ new Set();
  function set(new_value) {
    if (safe_not_equal(value, new_value)) {
      value = new_value;
      if (stop) {
        const run_queue = !subscriber_queue.length;
        for (const subscriber of subscribers) {
          subscriber[1]();
          subscriber_queue.push(subscriber, value);
        }
        if (run_queue) {
          for (let i = 0; i < subscriber_queue.length; i += 2) {
            subscriber_queue[i][0](subscriber_queue[i + 1]);
          }
          subscriber_queue.length = 0;
        }
      }
    }
  }
  function update(fn) {
    set(fn(value));
  }
  function subscribe2(run2, invalidate = noop) {
    const subscriber = [run2, invalidate];
    subscribers.add(subscriber);
    if (subscribers.size === 1) {
      stop = start(set, update) || noop;
    }
    run2(value);
    return () => {
      subscribers.delete(subscriber);
      if (subscribers.size === 0 && stop) {
        stop();
        stop = null;
      }
    };
  }
  return { set, update, subscribe: subscribe2 };
}

// http-url:https://unpkg.com/@sveu/shared@1.0.1/chunk-LRJQKUWD.js
var browser = typeof window !== "undefined";
var isWs = typeof WebSocket !== "undefined";
function isFunction(value) {
  return type(value, true) === "[object Function]";
}
function isReadable(value) {
  return value && isFunction(value == null ? void 0 : value.subscribe);
}
function isWritable(value) {
  return value && ["subscribe", "set", "update"].every((n) => isFunction(value[n]));
}
function isPartialWritable(value) {
  return value && ["subscribe", "set"].every((n) => isFunction(value[n]));
}
function isReadableOnly(value) {
  return (
    value &&
    isFunction(value == null ? void 0 : value.subscribe) &&
    !isWritable(value) &&
    !isPartialWritable(value)
  );
}
var noop2 = () => {};
function type(value, full = false) {
  const _value = Object.prototype.toString.call(value);
  if (full) return _value;
  else return _value.slice(8, -1).toLowerCase();
}
function unstore(value) {
  return isReadable(value) ? get_store_value(value) : value;
}
function toWritable(value) {
  if (isPartialWritable(value)) return value;
  if (isReadableOnly(value)) return writable(unstore(value));
  return writable(value);
}
function toReadable(value) {
  if (isPartialWritable(value)) {
    return {
      subscribe: value.subscribe
    };
  }
  return isReadableOnly(value) ? value : readable(value);
}
function createSingletonPromise(fn) {
  let _promise;
  function wrapper() {
    if (!_promise) _promise = fn();
    return _promise;
  }
  wrapper.reset = async () => {
    const _prev = _promise;
    _promise = void 0;
    if (_prev) await _prev;
  };
  return wrapper;
}
function on_destroy(fn) {
  try {
    onDestroy(fn);
    return true;
  } catch (e) {
    return false;
  }
}

// http-url:https://unpkg.com/@sveu/shared@1.0.1/chunk-GC5LEYOY.js
function watchable(initialValue, fn) {
  const { subscribe: subscribe2, update } = toWritable(initialValue);
  let active = true;
  return {
    subscribe: subscribe2,
    set: (value) => {
      update((old_value) => {
        if (active) fn(old_value, value);
        return value;
      });
    },
    pause: () => {
      active = false;
    },
    resume: () => {
      active = true;
    }
  };
}

// http-url:https://unpkg.com/@sveu/shared@1.0.1/index.js
function adjustWithUnit(target, delta) {
  const { subscribe: subscribe2, update } = toWritable(target);
  function update_value(_target, type2) {
    var _a;
    if (typeof _target === "number") return type2 === "inc" ? _target + delta : _target - delta;
    const value = ((_a = _target.match(/^-?[0-9]+\.?[0-9]*/)) == null ? void 0 : _a[0]) || "";
    const unit = _target.slice(value.length);
    const result2 = type2 === "inc" ? parseFloat(value) + delta : parseFloat(value) - delta;
    if (Number.isNaN(result2)) return _target;
    return result2 + unit;
  }
  return {
    subscribe: subscribe2,
    inc: () => update((n) => update_value(n, "inc")),
    dec: () => update((n) => update_value(n, "dec"))
  };
}
function sleep(s, throwOnTimeout = false, reason = "Timeout") {
  return new Promise((resolve, reject) => {
    if (throwOnTimeout) setTimeout(() => reject(reason), s * 1e3);
    else setTimeout(resolve, s * 1e3);
  });
}
function asyncState(promise, initialState, options = {}) {
  const {
    immediate = true,
    delay = 0,
    onError = noop2,
    onSuccess = noop2,
    resetOnExecute = true,
    throwError
  } = options != null ? options : {};
  const state = toWritable(initialState);
  const ready = toWritable(false);
  const loading = toWritable(false);
  const error = toWritable(void 0);
  async function execute(delay2 = 0, ...args) {
    if (resetOnExecute) state.set(initialState);
    error.set(void 0);
    ready.set(false);
    loading.set(true);
    if (delay2 > 0) await sleep(delay2);
    const _promise = typeof promise === "function" ? promise(...args) : promise;
    try {
      const data = await _promise;
      state.set(data);
      ready.set(true);
      onSuccess(data);
    } catch (e) {
      error.set(e);
      onError(e);
      if (throwError) throw error;
    } finally {
      loading.set(false);
    }
    return state;
  }
  if (immediate) execute(delay);
  return {
    state: toReadable(state),
    ready: toReadable(ready),
    loading: toReadable(loading),
    error: toReadable(error),
    execute
  };
}
function createEventHook() {
  const fns = /* @__PURE__ */ new Set();
  function off(fn) {
    fns.delete(fn);
  }
  function on(fn) {
    fns.add(fn);
    const offFn = () => off(fn);
    on_destroy(offFn);
    return {
      off: offFn
    };
  }
  function trigger(param) {
    return Promise.all(Array.from(fns).map((fn) => fn(param)));
  }
  return {
    on,
    off,
    trigger
  };
}
function intervalFn(fn, interval = 1, options = {}) {
  const { immediate = true, immediateCallback = false } = options;
  const active = writable(false);
  let timer = null;
  function clean() {
    if (timer) {
      clearInterval(timer);
      timer = null;
    }
  }
  function pause() {
    active.set(false);
    clean();
  }
  function resume() {
    if (unstore(interval) <= 0) return;
    active.set(true);
    if (immediateCallback) fn();
    clean();
    timer = setInterval(fn, unstore(interval) * 1e3);
  }
  if (immediate) resume();
  on_destroy(pause);
  return {
    active: toReadable(active),
    pause,
    resume
  };
}
function timeoutFn(fn, interval = 1, options = {}) {
  const { immediate = true, immediateCallback = false } = options;
  const active = writable(false);
  let timer = null;
  function clear() {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
  }
  function pause() {
    active.set(false);
    clear();
  }
  function resume() {
    clear();
    active.set(true);
    if (immediateCallback) fn();
    timer = setTimeout(() => {
      active.set(false);
      timer = null;
      fn();
    }, unstore(interval) * 1e3);
  }
  if (immediate) resume();
  on_destroy(pause);
  return {
    active: toReadable(active),
    resume,
    pause
  };
}

// http-url:https://unpkg.com/@sveu/shared@1.0.1/dicts.js
function contains(obj, ...keys) {
  return keys.some((key) => key in obj);
}

// http-url:https://unpkg.com/@sveu/browser@1.0.1/index.js
var __defProp = Object.defineProperty;
var __getOwnPropSymbols = Object.getOwnPropertySymbols;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __propIsEnum = Object.prototype.propertyIsEnumerable;
var __defNormalProp = (obj, key, value) =>
  key in obj
    ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value })
    : (obj[key] = value);
var __spreadValues2 = (a, b) => {
  for (var prop in b || (b = {})) if (__hasOwnProp.call(b, prop)) __defNormalProp(a, prop, b[prop]);
  if (__getOwnPropSymbols)
    for (var prop of __getOwnPropSymbols(b)) {
      if (__propIsEnum.call(b, prop)) __defNormalProp(a, prop, b[prop]);
    }
  return a;
};
function eventListener(...args) {
  let target;
  let events;
  let listeners;
  let options;
  if (typeof args[0] === "string" || Array.isArray(args[0])) {
    [events, listeners, options] = args;
    target = browser ? window : void 0;
  } else {
    [target, events, listeners, options] = args;
  }
  if (!target) return noop2;
  if (!Array.isArray(events)) events = [events];
  if (!Array.isArray(listeners)) listeners = [listeners];
  const cleanups = [];
  function cleanup() {
    cleanups.forEach((fn) => fn());
    cleanups.length = 0;
  }
  function register(_target, event, listener, options2) {
    _target.addEventListener(event, listener, options2);
    return () => _target.removeEventListener(event, listener, options2);
  }
  cleanup();
  cleanups.push(
    ...events.flatMap((event) => {
      return listeners.map((listener) => register(target, event, listener, options));
    })
  );
  on_destroy(cleanup);
  return cleanup;
}
function activeEl() {
  const { set, subscribe: subscribe2 } = toWritable(
    browser ? (document == null ? void 0 : document.activeElement) : null
  );
  function handler() {
    set((document == null ? void 0 : document.activeElement) || null);
  }
  if (browser) {
    eventListener(
      window,
      "blur",
      (event) => {
        if (event.relatedTarget !== null) return;
        handler();
      },
      true
    );
    eventListener(window, "focus", handler, true);
  }
  return { subscribe: subscribe2 };
}
var DEFAULT_SERIALIZER = {
  array: (v) => JSON.stringify(v),
  object: (v) => JSON.stringify(v),
  set: (v) => JSON.stringify(Array.from(v)),
  map: (v) => JSON.stringify(Object.fromEntries(v)),
  null: () => ""
};
function get_serialization(target) {
  if (!target) return DEFAULT_SERIALIZER.null;
  if (target instanceof Map) return DEFAULT_SERIALIZER.map;
  else if (target instanceof Set) return DEFAULT_SERIALIZER.set;
  else if (Array.isArray(target)) return DEFAULT_SERIALIZER.array;
  else return DEFAULT_SERIALIZER.object;
}
function img_loaded(img) {
  return new Promise((resolve, reject) => {
    if (!img.complete) {
      img.onload = () => {
        resolve();
      };
      img.onerror = reject;
    } else {
      resolve();
    }
  });
}
function blob_to_base64(blob) {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = (e) => {
      var _a;
      resolve((_a = e.target) == null ? void 0 : _a.result);
    };
    fr.onerror = reject;
    fr.readAsDataURL(blob);
  });
}
function base64(target, options) {
  const base642 = toWritable("");
  function execute() {
    if (!browser) return;
    new Promise((resolve, reject) => {
      try {
        if (target == null) resolve("");
        else if (typeof target === "string") {
          resolve(blob_to_base64(new Blob([target], { type: "text/plain" })));
        } else if (target instanceof Blob) {
          resolve(blob_to_base64(target));
        } else if (target instanceof ArrayBuffer) {
          resolve(window.btoa(String.fromCharCode(...new Uint8Array(target))));
        } else if (target instanceof HTMLCanvasElement) {
          resolve(
            target.toDataURL(
              options == null ? void 0 : options.type,
              options == null ? void 0 : options.quality
            )
          );
        } else if (target instanceof HTMLImageElement) {
          const img = target.cloneNode(false);
          img.crossOrigin = "Anonymous";
          img_loaded(img)
            .then(() => {
              const canvas = document.createElement("canvas");
              const ctx = canvas.getContext("2d");
              canvas.width = img.width;
              canvas.height = img.height;
              ctx == null ? void 0 : ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
              resolve(
                canvas.toDataURL(
                  options == null ? void 0 : options.type,
                  options == null ? void 0 : options.quality
                )
              );
            })
            .catch(reject);
        } else if (typeof target === "object") {
          const serializer =
            (options == null ? void 0 : options.serializer) || get_serialization(target);
          const serialized = serializer(target);
          return resolve(
            blob_to_base64(
              new Blob([serialized], {
                type: "application/json"
              })
            )
          );
        } else {
          reject(new Error("target is unsupported types"));
        }
      } catch (error) {
        reject(error);
      }
    }).then((res) => base642.set(res));
  }
  execute();
  return toReadable(base642);
}
function support(feature, from = "navigator") {
  const { subscribe: subscribe2, set } = toWritable(false);
  if (browser) {
    const _from =
      from === "navigator"
        ? navigator
        : from === "window"
        ? window
        : from === "document"
        ? document
        : performance;
    set(_from && feature in _from);
  }
  return { subscribe: subscribe2 };
}
function mediaQuery(query) {
  if (!browser) return toReadable(false);
  const supported2 = support("matchMedia", "window");
  if (!unstore(supported2)) return toReadable(false);
  const { subscribe: subscribe2, set } = toWritable(false);
  const media_query = window.matchMedia(query);
  function handler(event) {
    set(event.matches);
  }
  set(media_query.matches);
  eventListener(media_query, "change", handler);
  return { subscribe: subscribe2 };
}
function breakpoints(breakpoints2) {
  function get_value(key, delta) {
    let value = breakpoints2[key];
    if (delta != null) value = unstore(adjustWithUnit(value, delta));
    if (type(value) === "number") value = `${value}px`;
    return value;
  }
  function gte(key) {
    return mediaQuery(`(min-width: ${get_value(key)})`);
  }
  function gt(key) {
    return mediaQuery(`(min-width: ${get_value(key, 0.1)})`);
  }
  function lte(key) {
    return mediaQuery(`(max-width: ${get_value(key)})`);
  }
  function lt(key) {
    return mediaQuery(`(max-width: ${get_value(key, -0.1)})`);
  }
  function bn(a, b) {
    return mediaQuery(`(min-width: ${get_value(a)}) and (max-width: ${get_value(b, -0.1)})`);
  }
  const shortcut_methods = Object.keys(breakpoints2).reduce((shortcuts, k) => {
    Object.defineProperty(shortcuts, k, {
      get: () => gte(k),
      enumerable: true,
      configurable: true
    });
    return shortcuts;
  }, {});
  return __spreadValues2(
    {
      gt,
      gte,
      lt,
      lte,
      bn
    },
    shortcut_methods
  );
}
function broadcastChannel(options = {}) {
  const { name = "default" } = options;
  const supported2 = support("BroadcastChannel", "window");
  const closed = toWritable(false);
  const channel = toWritable(void 0);
  const data = toWritable(void 0);
  const error = toWritable(null);
  function post(data2) {
    var _a;
    (_a = unstore(channel)) == null ? void 0 : _a.postMessage(data2);
  }
  function close() {
    var _a;
    (_a = unstore(channel)) == null ? void 0 : _a.close();
    closed.set(true);
  }
  if (unstore(supported2) && browser) {
    error.set(null);
    channel.set(new BroadcastChannel(name));
    eventListener(
      unstore(channel),
      "message",
      (event) => {
        data.set(event.data);
      },
      { passive: true }
    );
    eventListener(
      unstore(channel),
      "messageerror",
      (event) => {
        error.set(event);
      },
      { passive: true }
    );
    eventListener(
      unstore(channel),
      "close",
      () => {
        closed.set(true);
      },
      { passive: true }
    );
  }
  on_destroy(close);
  return {
    channel: toReadable(channel),
    closed: toReadable(closed),
    data: toReadable(data),
    error: toReadable(error),
    supported: supported2,
    close,
    post
  };
}
function clipboard(options = {}) {
  const { read = false, source, copiedDuring = 1.5, legacy = false } = options;
  const events = ["copy", "cut"];
  const clipboard_supported = support("clipboard");
  const supported2 = toReadable(clipboard_supported || legacy);
  const text = toWritable("");
  const copied = toWritable(false);
  const timeout = timeoutFn(() => copied.set(false), copiedDuring, {
    immediate: false
  });
  async function update_text() {
    var _a;
    if (unstore(clipboard_supported)) {
      const value =
        (_a = await (navigator == null ? void 0 : navigator.clipboard.readText())) != null
          ? _a
          : "";
      text.set(value);
    } else text.set(legacy_read());
  }
  if (unstore(supported2) && read) {
    for (const event of events) eventListener(event, update_text);
  }
  async function copy(value = source) {
    if (unstore(supported2) && value != null) {
      if (unstore(clipboard_supported) && !legacy)
        await (navigator == null ? void 0 : navigator.clipboard.writeText(value));
      else legacy_copy(value);
      text.set(value);
      copied.set(true);
      timeout.resume();
    }
  }
  function legacy_copy(value) {
    const ta = document.createElement("textarea");
    ta.value = value != null ? value : "";
    ta.style.position = "absolute";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    document.execCommand("copy");
    ta.remove();
  }
  function legacy_read() {
    var _a, _b, _c;
    return (_c =
      (_b =
        (_a = document == null ? void 0 : document.getSelection) == null
          ? void 0
          : _a.call(document)) == null
        ? void 0
        : _b.toString()) != null
      ? _c
      : "";
  }
  return {
    supported: supported2,
    text: toReadable(text),
    copied: toReadable(copied),
    copy
  };
}
function domVisible() {
  if (!browser) return toWritable("hidden");
  const { subscribe: subscribe2, set } = toWritable(document.visibilityState);
  function handler() {
    set(document.visibilityState);
  }
  eventListener(document, "visibilitychange", handler, true);
  return { subscribe: subscribe2 };
}
function eventDispatcher(target) {
  function dispatch(name, value) {
    target == null ? void 0 : target.dispatchEvent(new CustomEvent(name, { detail: value }));
  }
  return dispatch;
}
function eyeDropper(options = {}) {
  const { fallback = "" } = options;
  const supported2 = support("EyeDropper", "window");
  const sRGBHex = toWritable(fallback);
  async function open(openOptions) {
    if (!unstore(supported2)) return;
    const eyeDropper2 = new window.EyeDropper();
    const result2 = await eyeDropper2.open(openOptions);
    sRGBHex.set(result2.sRGBHex);
    return result2;
  }
  return { supported: supported2, result: toReadable(sRGBHex), open };
}
var DEFAULT_OPTIONS = {
  multiple: true,
  accept: "*",
  reset: false
};
function fileDialog(options = {}) {
  const files = toWritable(null);
  const accepted = toWritable(null);
  const rejected = toWritable(null);
  const { on: onChange, trigger } = createEventHook();
  let input;
  if (browser) {
    input = document.createElement("input");
    input.type = "file";
    input.onchange = (event) => {
      const result2 = event.target;
      files.set(result2.files);
      trigger(files);
      if (result2.accept && result2.files && result2.accept !== "*") {
        const _accepted = Array.from(result2.files).filter((file) => {
          const regex = new RegExp(result2.accept.replace(/\*/g, ".*"));
          return regex.test(file.type);
        });
        const _rejected = Array.from(result2.files).filter((file) => {
          const regex = new RegExp(result2.accept.replace(/\*/g, ".*"));
          return !regex.test(file.type);
        });
        accepted.set(_accepted);
        rejected.set(_rejected);
      }
    };
  }
  function open(localOptions) {
    var _a, _b, _c;
    if (!input) return;
    const _options = __spreadValues2(
      __spreadValues2(__spreadValues2({}, DEFAULT_OPTIONS), options),
      localOptions
    );
    input.multiple = (_a = _options.multiple) != null ? _a : true;
    input.accept = (_b = _options.accept) != null ? _b : "*";
    if (contains(_options, "capture")) input.capture = (_c = _options.capture) != null ? _c : "";
    if (_options.reset) reset();
    input.click();
  }
  function reset() {
    files.set(null);
    accepted.set(null);
    rejected.set(null);
    if (input) input.value = "";
  }
  return {
    files: toReadable(files),
    accepted: toReadable(accepted),
    rejected: toReadable(rejected),
    open,
    reset,
    onChange
  };
}
function rafFn(fn, options = {}) {
  const { immediate = true } = options;
  const active = toWritable(false);
  let raf_id = null;
  function loop2() {
    if (!unstore(active) || !browser) return;
    fn();
    raf_id = window.requestAnimationFrame(loop2);
  }
  function resume() {
    if (!unstore(active) && browser) {
      active.set(true);
      loop2();
    }
  }
  function pause() {
    active.set(false);
    if (raf_id != null && window) {
      window.cancelAnimationFrame(raf_id);
      raf_id = null;
    }
  }
  if (immediate) resume();
  on_destroy(pause);
  return {
    pause,
    resume,
    active: toReadable(active)
  };
}
function fps(options = {}) {
  var _a;
  const { subscribe: subscribe2, set } = toWritable(0);
  if (typeof performance === "undefined") return { subscribe: subscribe2 };
  const every = (_a = options == null ? void 0 : options.every) != null ? _a : 10;
  let last = performance.now();
  let ticks = 0;
  rafFn(() => {
    ticks += 1;
    if (ticks >= every) {
      const now2 = performance.now();
      const diff = now2 - last;
      set(Math.round(1e3 / (diff / ticks)));
      last = now2;
      ticks = 0;
    }
  });
  return { subscribe: subscribe2 };
}
function geolocation(options = {}) {
  const { high = true, maxAge = 3, timeout = 27, immediate = true } = options;
  const supported2 = support("geolocation");
  const locatedAt = toWritable(null);
  const error = toWritable(null);
  const coords = toWritable({
    accuracy: 0,
    latitude: Infinity,
    longitude: Infinity,
    altitude: null,
    altitudeAccuracy: null,
    heading: null,
    speed: null
  });
  function update(position) {
    locatedAt.set(position.timestamp);
    coords.set({
      accuracy: position.coords.accuracy,
      altitude: position.coords.altitude,
      altitudeAccuracy: position.coords.altitudeAccuracy,
      heading: position.coords.heading,
      latitude: position.coords.latitude,
      longitude: position.coords.longitude,
      speed: position.coords.speed
    });
    error.set(null);
  }
  let watcher;
  function resume() {
    if (unstore(supported2)) {
      watcher =
        navigator == null
          ? void 0
          : navigator.geolocation.watchPosition(update, (err) => error.set(err), {
              enableHighAccuracy: high,
              maximumAge: maxAge * 1e3,
              timeout: timeout * 1e3
            });
    }
  }
  if (immediate) resume();
  function pause() {
    if (watcher && browser) navigator.geolocation.clearWatch(watcher);
  }
  on_destroy(pause);
  return {
    supported: supported2,
    coords: toReadable(coords),
    locatedAt: toReadable(locatedAt),
    error: toReadable(error),
    resume,
    pause
  };
}
async function load_image(options) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const { src, srcset, sizes, class: clazz, loading, crossOrigin, referrerPolicy } = options;
    img.src = src;
    if (srcset) img.srcset = srcset;
    if (sizes) img.sizes = sizes;
    if (clazz) img.className = clazz;
    if (loading) img.loading = loading;
    if (crossOrigin) img.crossOrigin = crossOrigin;
    if (referrerPolicy) img.referrerPolicy = referrerPolicy;
    img.onload = () => resolve(img);
    img.onerror = reject;
  });
}
function image(options, asyncStateOptions) {
  const state = asyncState(
    () => load_image(options),
    void 0,
    __spreadValues2(
      {
        resetOnExecute: true
      },
      asyncStateOptions
    )
  );
  state.execute(asyncStateOptions ? asyncStateOptions.delay : 0);
  return state;
}
function intersectionObserver(target, fn, options = {}) {
  const { root, margin = "0px", threshold = 0.1 } = options;
  const supported2 = support("IntersectionObserver", "window");
  let stop = noop2;
  if (unstore(supported2)) {
    if (!target) return;
    stop();
    const observer = new IntersectionObserver(fn, {
      root,
      rootMargin: margin,
      threshold
    });
    observer.observe(target);
    stop = () => {
      observer == null ? void 0 : observer.unobserve(target);
      observer == null ? void 0 : observer.disconnect();
    };
  }
  on_destroy(stop);
  return {
    supported: supported2,
    stop
  };
}
function memory(options = {}) {
  const _memory = toWritable(void 0);
  const supported2 = support("memory", "performance");
  if (unstore(supported2)) {
    const { interval = 1 } = options;
    intervalFn(
      () => {
        _memory.set({
          jsHeapSizeLimit: performance.memory.jsHeapSizeLimit,
          totalJSHeapSize: performance.memory.totalJSHeapSize,
          usedJSHeapSize: performance.memory.usedJSHeapSize
        });
      },
      interval,
      {
        immediate: options.immediate,
        immediateCallback: options.immediateCallback
      }
    );
  }
  return { supported: supported2, result: toReadable(_memory) };
}
var builtin_extractors = {
  page: (event) => [event.pageX, event.pageY],
  client: (event) => [event.clientX, event.clientY],
  screen: (event) => [event.screenX, event.screenY],
  movement: (event) => (event instanceof Touch ? null : [event.movementX, event.movementY])
};
function mouse(options = {}) {
  const {
    type: type2 = "page",
    touch = true,
    resetOnTouchEnds = false,
    fallback = { x: 0, y: 0 },
    eventFilter
  } = options;
  const x = toWritable(fallback.x);
  const y = toWritable(fallback.y);
  const source_type = toWritable(null);
  const extractor = typeof type2 === "function" ? type2 : builtin_extractors[type2];
  function mouse_handler(event) {
    const result2 = extractor(event);
    if (result2) {
      x.set(result2[0]);
      y.set(result2[1]);
      source_type.set("mouse");
    }
  }
  function reset() {
    x.set(fallback.x);
    y.set(fallback.y);
  }
  function touch_handler(event) {
    if (event.touches.length > 0) {
      const result2 = extractor(event.touches[0]);
      if (result2) {
        x.set(result2[0]);
        y.set(result2[1]);
        source_type.set("touch");
      }
    }
  }
  function mouse_handler_wrapper(event) {
    return eventFilter === void 0
      ? mouse_handler(event)
      : eventFilter(() => mouse_handler(event), {});
  }
  function touch_handler_wrapper(event) {
    return eventFilter === void 0
      ? touch_handler(event)
      : eventFilter(() => touch_handler(event), {});
  }
  if (browser) {
    eventListener(window, "mousemove", mouse_handler_wrapper, {
      passive: true
    });
    eventListener(window, "dragover", mouse_handler_wrapper, {
      passive: true
    });
    if (touch && type2 !== "movement") {
      eventListener(window, "touchstart", touch_handler_wrapper, {
        passive: true
      });
      eventListener(window, "touchmove", touch_handler_wrapper, {
        passive: true
      });
      if (resetOnTouchEnds) eventListener(window, "touchend", reset, { passive: true });
    }
  }
  return {
    x: toReadable(x),
    y: toReadable(y),
    type: toReadable(source_type)
  };
}
function mutationObserver(target, fn, options = {}) {
  let observer;
  const supported2 = support("MutationObserver", "window");
  function cleanup() {
    if (observer) {
      observer.disconnect();
      observer = void 0;
    }
  }
  if (unstore(supported2) && target) {
    cleanup();
    observer = new MutationObserver(fn);
    observer.observe(target, options);
  }
  on_destroy(cleanup);
  return {
    supported: supported2,
    cleanup
  };
}
function network() {
  const supported2 = support("connection");
  const online = toWritable(true);
  const save_data = toWritable(false);
  const offline_at = toWritable(void 0);
  const online_at = toWritable(void 0);
  const downlink = toWritable(void 0);
  const downlink_max = toWritable(void 0);
  const rtt = toWritable(void 0);
  const effective_type = toWritable(void 0);
  const type2 = toWritable("unknown");
  function update_network_info() {
    online.set(navigator.onLine);
    offline_at.set(navigator.onLine ? void 0 : Date.now());
    online_at.set(navigator.onLine ? Date.now() : void 0);
    if (unstore(supported2)) {
      const connection = navigator.connection;
      downlink.set(connection.downlink);
      downlink_max.set(connection.downlinkMax);
      effective_type.set(connection.effectiveType);
      rtt.set(connection.rtt);
      save_data.set(connection.saveData);
      type2.set(connection.type);
    }
  }
  if (browser) {
    eventListener(window, "offline", update_network_info);
    eventListener(window, "online", update_network_info);
  }
  if (unstore(supported2))
    eventListener(navigator.connection, "change", update_network_info, false);
  if (browser) update_network_info();
  return {
    supported: supported2,
    online: toReadable(online),
    saveData: toReadable(save_data),
    offlineAt: toReadable(offline_at),
    onlineAt: toReadable(online_at),
    downlink: toReadable(downlink),
    downlinkMax: toReadable(downlink_max),
    effectiveType: toReadable(effective_type),
    rtt: toReadable(rtt),
    type: toReadable(type2)
  };
}
function notification(options = {}) {
  const supported2 = support("Notification", "window");
  const notification2 = toWritable(null);
  const on_click = createEventHook();
  const on_show = createEventHook();
  const on_error = createEventHook();
  const on_close = createEventHook();
  async function request_permission() {
    if (!unstore(supported2)) return;
    if ("permission" in Notification && Notification.permission !== "denied")
      await Notification.requestPermission();
  }
  function close() {
    const n = unstore(notification2);
    if (n) n.close();
    notification2.set(null);
  }
  async function show(overrides) {
    if (!unstore(supported2)) return;
    await request_permission();
    const _options = Object.assign({}, options, overrides);
    notification2.set(new Notification(_options.title || "", _options));
    const n = unstore(notification2);
    if (n) {
      n.onclick = (event) => on_click.trigger(event);
      n.onshow = (event) => on_show.trigger(event);
      n.onerror = (event) => on_error.trigger(event);
      n.onclose = (event) => on_close.trigger(event);
      return n;
    }
  }
  if (unstore(supported2)) {
    request_permission();
    eventListener(document, "visibilitychange", (e) => {
      e.preventDefault();
      if (document.visibilityState === "visible") close();
    });
  }
  on_destroy(close);
  return {
    supported: supported2,
    notify: toReadable(notification2),
    show,
    close,
    onClick: on_click.on,
    onShow: on_show.on,
    onError: on_error.on,
    onClose: on_close.on
  };
}
function create_key_predicate(key_filter) {
  if (typeof key_filter === "function") return key_filter;
  if (typeof key_filter === "string") return (event) => event.key === key_filter;
  if (Array.isArray(key_filter)) return (event) => key_filter.includes(event.key);
  return () => true;
}
function onKeyStroke(...args) {
  let key;
  let handler;
  let options = {};
  if (args.length === 3) {
    key = args[0];
    handler = args[1];
    options = args[2];
  } else if (args.length === 2) {
    if (typeof args[1] === "object") {
      key = true;
      handler = args[0];
      options = args[1];
    } else {
      key = args[0];
      handler = args[1];
    }
  } else {
    key = true;
    handler = args[0];
  }
  const {
    target = browser ? window : void 0,
    event = "keydown",
    passive = false,
    dedupe = false
  } = options;
  const predicate = create_key_predicate(key);
  const listener = (e) => {
    if (e.repeat && dedupe) return;
    if (predicate(e)) handler(e);
  };
  return eventListener(target, event, listener, passive);
}
function permission(name, options = {}) {
  const { controls = false } = options;
  const supported2 = support("permissions");
  let permission_status;
  const desc = { name };
  const state = toWritable(void 0);
  const on_change = () => {
    if (permission_status) state.set(permission_status.state);
  };
  const query = createSingletonPromise(async () => {
    if (!unstore(supported2)) return;
    if (!permission_status) {
      try {
        permission_status = await (navigator == null ? void 0 : navigator.permissions.query(desc));
        eventListener(permission_status, "change", on_change);
        on_change();
      } catch (e) {
        state.set("prompt");
      }
    }
    return permission_status;
  });
  query();
  if (controls) {
    return {
      state: toReadable(state),
      supported: supported2,
      query
    };
  } else return toReadable(state);
}
function preferredLang() {
  if (!browser) return toReadable(["en"]);
  const navigator2 = window.navigator;
  const { subscribe: subscribe2, set } = toWritable(navigator2.languages);
  eventListener(window, "languagechange", () => {
    set(navigator2.languages);
  });
  return { subscribe: subscribe2 };
}
function url_base64_to_uint8_array(base642) {
  const padding = "=".repeat((4 - (base642.length % 4)) % 4);
  const _base64 = (base642 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const data = window.atob(_base64);
  const output = new Uint8Array(data.length);
  for (const [i, char] of data.split("").entries()) output[i] = char.charCodeAt(0);
  return output;
}
function pushNotification(swUrl, vapid, options = {}) {
  const { base64: base642 = true, userVisibleOnly = true } = options;
  const supported2 = support("serviceWorker");
  const result2 = toWritable("");
  async function init() {
    var _a, _b;
    const register =
      (_a = await navigator.serviceWorker.getRegistration(swUrl)) != null
        ? _a
        : await navigator.serviceWorker.register(swUrl);
    await sleep(0.1);
    const subscription =
      (_b = await register.pushManager.getSubscription()) != null
        ? _b
        : await register.pushManager.subscribe({
            userVisibleOnly,
            applicationServerKey: url_base64_to_uint8_array(vapid)
          });
    if (base642) result2.set(window == null ? void 0 : window.btoa(JSON.stringify(subscription)));
    else result2.set(subscription);
  }
  if (unstore(supported2)) init();
  return { result: toReadable(result2), supported: supported2 };
}
function resizeObserver(target, callback, options = {}) {
  let observer;
  const supported2 = support("ResizeObserver", "window");
  function cleanup() {
    if (observer) {
      observer.disconnect();
      observer = void 0;
    }
  }
  cleanup();
  if (unstore(supported2) && target) {
    observer = new ResizeObserver(callback);
    observer == null ? void 0 : observer.observe(target, options);
  }
  on_destroy(cleanup);
  return {
    supported: supported2,
    cleanup
  };
}
function screenOrientation() {
  var _a, _b, _c, _d;
  const supported_screen = support("screen", "window");
  const supported_orientation = unstore(supported_screen) && "orientation" in window.screen;
  const supported2 = toReadable(unstore(supported_screen) && supported_orientation);
  const _screen_orientation = unstore(supported2)
    ? (_b = (_a = window == null ? void 0 : window.screen) == null ? void 0 : _a.orientation) !=
      null
      ? _b
      : {}
    : {};
  const orientation = toWritable(
    (_c = _screen_orientation == null ? void 0 : _screen_orientation.type) != null ? _c : "unknown"
  );
  const angle = toWritable(
    (_d = _screen_orientation == null ? void 0 : _screen_orientation.angle) != null ? _d : 0
  );
  if (unstore(supported2)) {
    eventListener(window, "orientationchange", () => {
      var _a2, _b2, _c2, _d2;
      orientation.set(
        (_b2 =
          (_a2 = window == null ? void 0 : window.screen) == null ? void 0 : _a2.orientation) ==
          null
          ? void 0
          : _b2.type
      );
      angle.set(
        (_d2 =
          (_c2 = window == null ? void 0 : window.screen) == null ? void 0 : _c2.orientation) ==
          null
          ? void 0
          : _d2.angle
      );
    });
  }
  function lock(type2) {
    if (!unstore(supported2)) throw Error("The lock type is not supported");
    _screen_orientation == null ? void 0 : _screen_orientation.lock(type2);
  }
  function unlock() {
    if (unstore(supported2)) _screen_orientation == null ? void 0 : _screen_orientation.unlock();
  }
  return {
    supported: supported2,
    orientation: toReadable(orientation),
    angle: toReadable(angle),
    lock,
    unlock
  };
}
function urlQuery(mode = "history", options = {}) {
  const {
    fallback = {},
    removeNullish = true,
    removeFalsy = false,
    write: enable_write = true,
    encode = false
  } = options;
  if (!browser) return watchable(fallback, noop2);
  const state = watchable(fallback, (_, new_state) => {
    const queries = new URLSearchParams("");
    Object.keys(new_state).forEach((key) => {
      const item = new_state[key];
      if (Array.isArray(item) || typeof item === "object") {
        const serialized = JSON.stringify(item);
        queries.set(key, encode ? encodeURIComponent(serialized) : serialized);
      } else queries.set(key, item);
      if (removeFalsy && !item) queries.delete(key);
      if (removeNullish && item === null) queries.delete(key);
    });
    write(queries);
  });
  function get_raw_query() {
    if (mode === "history") return window.location.search || "";
    else if (mode === "hash") {
      const hash = window.location.hash || "";
      const index = hash.indexOf("?");
      return index > 0 ? hash.slice(index) : "";
    } else return (window.location.hash || "").replace(/^#/, "");
  }
  function construct_query(query) {
    const stringified = query.toString();
    if (mode === "history")
      return `${stringified ? `?${stringified}` : ""}${window.location.hash || ""}`;
    if (mode === "hash-query")
      return `${window.location.search || ""}${stringified ? `#${stringified}` : ""}`;
    const hash = window.location.hash || "#";
    const index = hash.indexOf("?");
    if (index > 0) return `${hash.slice(0, index)}${stringified ? `?${stringified}` : ""}`;
    return `${hash}${stringified ? `?${stringified}` : ""}`;
  }
  function read() {
    return new URLSearchParams(get_raw_query());
  }
  function update_state(queries) {
    const unused_keys = new Set(Object.keys(unstore(state)));
    for (const key of queries.keys()) {
      const query_for_key = queries.getAll(key);
      const _state = unstore(state);
      _state[key] = query_for_key.length > 1 ? query_for_key : queries.get(key) || "";
      unused_keys.delete(key);
    }
    Array.from(unused_keys).forEach((key) => delete unstore(state)[key]);
  }
  function write(queries, should_update) {
    if (should_update) update_state(queries);
    window.history.replaceState(
      window.history.state,
      window.document.title,
      window.location.pathname + construct_query(queries)
    );
  }
  function on_changed() {
    if (!enable_write) return;
    write(read(), true);
  }
  eventListener(window, "popstate", on_changed, false);
  if (mode !== "history") eventListener(window, "hashchange", on_changed, false);
  const initial = read();
  if (initial.keys().next().value) update_state(initial);
  else Object.assign(state, fallback);
  return state;
}
var storage_serializers = {
  boolean: {
    read: (v) => v === "true",
    write: (v) => String(v)
  },
  object: {
    read: (v) => JSON.parse(v),
    write: (v) => JSON.stringify(v)
  },
  number: {
    read: (v) => toNumber(v),
    write: (v) => String(v)
  },
  any: {
    read: (v) => v,
    write: (v) => String(v)
  },
  string: {
    read: (v) => v,
    write: (v) => String(v)
  },
  map: {
    read: (v) => new Map(JSON.parse(v)),
    write: (v) => JSON.stringify(Array.from(v.entries()))
  },
  set: {
    read: (v) => new Set(JSON.parse(v)),
    write: (v) => JSON.stringify(Array.from(v))
  },
  date: {
    read: (v) => new Date(v),
    write: (v) => v.toISOString()
  }
};
function guess_serializer_type(value) {
  return value == null
    ? "any"
    : value instanceof Set
    ? "set"
    : value instanceof Map
    ? "map"
    : value instanceof Date
    ? "date"
    : typeof value === "boolean"
    ? "boolean"
    : typeof value === "string"
    ? "string"
    : typeof value === "object"
    ? "object"
    : !Number.isNaN(value)
    ? "number"
    : "any";
}
function get_store(store) {
  if (store === "session")
    return {
      set(key, value) {
        sessionStorage.setItem(key, value);
      },
      get(key) {
        return sessionStorage.getItem(key);
      },
      delete(key) {
        sessionStorage.removeItem(key);
      }
    };
  if (store === "cookie")
    return {
      set(key, value) {
        document.cookie = `${key}=${value};path=/;`;
      },
      get(key) {
        const cookies = document.cookie.split(";");
        const cookie = cookies.find((cookie2) => cookie2.startsWith(key));
        if (!cookie) return null;
        return cookie.split("=")[1];
      },
      delete(key) {
        document.cookie = `${key}=; Max-Age=0; path=/;`;
      }
    };
  return {
    set(key, value) {
      localStorage.setItem(key, value);
    },
    get(key) {
      return localStorage.getItem(key);
    },
    delete(key) {
      localStorage.removeItem(key);
    }
  };
}
function storage(key, fallback, options = {}) {
  var _a, _b;
  const {
    store = "local",
    sync = true,
    onError = (e) => {
      console.error(e);
    }
  } = options;
  if (!browser) return watchable(fallback, noop2);
  if (store === "url") {
    const _fallback = {};
    _fallback[key] = fallback;
    const query = urlQuery("history", { fallback: _fallback });
    const data2 = watchable(fallback, (_, n) => {
      if (!n) query.set("");
      else query.set({ [key]: n });
    });
    if (((_a = unstore(query)) == null ? void 0 : _a[key]) !== void 0) {
      const item = unstore(query)[key];
      try {
        if (typeof item === "string") data2.set(JSON.parse(item));
        else data2.set(item);
      } catch (e) {
        data2.set(item);
      }
    }
    return data2;
  }
  const type2 = guess_serializer_type(fallback);
  const serializer = (_b = options.serializer) != null ? _b : storage_serializers[type2];
  const data = watchable(fallback, (_, n) => write(n));
  const _store = get_store(store);
  update();
  function read() {
    const value = _store.get(key);
    if (value === null) {
      if (fallback !== void 0 && fallback !== null) _store.set(key, serializer.write(fallback));
      return fallback;
    } else if (typeof value !== "string") return value;
    else return serializer.read(value);
  }
  function write(value) {
    try {
      if (value === null) _store.delete(key);
      else {
        const serialized = serializer.write(value);
        const old_value = _store.get(key);
        if (old_value !== serialized) _store == null ? void 0 : _store.set(key, serialized);
      }
    } catch (e) {
      onError(e);
    }
  }
  function update() {
    data.pause();
    try {
      data.set(read());
    } catch (e) {
      onError(e);
    } finally {
      data.resume();
    }
  }
  if (sync && store === "local") eventListener(window, "storage", update);
  return data;
}
function useragent() {
  const mobile = toWritable(false);
  const arch = toWritable("");
  const model = toWritable("");
  const platform = toWritable("");
  const platformVersion = toWritable("");
  const bitness = toWritable("");
  const brands = toWritable([{ name: "", version: "" }]);
  const supported2 = support("userAgentData");
  if (unstore(supported2)) {
    const { state } = asyncState(
      // @ts-expect-error navigator.userAgentData is not supported in all browsers
      navigator.userAgentData.getHighEntropyValues([
        "architecture",
        "model",
        "platform",
        "platformVersion",
        "bitness"
      ]),
      {
        mobile: false,
        architecture: "",
        model: "",
        platform: "",
        platformVersion: "",
        bitness: "",
        brands: [{ name: "", version: "" }]
      }
    );
    const unsubscribe = state.subscribe((v) => {
      if (!v) return;
      mobile.set(v.mobile);
      arch.set(v.architecture);
      model.set(v.model);
      platform.set(v.platform);
      platformVersion.set(v.platformVersion);
      bitness.set(v.bitness);
      const _brands = v.brands.map((b) => {
        return {
          name: b.brand,
          version: b.version
        };
      });
      brands.set(_brands);
    });
    on_destroy(unsubscribe);
  }
  return {
    supported: supported2,
    brands: toReadable(brands),
    mobile: toReadable(mobile),
    arch: toReadable(arch),
    model: toReadable(model),
    platform: toReadable(platform),
    platformVersion: toReadable(platformVersion),
    bitness: toReadable(bitness)
  };
}
function vibrate(options = {}) {
  const { pattern = [], interval = 0 } = options;
  const supported2 = support("vibrate");
  let intervalControls;
  function start() {
    if (supported2) {
      if (Array.isArray(pattern)) {
        const new_pattern = pattern.map((num) => num * 1e3);
        navigator.vibrate(new_pattern);
      } else {
        navigator.vibrate(pattern * 1e3);
      }
    }
  }
  function stop() {
    if (supported2) navigator.vibrate(0);
    intervalControls == null ? void 0 : intervalControls.pause();
  }
  if (interval > 0) {
    intervalControls = intervalFn(start, interval, {
      immediate: false,
      immediateCallback: false
    });
  }
  on_destroy(stop);
  return {
    supported: supported2,
    intervalControls,
    start,
    stop
  };
}
function wakeLock() {
  let _wake_lock;
  const supported2 = support("wakeLock");
  const active = toWritable(false);
  async function on_visibility_change() {
    if (!unstore(supported2) || !_wake_lock) return;
    if (document.visibilityState === "visible")
      _wake_lock = await navigator.wakeLock.request("screen");
    active.set(!_wake_lock.released);
  }
  if (browser)
    eventListener(document, "visibilitychange", on_visibility_change, {
      passive: true
    });
  async function request(type2) {
    if (!unstore(supported2)) return;
    _wake_lock = await navigator.wakeLock.request(type2);
    active.set(!_wake_lock.released);
  }
  async function release() {
    if (!unstore(supported2) || !_wake_lock) return;
    await _wake_lock.release();
    active.set(!_wake_lock.released);
    _wake_lock = null;
  }
  return {
    supported: supported2,
    active: toReadable(active),
    request,
    release
  };
}
var DEFAULT_PING_MESSAGE = "ping";
function resolve_nested_options(options) {
  if (options === true) return {};
  return options;
}
function websocket(url, options = {}) {
  const {
    onConnected,
    onDisconnected,
    onError,
    onMessage,
    immediate = true,
    autoClose = true,
    protocols = []
  } = options;
  const data = toWritable(null);
  const status = toWritable("CLOSED");
  const ws_store = toWritable(void 0);
  let heartbeat_pause;
  let heartbeat_resume;
  let explicitly_closed = false;
  let retried = 0;
  let buffered_data = [];
  let pong_timeout_wait;
  function close(code = 1e3, reason) {
    var _a;
    if (!unstore(ws_store)) return;
    explicitly_closed = true;
    heartbeat_pause == null ? void 0 : heartbeat_pause();
    (_a = unstore(ws_store)) == null ? void 0 : _a.close(code, reason);
  }
  function _send_buffer() {
    var _a;
    if (
      (buffered_data == null ? void 0 : buffered_data.length) &&
      unstore(ws_store) &&
      unstore(status) === "OPEN"
    ) {
      for (const buffer of buffered_data)
        (_a = unstore(ws_store)) == null ? void 0 : _a.send(buffer);
      buffered_data = [];
    }
  }
  function reset_heartbeat() {
    clearTimeout(pong_timeout_wait);
    pong_timeout_wait = void 0;
  }
  function send(data2, buffer = true) {
    var _a;
    if (!unstore(ws_store) || unstore(status) !== "OPEN") {
      if (buffer) buffered_data = [...buffered_data, data2];
      return false;
    }
    _send_buffer();
    (_a = unstore(ws_store)) == null ? void 0 : _a.send(data2);
    return true;
  }
  function _init() {
    if (explicitly_closed) return;
    const ws = new WebSocket(url, protocols);
    ws_store.set(ws);
    status.set("CONNECTING");
    ws.onopen = () => {
      status.set("OPEN");
      onConnected == null ? void 0 : onConnected(ws);
      heartbeat_resume == null ? void 0 : heartbeat_resume();
      _send_buffer();
    };
    ws.onclose = (event) => {
      status.set("CLOSED");
      ws_store.set(void 0);
      onDisconnected == null ? void 0 : onDisconnected(ws, event);
      if (!explicitly_closed && options.autoReconnect) {
        const { retries = -1, delay = 1, onFailed } = resolve_nested_options(options.autoReconnect);
        retried += 1;
        if (typeof retries === "number" && (retries < 0 || retried < retries))
          setTimeout(_init, delay * 1e3);
        else if (typeof retries === "function" && retries()) setTimeout(_init, delay * 1e3);
        else onFailed == null ? void 0 : onFailed();
      }
    };
    ws.onerror = (event) => {
      onError == null ? void 0 : onError(ws, event);
    };
    ws.onmessage = (event) => {
      if (options.heartbeat) {
        reset_heartbeat();
        const { message = DEFAULT_PING_MESSAGE } = resolve_nested_options(options.heartbeat);
        if (event.data === message) return;
      }
      data.set(event.data);
      onMessage == null ? void 0 : onMessage(ws, event);
    };
  }
  if (options.heartbeat) {
    const {
      message = DEFAULT_PING_MESSAGE,
      interval = 1,
      pongTimeout = 1
    } = resolve_nested_options(options.heartbeat);
    const { pause, resume } = intervalFn(
      () => {
        send(message, false);
        pong_timeout_wait = setTimeout(() => {
          close();
        }, pongTimeout * 1e3);
      },
      interval,
      { immediate: false }
    );
    heartbeat_pause = pause;
    heartbeat_resume = resume;
  }
  if (immediate && isWs) _init();
  if (autoClose) {
    if (browser) eventListener(window, "beforeunload", () => close());
    on_destroy(close);
  }
  function open() {
    close();
    explicitly_closed = false;
    retried = 0;
    _init();
  }
  return {
    data: toReadable(data),
    status: toReadable(status),
    ws: toReadable(ws_store),
    close,
    send,
    open
  };
}
function windowFocus() {
  if (!browser) return toReadable(false);
  const { set, subscribe: subscribe2 } = toWritable(window.document.hasFocus());
  eventListener(window, "blur", () => set(false));
  eventListener(window, "focus", () => set(true));
  return { subscribe: subscribe2 };
}
function windowScroll() {
  if (!browser) return { x: toReadable(0), y: toReadable(0) };
  const x = toWritable(window.scrollX);
  const y = toWritable(window.scrollY);
  eventListener(
    window,
    "scroll",
    () => {
      x.set(window.scrollX);
      y.set(window.scrollY);
    },
    {
      capture: false,
      passive: true
    }
  );
  return { x: toReadable(x), y: toReadable(y) };
}
function windowSize(options = {}) {
  const {
    initialWidth = Infinity,
    initialHeight = Infinity,
    orientation = true,
    scrollbar = true
  } = options;
  if (!browser) return { width: toReadable(0), height: toReadable(0) };
  const width = toWritable(initialWidth);
  const height = toWritable(initialHeight);
  const update = () => {
    if (scrollbar) {
      width.set(window.innerWidth);
      height.set(window.innerHeight);
    } else {
      width.set(window.document.documentElement.clientWidth);
      height.set(window.document.documentElement.clientHeight);
    }
  };
  update();
  eventListener("resize", update, { passive: true });
  if (orientation) eventListener("orientationchange", update, { passive: true });
  return { width, height };
}
function worker(arg, options) {
  let unsubscribe = noop2;
  const data = toWritable(null);
  const error = toWritable(null);
  const wk = toWritable(void 0);
  if (browser) {
    if (typeof arg === "string") wk.set(new Worker(arg, options));
    else if (typeof arg === "function") wk.set(arg());
    else wk.set(arg);
    unsubscribe = wk.subscribe((_worker) => {
      if (!_worker) return;
      _worker.onmessage = (e) => {
        data.set(e.data);
      };
      _worker.onerror = (e) => {
        error.set(e.error);
      };
    });
  }
  function post(value) {
    const _wk = unstore(wk);
    if (!_wk) return;
    _wk.postMessage(value);
  }
  function cleanup() {
    var _a;
    (_a = unstore(wk)) == null ? void 0 : _a.terminate();
    unsubscribe();
  }
  on_destroy(cleanup);
  return {
    data: toReadable(data),
    error: toReadable(error),
    wk: toReadable(wk),
    post,
    cleanup
  };
}

// /input.ts
var _fps = fps();
var { supported, result } = memory();
export {
  activeEl,
  base64,
  breakpoints,
  broadcastChannel,
  clipboard,
  domVisible,
  eventDispatcher,
  eventListener,
  eyeDropper,
  fileDialog,
  fps,
  geolocation,
  image,
  intersectionObserver,
  mediaQuery,
  memory,
  mouse,
  mutationObserver,
  network,
  notification,
  eventListener as on,
  onKeyStroke,
  permission,
  preferredLang,
  pushNotification,
  rafFn,
  resizeObserver,
  screenOrientation,
  storage,
  support,
  urlQuery,
  useragent,
  vibrate,
  wakeLock,
  websocket,
  windowFocus,
  windowScroll,
  windowSize,
  worker
};
