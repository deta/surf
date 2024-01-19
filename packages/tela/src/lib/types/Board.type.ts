import type { Spring, Tweened } from "svelte/motion";
import type { Readable, Writable } from "svelte/store";
import type { Vec4 } from "./Utils.type.js";
import type { BaseState, StateMachine } from "$lib/state-machine/fsm.js";

export interface IBoardSettings {
  CAN_PAN: boolean;
  PAN_DIRECTION: "xy" | "x" | "y";

  CAN_DRAW: boolean;
  CAN_ZOOM: boolean;
  CAN_SELECT: boolean;

  SNAP_TO_GRID: boolean;
  GRID_SIZE: number;

  BOUNDS: {
    minX: number;
    maxX: number;
    minY: number;
    maxY: number;
    minZoom: number;
    maxZoom: number;
    limit: "soft" | "hard";
  };

  // CULL: boolean;
  // CULL_MARGIN: number;

  // Chunking
  CHUNK_WIDTH: number;
  CHUNK_HEIGHT: number;
  // CHUNK_CULL_MARGIN: number;
  // CHUNK_WARM_MARGIN: number;

  // Key property name used for positionable
  POSITIONABLE_KEY: string;

  // show dev stuff
  DEV: boolean;
}

export type TBoardMode =
  // Default mode
  | "default"
  | "drawing"
  | "select"
  // Used when pan key is held down
  | "pan"
  // Used when panning
  | "panning"
  // Used when panTo is invoked
  | "auto-panning"
  // Used when zoom key is held down
  | "zoom"
  // Used when zoomTo is invoked
  | "auto-zooming"
  // Used when positionable is dragged around
  | "dragging"
  // Used when positionable is being resized
  | "resizing";

export interface IBoardState<BaseSt extends BaseState, Actions> {
  viewOffset: Tweened<{ x: number, y: number }> | Spring<{ x: number, y: number }>;
  viewPort: Writable<Vec4>;
  zoom: Tweened<number>;
  mode: StateMachine<BaseSt, Actions>;
  selectionRect: Writable<Vec4 | null>;
  selectionCss: Readable<string>;
  selection: Writable<Set<string>>;
  stackingOrder: Writable<string[]>;
}

export interface IBoard<BaseSt extends BaseState, Actions> {
  state: Writable<IBoardState<BaseSt, Actions>>;

  panTo: (
    x: number,
    y: number,
    opts: { delay?: number; duration?: number; hard?: boolean }
  ) => void;
  zoomTo: (zoom: number, opts?: { delay?: number; duration?: number; soft?: string | number | boolean }) => Promise<void>;
}