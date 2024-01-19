import type { Tweened } from "svelte/motion";
import type { Vec2, Vec4 } from "./Utils.type.js";
import type { Writable } from "svelte/store";
import type { IPositionable } from "$lib/Positionable.svelte";

export interface IBoardSettings {
  CAN_PAN: boolean;
  PAN_DIRECTION: "xy" | "x" | "y";

  CAN_DRAW: boolean;
  CAN_ZOOM: boolean;
  CAN_SELECT: boolean;

  SNAP_TO_GRID: boolean;
  GRID_SIZE: number;

  BOUNDS: {
    minX: number | null;
    maxX: number | null;
    minY: number | null;
    maxY: number | null;
    minZoom: number | null;
    maxZoom: number | null;
    limit: "soft" | "hard";
  };

  // mostly internal stuff
  CULL: boolean;
  CULL_MARGIN: number;

  // Chunking
  CHUNK_SIZE: number;
  CHUNK_CULL_MARGIN: number;
  CHUNK_WARM_MARGIN: number;

  // Key property name used for positionable
  POSITIONABLE_KEY: string;

  // dev stuff
  DEV: {
    SHOW_POS: boolean;
    SHOW_MODE: boolean;

    // Display chunks as colored boxed
    CHUNK_DBG: boolean;
  };
}
export interface IBoardState {
  viewOffset: { x: Tweened<number>, y: Tweened<number> };
  viewPort: Vec4; // Store viewport position in case container el is not full window
  zoom: Tweened<number>;
  mode: TBoardMode;
  selection: Writable<Set<string>>;
}
export interface IBoard {
  state: Writable<IBoardState>;

  // Commands
  setMode: (mode: TBoardMode) => void;
  panTo: (x: number, y: number, duration?: number, delay?: number) => Promise<any>;
  zoomTo: (zoom: number, duration?: number, delay?: number) => Promise<void>;

  // Handlers, called from inside tela. Can also be called from outside to extend functionality.
  /**
   * Called when positionable
   */
  onChunksChanged: (
    chunks: Writable<Map<string, Writable<IPositionable[]>>>,
    changed: Set<string>
  ) => void;
}

export type TBoardMode =
  // Default mode
  | "draw"
  // Used when drawing with only left click
  | "drawing"
  // Used when select key is held down
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
export interface TIBoardState { // todo; kill?
  mode: TBoardMode;
}