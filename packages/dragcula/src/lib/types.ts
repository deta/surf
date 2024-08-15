import type { DragItem } from "./DragItem.js";
import type { DragZone } from "./index.js";

export type DragEffect = "move" | "copy" | "link" | "none";

export type DragData = Record<string, unknown>;

export interface DragOperation {
  readonly id: string;

  readonly status: "active" | "finalizing" | "aborted" | "done";

  from: DragZone | null;
  to: DragZone | null;

  item: DragItem | DataTransfer;

  index?: number;

  /// Metadata
  clientX: number;
  clientY: number;
}
