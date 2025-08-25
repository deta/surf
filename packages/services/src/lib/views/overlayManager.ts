import {
  isDev,
  createDummyPromise,
  useLogScope,
  type ScopedLogger,
  type DummyPromise,
} from "@deta/utils";
import { useViewManager, type ViewManager } from "./viewManager.svelte";
import {
  WebContentsViewActionType,
  WebContentsViewEventType,
  type Fn,
  type WebContentsViewActionOutputs,
  type WebContentsViewEvent,
} from "@deta/types";

export class Overlay {
  id: string;
  window: Window;
  bounds: Electron.Rectangle | null;

  private log: ScopedLogger;
  private manager: OverlayManager;
  private unsubs: Fn[] = [];

  domReady: DummyPromise<void> | null = null;

  constructor(
    manager: OverlayManager,
    data: { id: string; window: Window; bounds?: Electron.Rectangle },
  ) {
    this.log = useLogScope("Overlay");
    this.manager = manager;
    this.id = data.id;
    this.window = data.window;
    this.bounds = data.bounds || null;
  }

  async init() {
    this.log.debug(`Initializing overlay with ID: ${this.id}`, this);

    this.domReady = createDummyPromise();
    this.attachListeners();

    if (this.bounds) {
      await this.saveBounds(this.bounds);
    }

    await this.activate();

    // await this.domReady.promise
  }

  get wrapperElement(): HTMLElement | null {
    return (
      this.window.document.getElementById("wcv-overlay-content") ||
      this.window.document.body
    );
  }

  attachListeners() {
    const unsubWebContentsEvents = window.preloadEvents.onWebContentsViewEvent(
      (event: WebContentsViewEvent) => {
        // only handle events for our own view
        if (event.viewId !== this.id) {
          return;
        }

        this.log.debug(
          `Received WebContentsViewEvent for overlay ${this.id}`,
          event,
        );

        if (event.type === WebContentsViewEventType.DOM_READY) {
          this.domReady?.resolve();
        }
      },
    );

    this.unsubs.push(unsubWebContentsEvents);
  }

  async saveBounds(bounds: Electron.Rectangle) {
    this.bounds = bounds;
    (await window.api.webContentsViewAction(
      this.id,
      WebContentsViewActionType.SET_BOUNDS,
      {
        x: bounds.x,
        y: bounds.y,
        width: bounds.width,
        height: bounds.height,
      },
    )) as Promise<
      WebContentsViewActionOutputs[WebContentsViewActionType.SET_BOUNDS]
    >;
  }

  async activate() {
    return (await window.api.webContentsViewAction(
      this.id,
      WebContentsViewActionType.ACTIVATE,
      {},
    )) as Promise<
      WebContentsViewActionOutputs[WebContentsViewActionType.ACTIVATE]
    >;
  }

  destroy() {
    this.unsubs.forEach((unsub) => unsub());
    this.unsubs = [];

    return window.api.webContentsViewAction(
      this.id,
      WebContentsViewActionType.DESTROY,
      {},
    ) as Promise<
      WebContentsViewActionOutputs[WebContentsViewActionType.DESTROY]
    >;
  }
}

export class OverlayManager {
  private static self: OverlayManager | null = null;

  private log: ScopedLogger;
  viewManager: ViewManager;

  overlays: Map<string, Overlay> = new Map(); // Maps overlay IDs to overlay instances

  constructor() {
    this.log = useLogScope("OverlayManager");
    this.viewManager = useViewManager();

    if (isDev) {
      // @ts-ignore
      window.overlayManager = this;
    }
  }

  async create(opts?: { bounds?: Electron.Rectangle }) {
    const overlayId = `overlay-${Date.now()}`;

    const overlayWindow = window.open(
      "about:blank",
      `portal_${overlayId}`,
      `componentId=${overlayId}`,
    ) as Window | null;

    if (!overlayWindow) {
      throw new Error("Failed to create overlay web contents");
    }

    this.log.debug(`Creating overlay with ID: ${overlayId}`, overlayWindow);

    const overlay = new Overlay(this, {
      id: overlayId,
      window: overlayWindow,
      bounds: opts?.bounds,
    });

    await overlay.init();

    this.overlays.set(overlayId, overlay);

    return overlay;
  }

  async destroy(overlayId: string) {
    const overlay = this.overlays.get(overlayId);
    if (!overlay) {
      this.log.warn(`Overlay with ID ${overlayId} not found`);
      return;
    }

    this.log.debug(`Destroying overlay with ID: ${overlayId}`, overlay);
    await overlay.destroy();
  }

  static getInstance(): OverlayManager {
    if (!OverlayManager.self) {
      OverlayManager.self = new OverlayManager();
    }
    return OverlayManager.self;
  }

  // Add methods for managing overlays here
}

export const useOverlayManager = () => OverlayManager.getInstance();
