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

type Wall = readonly [x: number, y: number, width: number, height: number]

// Six fixed layouts share open sector borders and a clear central spawn area.
// Every wall motif has an exit; no floor pockets are sealed off.
const layouts: readonly (readonly Wall[])[] = [
  [
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
  ],
  [
    // Switchbacks: staggered horizontal lanes with alternating hooked ends.
    [3, 3, 9, 1],
    [3, 3, 1, 4],
    [15, 2, 8, 1],
    [22, 2, 1, 5],
    [27, 3, 7, 1],
    [27, 3, 1, 4],
    [6, 7, 7, 1],
    [12, 7, 1, 5],
    [16, 6, 7, 1],
    [28, 8, 6, 1],
    [33, 8, 1, 4],
    [2, 11, 7, 1],
    [2, 11, 1, 4],
    [25, 11, 5, 1],
    [25, 11, 1, 4],
    [6, 15, 8, 1],
    [13, 15, 1, 5],
    [17, 16, 7, 1],
    [17, 16, 1, 4],
    [29, 15, 6, 1],
    [34, 15, 1, 5],
    [3, 20, 7, 1],
    [22, 20, 8, 1],
  ],
  [
    // Bastions: open U-shaped rooms with entrances facing different directions.
    [3, 3, 7, 1],
    [3, 3, 1, 5],
    [9, 3, 1, 5],
    [15, 2, 1, 5],
    [15, 6, 8, 1],
    [22, 2, 1, 5],
    [28, 3, 6, 1],
    [33, 3, 1, 5],
    [28, 7, 6, 1],
    [3, 11, 7, 1],
    [3, 11, 1, 5],
    [3, 15, 7, 1],
    [27, 10, 7, 1],
    [27, 10, 1, 5],
    [33, 10, 1, 5],
    [7, 18, 1, 4],
    [7, 21, 7, 1],
    [13, 18, 1, 4],
    [18, 16, 7, 1],
    [18, 16, 1, 5],
    [24, 16, 1, 5],
    [28, 18, 6, 1],
    [33, 18, 1, 4],
    [28, 21, 6, 1],
  ],
  [
    // Columns: vertical cover, offset crossbars, and broad connecting aisles.
    [3, 2, 1, 7],
    [7, 4, 1, 5],
    [11, 2, 1, 6],
    [15, 3, 1, 5],
    [19, 2, 1, 5],
    [23, 4, 1, 4],
    [28, 2, 1, 7],
    [32, 4, 1, 5],
    [3, 5, 3, 1],
    [19, 4, 3, 1],
    [4, 12, 1, 8],
    [8, 10, 1, 6],
    [12, 12, 1, 9],
    [4, 17, 3, 1],
    [8, 12, 3, 1],
    [17, 16, 1, 5],
    [21, 15, 1, 5],
    [17, 18, 3, 1],
    [26, 11, 1, 10],
    [30, 10, 1, 6],
    [34, 13, 1, 8],
    [26, 18, 3, 1],
    [30, 13, 3, 1],
  ],
  [
    // Crossroads: compact crosses and blocks create many short flanking routes.
    [3, 4, 7, 1],
    [6, 2, 1, 6],
    [15, 4, 8, 1],
    [18, 2, 1, 6],
    [27, 4, 7, 1],
    [30, 2, 1, 6],
    [3, 11, 7, 1],
    [6, 9, 1, 6],
    [27, 11, 7, 1],
    [30, 9, 1, 6],
    [3, 18, 7, 1],
    [6, 16, 1, 6],
    [15, 18, 8, 1],
    [18, 16, 1, 6],
    [27, 18, 7, 1],
    [30, 16, 1, 6],
    [12, 8, 2, 2],
    [23, 8, 2, 2],
    [12, 13, 2, 2],
    [23, 13, 2, 2],
  ],
  [
    // Hooks: opposing L-shaped cover and small islands form winding passages.
    [2, 2, 10, 1],
    [11, 2, 1, 6],
    [3, 6, 5, 1],
    [3, 6, 1, 3],
    [15, 2, 1, 5],
    [15, 6, 8, 1],
    [20, 2, 4, 1],
    [27, 2, 1, 6],
    [27, 7, 8, 1],
    [31, 3, 4, 1],
    [2, 11, 1, 5],
    [2, 15, 9, 1],
    [7, 10, 5, 1],
    [11, 10, 1, 3],
    [25, 10, 8, 1],
    [32, 10, 1, 5],
    [26, 13, 3, 2],
    [3, 18, 9, 1],
    [3, 18, 1, 4],
    [11, 20, 4, 1],
    [17, 16, 7, 1],
    [23, 16, 1, 6],
    [17, 19, 3, 2],
    [28, 17, 1, 5],
    [28, 21, 7, 1],
    [32, 17, 3, 1],
  ],
]

export const MAZE_COUNT = layouts.length

function sectorPoint(sx: number, sy: number, x: number, y: number) {
  return {
    x: (sx * VIEW_COLS + ((sx + sy) % 2 === 1 ? VIEW_COLS - x : x)) * TILE,
    y: (sy * VIEW_ROWS + y) * TILE,
  }
}

export function createMaze(layoutIndex: number) {
  const walls = layouts[layoutIndex]
  if (!walls) throw new RangeError(`Unknown maze layout: ${layoutIndex}`)
  const grid = Array.from({ length: ROWS }, () => Array<number>(COLS).fill(0))
  // No perimeter wall: the outer corridors connect to the opposite side.
  for (let sy = 0; sy < 3; sy++)
    for (let sx = 0; sx < 3; sx++) {
      for (const [x = 0, y = 0, w = 0, h = 0] of walls) {
        for (let yy = y; yy < y + h; yy++)
          for (let xx = x; xx < x + w; xx++) {
            const point = sectorPoint(sx, sy, xx + 0.5, yy + 0.5)
            grid[Math.floor(point.y / TILE)]![Math.floor(point.x / TILE)] = 1
          }
      }
    }
  return grid
}
