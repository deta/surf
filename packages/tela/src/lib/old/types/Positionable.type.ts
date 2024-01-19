import type { Vec2 } from "./Utils.type.js";

export interface TPositionable {
  key: string;

  // Rendering
  pos: Vec2;
  size: Vec2;
}