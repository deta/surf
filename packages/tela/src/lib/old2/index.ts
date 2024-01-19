// import Board from "./Board.svelte";
// export default { Board };

export { default as Board } from "./Board.svelte";
export { createBoard, createSettings, moveToStackingTop } from "./Board.svelte";

export { default as Chunked } from "./Chunked.svelte";
export { default as Chunk } from "./Chunk.svelte";
export { positionableInView } from "./Chunk.svelte";

export { default as Positionable } from "./Positionable.svelte";
export type { IPositionable } from "./Positionable.svelte";
export { default as Draggable } from "./Draggable.svelte";
export { default as Resizable } from "./Resizable.svelte";
export { default as Grid } from "./Grid.svelte";
// export { default as Gradient } from "./Gradient.svelte";

export { rectsIntersect, lerp, clamp, invlerp, map, hasClassOrParentWithClass, debounce } from "./utils.js";
export type { IBoard, IBoardSettings, IBoardState, TBoardMode } from "./types/Board.type.js";
export type { Vec2, DeepPartial, Vec4 } from "./types/Utils.type.js";


// Reexport your entry components here

// export default {
//   Board,
//   Positionable,
//   Draggable,
//   Resizable,
//   Grid
// };

// export type {
//   IBoardSettings,
//   TBoard,
//   Vec2
// }
