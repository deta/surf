import type { DragItem, DragZone } from "./index.js";
import { genId, ii_DRAGCULA, log, SUPPORTS_VIEW_TRANSITIONS } from "./utils/internal.js";

/**
 * Global Dragcula Singleton.
 * Holding state & can be used to start a simulated drag etc.
 */
export class Dragcula {
  static readonly #instance = new Dragcula();
  static get() {
    return Dragcula.#instance;
  }
  getClass() {
    return Dragcula;
  }
  readonly transparentImg: HTMLImageElement;

  protected static _useViewTransitions = false;
  static get useViewTransitions() {
    if (!SUPPORTS_VIEW_TRANSITIONS) return false;
    return this._useViewTransitions;
  }
  static set useViewTransitions(v: boolean) {
    this._useViewTransitions = v;
  }

  protected constructor() {
    const img = document.createElement("img");
    img.src = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";
    this.transparentImg = img;

    // Reset after native drop
    document.addEventListener("drop", (e) => {
      // NOTE: This will cleanup after a native drop, as it wont have dragend called on any element.
      // TODO: Is this correct?
      if (!Dragcula.get().activeDrag?.isNative) return;
      setTimeout(() => this.cleanupDragOperation());
    });
    /*document.addEventListener("dragenter", (e) => {
					if (this.activeDrag !== null) return
					this.prepareDragOperation()
				});
				document.addEventListener("dragleave", (e) => {
		
					this.cleanupDragOperation()
				});*/

    /*window.addEventListener("dragenter", e => {
			if (e.fromElement !== document.documentElement) return;
			console.log("DRAGENTER")
		});
		window.addEventListener("dragleave", e => {
			if (e.toElement !== document.documentElement) return;
			console.log("DRAGLEAVE")
		});*/

    // @ts-ignore
    window.Dragcula = this;
  }

  activeDrag: DragOperation | null = null;

  /// Callback to update global stuff like body attributes
  public prepareDragOperation() {
    document.body.setAttribute("data-dragging", "true");
  }

  /// Callback to cleanup global stuff like body attributes
  public cleanupDragOperation() {
    log.debug(`${ii_DRAGCULA}\x1B[40;97m === Cleanup Drag`);
    document.body.removeAttribute("data-dragging");

    this.activeDrag = null;
  }
}

export class DragOperation<DataTypes extends { [key: string]: any } = { [key: string]: any }> {
  readonly id: string;

  from: DragZone | null;
  #to: DragZone | null;
  get to() {
    return this.#to;
  }
  set to(v: DragZone | null) {
    this.#to = v;
    if (v !== null) {
      document.body.setAttribute("data-drag-target", v.id);
    } else {
      document.body.removeAttribute("data-drag-target");
    }
  }

  item: DragItem<DataTypes> | null; // DragItem, null it native drag from outside
  dataTransfer: DataTransfer | null; // DataTransfer, if custom drag, still original event dataTransfer

  index: number | null; // Generic index used by e.g. AxisDragZone

  get isNative(): boolean {
    return this.item === null && this.dataTransfer !== null;
  }

  protected constructor(props: {
    id?: string;
    from?: DragZone;
    to?: DragZone;
    item?: DragItem<any>;
    dataTransfer?: DataTransfer;
    index?: number;
  }) {
    this.id = props.id ?? genId();
    this.from = props.from || null;
    this.#to = props.to || null;
    this.item = props.item ?? null;
    this.dataTransfer = props.dataTransfer ?? null;
    this.index = props.index ?? null;
  }

  static new(props: {
    id?: string;
    from?: DragZone;
    to?: DragZone;
    item?: DragItem;
    dataTransfer?: DataTransfer;
  }): DragOperation {
    return new this(props);
  }
}

/*export class DragData<T extends { [key: string]: (unknown | (() => Promise<unknown>)) } = { [key: string]: string }> {
	#data = new Map<string, unknown | (() => Promise<unknown>)>();

	constructor(from?: Record<keyof T, unknown>) {
		if (from) {
			for (const [key, value] of Object.entries(from)) {
				this.setData(key, value as any);
			}
		}
	}

	public clearData(key?: keyof T | (string & {})) {
		if (!key) {
			this.#data.clear();
		}
		else this.#data.delete(key as string);
	}

	public setData<K extends keyof T | (string & {})>(
		key: K,
		value: K extends keyof T
			? T[K]
			: unknown
	) {
		// @ts-ignore this still works for the returing type and is fine!
		this.#data.set(key as string, value);
	}

	public getData<V extends string, K extends { [key: string]: (unknown | (() => Promise<unknown>)) } = { [key: string]: string }>(key: V): V extends keyof T ? T[V] : unknown {
		const value = this.#data.get(key as string);
		return (typeof value === 'function' ? value() : value) as K extends keyof T ? T[K] : unknown;
	}

	public hasData(key: keyof T | (string & {})): boolean {
		return this.#data.has(key as string);
	}
}*/

/*export class DragData<T extends Record<string, unknown | (() => Promise<unknown>)> = Record<string, string>> {
	#data = new Map<string, unknown | (() => Promise<unknown>)>();

	constructor(from?: Partial<T>) {
		if (from) {
			for (const [key, value] of Object.entries(from)) {
				this.setData(key, value);
			}
		}
	}

	public clearData(key?: keyof T | string): void {
		if (key === undefined) {
			this.#data.clear();
		} else {
			this.#data.delete(String(key));
		}
	}

	public setData<K extends keyof T | string>(
		key: K,
		value: K extends keyof T ? T[K] : unknown
	): void {
		this.#data.set(String(key), value);
	}

	public getData<K extends keyof T | string>(key: K): K extends keyof T ? T[K] : string {
		const value = this.#data.get(String(key));
		return (typeof value === 'function' ? value() : value) as K extends keyof T ? T[K] : string;
	}

	public hasData(key: keyof T | string): boolean {
		return this.#data.has(String(key));
	}
}*/

/*export class DragData<T extends Record<string, unknown> = Record<string, unknown>> {
	#data = new Map<string, unknown>();

	constructor(from?: Partial<T>) {
		if (from) {
			for (const [key, value] of Object.entries(from)) {
				this.setData(key, value);
			}
		}
	}

	public clearData(key?: keyof T | string): void {
		if (key === undefined) {
			this.#data.clear();
		} else {
			this.#data.delete(String(key));
		}
	}

	public setData<K extends keyof T | string>(
		key: K,
		value: K extends keyof T ? T[K] : unknown
	): void {
		this.#data.set(String(key), value);
	}

	public getData<TV extends { [key: string]: unknown } = T, UN extends { [key: keyof TV]: string }, K extends keyof TV | string = string>(key: K): K extends keyof TV ? TV[K] : unknown {
		return this.#data.get(String(key)) as K extends keyof TV ? TV[K] : unknown;
	}

	public hasData(key: keyof T | string): boolean {
		return this.#data.has(String(key));
	}
}*/

export class DragData<T extends Record<string, any> = { [key: string]: any }> {
  #data: Map<string, unknown> = new Map();

  constructor(from?: Partial<T>) {
    if (from) {
      for (const [key, value] of Object.entries(from)) {
        this.setData(key, value);
      }
    }
  }

  public getData<K extends keyof T>(key: K): T[K];
  public getData(key: string): unknown;
  public getData(key: string): unknown {
    return this.#data.get(key);
  }

  public setData<K extends keyof T>(key: K, value: T[K]): void;
  public setData(key: string, value: unknown): void;
  public setData(key: string, value: unknown): void {
    this.#data.set(key, value);
  }

  public hasData<K extends keyof T>(key: K): boolean;
  public hasData(key: string): boolean;
  public hasData(key: string): boolean {
    return this.#data.has(key);
  }

  public clearData<K extends keyof T>(key?: K): void;
  public clearData(key?: string): void;
  public clearData(key?: string): void {
    if (key === undefined) this.#data.clear();
    else this.#data.delete(key);
  }
}
