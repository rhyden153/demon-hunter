// The camera shows one sector; the world contains nine connected sectors.
export const TILE = 24
export const VIEW_COLS = 37
export const VIEW_ROWS = 23
export const WIDTH = VIEW_COLS * TILE
export const HEIGHT = VIEW_ROWS * TILE
export const COLS = VIEW_COLS * 3
export const ROWS = VIEW_ROWS * 3
export const WORLD_WIDTH = COLS * TILE
export const WORLD_HEIGHT = ROWS * TILE

export const wrap = (value: number, size: number) => ((value % size) + size) % size
export const wrappedDelta = (difference: number, size: number) =>
  wrap(difference + size / 2, size) - size / 2

const walls = [
  [3, 3, 7, 1],
  [3, 3, 1, 5],
  [12, 2, 1, 5],
  [15, 3, 8, 1],
  [23, 3, 1, 4],
  [27, 2, 1, 5],
  [30, 3, 4, 1],
  [6, 6, 4, 1],
  [9, 6, 1, 4],
  [15, 6, 5, 1],
  [15, 6, 1, 3],
  [30, 6, 4, 1],
  [33, 6, 1, 4],
  [2, 10, 4, 1],
  [5, 10, 1, 4],
  [12, 10, 4, 1],
  [12, 10, 1, 4],
  [20, 9, 1, 5],
  [23, 9, 5, 1],
  [27, 9, 1, 5],
  [30, 12, 5, 1],
  [3, 16, 6, 1],
  [8, 13, 1, 4],
  [11, 16, 5, 1],
  [15, 16, 1, 4],
  [18, 16, 6, 1],
  [23, 16, 1, 4],
  [27, 16, 6, 1],
  [30, 16, 1, 4],
  [3, 19, 7, 1],
  [10, 19, 1, 2],
  [18, 19, 3, 1],
  [33, 19, 1, 2],
]

export function sectorPoint(sx: number, sy: number, x: number, y: number, wave: number) {
  return {
    x: (sx * VIEW_COLS + ((sx + sy + wave) % 2 === 0 ? VIEW_COLS - x : x)) * TILE,
    y: (sy * VIEW_ROWS + y) * TILE,
  }
}

export function createMaze(wave: number) {
  const grid = Array.from({ length: ROWS }, () => Array<number>(COLS).fill(0))
  // No perimeter wall: the outer corridors connect to the opposite side.
  for (let sy = 0; sy < 3; sy++)
    for (let sx = 0; sx < 3; sx++) {
      for (const [x = 0, y = 0, w = 0, h = 0] of walls) {
        for (let yy = y; yy < y + h; yy++)
          for (let xx = x; xx < x + w; xx++) {
            const point = sectorPoint(sx, sy, xx + 0.5, yy + 0.5, wave)
            grid[Math.floor(point.y / TILE)]![Math.floor(point.x / TILE)] = 1
          }
      }
    }
  return grid
}
