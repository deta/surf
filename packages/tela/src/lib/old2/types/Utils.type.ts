export type DeepPartial<T> = T extends object ? { [P in keyof T]?: DeepPartial<T[P]> } : T;

// export type Vec2 = { x: number; y: number };
export type Vec2<T> = { x: T; y: T };
export type Vec4 = { x: number; y: number; w: number; h: number };
