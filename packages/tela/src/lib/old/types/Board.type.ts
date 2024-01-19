import type { Writable } from "svelte/store";
import type { TPositionable } from "./Positionable.type.js";
import type { Vec2 } from "./Utils.type.js";

export interface TBoard {
  key: string;

  // Rendering
  viewOffset: Vec2;
  zoom: number;
  positionables: Writable<TPositionable[]>;
  inView: Writable<string[]>;   // Stores keys of draggables in view
}