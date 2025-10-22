export const GRID_SIZE = 25

export const snapToGrid = (value, grid = GRID_SIZE) => {
  return grid * Math.round(value / grid)
}
