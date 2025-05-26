type Point = { x: number; y: number }
type Rect = { x: number; y: number; width: number; height: number }

export const dist = (p1: { x: number; y: number }, p2: { x: number; y: number }, t: number) =>
  Math.abs(p1.x - p2.x) <= t && Math.abs(p1.y - p2.y) <= t

export const isInsideRect = ({ x, y }: Point, rect: Rect) =>
  x > rect.x && x < rect.x + rect.width && y > rect.y && y < rect.y + rect.height

export const getRandomBooleanWithProbability = (probability = 0.5) => Math.random() < probability
