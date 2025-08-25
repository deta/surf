import {
  derived,
  get,
  writable,
  type Readable,
  type Writable,
} from "svelte/store";

import {
  WebContentsViewActionType,
  type WebContentsViewData,
  WebContentsViewManagerActionType,
  type Fn,
} from "@deta/types";
import { useLogScope, EventEmitterBase, generateID, isDev } from "@deta/utils";
import { ConfigService, useConfig } from "../config";
import { KVStore, useKVTable } from "../kv";
import { WebContentsView, type WebContents } from "./webContentsView.svelte";
import {
  ViewManagerEmitterNames,
  type ViewManagerEmitterEvents,
} from "./types";
import type { NewWindowRequest } from "../ipc/events";

export type OverlayState = {
  teletypeOpen: boolean;
};

/**
 * Core service responsible for managing all web content views in the application.
 * Coordinates the creation, destruction, and activation of web views, handles
 * view overlays, and manages the visibility state of views.
 *
 * Key responsibilities:
 * - View lifecycle management (create, destroy)
 * - View activation and focus handling
 * - Overlay view management (for features like teletype)
 * - View persistence and state restoration
 * - Coordination with TabsService for browser-like functionality
 *
 * This service implements a singleton pattern and should be accessed via useViewManager().
 */
export class ViewManager extends EventEmitterBase<ViewManagerEmitterEvents> {
  log: ReturnType<typeof useLogScope>;
  config: ConfigService;
  kv: KVStore<WebContentsViewData>;

  webContentsViews: Map<string, WebContents> = new Map();
  viewOverlays: Map<string, string> = new Map(); // Maps a view to its overlay view if it has one
  overlayState: Writable<OverlayState>;

  activeViewId: Writable<string | null>;
  shouldHideViews: Readable<boolean>;

  views: Writable<WebContentsView[]>;

  private unsubs: Fn[] = [];

  static self: ViewManager;

  constructor() {
    super();

    this.log = useLogScope("ViewManager");
    this.config = useConfig();
    this.kv = useKVTable<WebContentsViewData>("views");

    this.overlayState = writable({
      teletypeOpen: false,
    });

    this.activeViewId = writable(null);
    this.views = writable([]);

    /*
        derived([this.tabsManager.activeTab], ([$activeTab]) => {
            if ($activeTab?.type === 'page') {
                const view = this.views.get($activeTab.id);
                return view ? view.id : null;
            }

            return null;
        })
        */

    this.shouldHideViews = derived([this.overlayState], ([$overlayState]) => {
      return $overlayState.teletypeOpen;
    });

    this.unsubs.push(
      this.shouldHideViews.subscribe((shouldHide) => {
        this.log.debug("shouldHideViews changed:", shouldHide);
        if (shouldHide) {
          this.hideViews();
        } else {
          this.showViews();
        }
      }),
    );

    if (isDev) {
      // @ts-ignore
      window.viewManager = this;
    }
  }

  get viewsValue() {
    const viewsArray: WebContents[] = [];
    this.webContentsViews.forEach((view) => {
      viewsArray.push(view);
    });
    return viewsArray;
  }

  get shouldHideViewsValue() {
    return get(this.shouldHideViews);
  }

  get overlayStateValue() {
    return get(this.overlayState);
  }

  get activeViewIdValue() {
    return get(this.activeViewId);
  }

  handleNewWindowRequest(viewId: string, details: NewWindowRequest) {
    this.log.debug("New window request received", viewId, details);
    this.emit(ViewManagerEmitterNames.NEW_WINDOW_REQUEST, details);
  }

  async changeOverlayState(changes: Partial<OverlayState>) {
    this.overlayState.update((state) => {
      const newState = { ...state, ...changes };
      return newState;
    });
  }

  trackOverlayView(viewId: string, overlayViewId: string) {
    this.viewOverlays.set(viewId, overlayViewId);
  }

  create(data: Partial<WebContentsViewData>) {
    const fullData = {
      id: data.id || generateID(),
      partition: data.partition || "persist:horizon",
      url: data.url || "about:blank",
      title: data.title || "",
      faviconUrl: data.faviconUrl || "",
      navigationHistoryIndex: data.navigationHistoryIndex ?? -1,
      navigationHistory: data.navigationHistory ?? [],
      permanentlyActive: data.permanentlyActive ?? false,
      createdAt: data.createdAt || new Date().toISOString(),
      updatedAt: data.updatedAt || new Date().toISOString(),
    } satisfies WebContentsViewData;

    const view = new WebContentsView(fullData, this);
    this.views.update((views) => [...views, view]);

    this.log.debug("Creating WebContentsView with data:", view);

    return view;
  }

  async postMountedWebContents(
    viewId: string,
    webContents: WebContents,
    activate = true,
  ) {
    this.log.debug("Mounted WebContentsView:", viewId);

    this.webContentsViews.set(viewId, webContents);
    this.emit(ViewManagerEmitterNames.CREATED, webContents);

    this.log.debug(`created with ID: ${viewId}`, webContents);

    if (activate) {
      await this.activate(viewId);
    }

    return webContents;
  }

  /**
   * Activates a specific web contents view, making it visible and focused.
   * This method handles the complex logic of view activation, including:
   * - Managing overlay views
   * - Handling parent-child view relationships
   * - Ensuring proper view visibility state
   * - Coordinating with the window manager
   *
   * Before activating a view, it ensures all other views are hidden to maintain
   * proper view hierarchy and prevent visual conflicts.
   */
  async activate(viewId: string) {
    const view = this.webContentsViews.get(viewId);
    if (!view) {
      this.log.warn(`WebContentsView with ID ${viewId} does not exist.`);
      return false;
    }

    this.log.debug(`Activating WebContentsView with ID: ${viewId}`, view);

    // if (view.parentViewID) {
    //   this.log.debug(`View with ID ${viewId} has a parent view ID: ${view.parentViewID}`)
    //   const parentView = this.webContentsViews.get(view.parentViewID)
    //   if (parentView) {
    //     this.log.debug(`Refreshing parent view with ID: ${parentView.id}`, parentView)
    //     await parentView.refreshScreenshot()
    //   } else {
    //     this.log.warn(
    //       `Parent view with ID ${view.parentViewID} does not exist. Cannot refresh screenshot.`
    //     )
    //   }
    // }

    await this.hideAll();

    const overlayViewId = this.viewOverlays.get(view.id);
    if (overlayViewId) {
      this.log.debug(
        `Overlay view ID found for ${view.id}: ${overlayViewId}`,
        view,
      );
      // If this view is an overlay, we might want to handle the parent view's state
      const overlayView = this.webContentsViews.get(overlayViewId);
      if (overlayView) {
        this.log.debug(
          `Activating overlay view with ID: ${overlayViewId}`,
          overlayView,
        );
        await this.activate(overlayView.id);
        return true;
      } else {
        this.log.warn(`Overaly view with ID ${overlayViewId} does not exist.`);
        this.viewOverlays.delete(view.id); // Clean up if the overlay view does not exist
      }
    }

    await view.action(WebContentsViewActionType.ACTIVATE);
    this.activeViewId.set(view.id);

    this.emit(ViewManagerEmitterNames.ACTIVATED, view);

    return true;
  }

  async destroy(viewId: string) {
    const view = this.webContentsViews.get(viewId);
    if (!view) {
      this.log.warn(`WebContentsView with ID ${viewId} does not exist.`);
      return false;
    }

    this.log.debug(`Destroying WebContentsView with ID: ${viewId}`, view);

    view.onDestroy();
    this.webContentsViews.delete(viewId);
    this.emit(ViewManagerEmitterNames.DELETED, viewId);

    // if (viewId === this.activeViewIdValue && (!view.isOverlay || !this.shouldHideViewsValue)) {
    //   const activeTab = this.tabsManager.activeTabValue
    //   this.log.debug(`Active view with ID ${viewId} destroyed. Checking for new active view.`)
    //   if (activeTab?.type === 'page' && activeTab.id !== viewId) {
    //     const activeView = this.views.get(activeTab.id)
    //     if (activeView) {
    //       await this.activate(activeView.id)
    //     } else {
    //       // If no active view is found, reset the active view ID
    //       this.activeViewId.set(null)
    //     }
    //   }
    // }

    // if (!!view.parentViewID) {
    //   this.log.debug(`Removing overlay view for parentViewID: ${view.parentViewID}`, view.id)
    //   this.viewOverlays.delete(view.parentViewID)
    // }

    return true;
  }

  async hideAll() {
    window.api.webContentsViewManagerAction(
      WebContentsViewManagerActionType.HIDE_ALL,
    );
  }

  async showViews() {
    this.emit(ViewManagerEmitterNames.SHOW_VIEWS);

    const view = this.getActiveView();
    if (view) {
      this.activate(view.id);
    }

    // const activeTab = this.tabsManager.activeTabValue
    // if (activeTab?.type === 'page') {
    //   const activeView = this.views.get(activeTab.id)
    //   if (activeView) {
    //     this.activate(activeView.id)
    //   } else {
    //     this.log.warn(`Active view with ID ${activeTab.id} does not exist.`)
    //   }
    // }
  }

  async hideViews(emitEvent = true) {
    if (emitEvent) {
      const activeView = this.getActiveView();
      if (activeView) {
        await activeView.refreshScreenshot();
      }
    }

    window.api.webContentsViewManagerAction(
      WebContentsViewManagerActionType.HIDE_ALL,
    );
  }

  getActiveView(): WebContents | null {
    const activeViewId = this.activeViewIdValue;
    if (activeViewId) {
      return this.webContentsViews.get(activeViewId) || null;
    }
    return null;
  }

  onDestroy() {
    this.unsubs.forEach((unsub) => unsub());
  }

  static getInstance(): ViewManager {
    if (!ViewManager.self) {
      ViewManager.self = new ViewManager();
    }

    return ViewManager.self;
  }
}

export const useViewManager = (): ViewManager => {
  return ViewManager.getInstance();
};
