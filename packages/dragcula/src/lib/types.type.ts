import type { DragItem, DragZone } from "./index.js";

export type DropEffect = "move" | "copy" | "link" | "none";

export type DragItemPreviewType = "clone" | "hoist" | "component";

export type DropPosition = "before" | "after" | "on";

/*export interface DragOperation {
	readonly id: string;

	from: DragZone | null;
	to: DragZone | null;

	item: DragItem | DataTransfer;
}*/

/// Core stuff

export type Vec2<T> = { x: T; y: T };
