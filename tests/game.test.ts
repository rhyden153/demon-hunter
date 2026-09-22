import { test } from 'node:test'
import assert from 'node:assert/strict'
import { demonsGame } from '../app/utils/game.ts'
import {
  COLS,
  ROWS,
  TILE,
  WIDTH,
  HEIGHT,
  WORLD_WIDTH,
  WORLD_HEIGHT,
  wrap,
  wrappedDelta,
} from '../app/utils/maze.ts'

function tick(game: demonsGame, seconds: number) {
  for (let i = 0; i < seconds * 60; i++) game.update(1 / 60)
}

test('all floors and spawned entities are reachable in early and later waves', () => {
  const game = new demonsGame()
  for (let wave = 1; wave <= 8; wave++) {
    game.wave = wave
    game.buildWave()
    const seen = new Set<string>(),
      queue = [[Math.floor(game.player.x / TILE), Math.floor(game.player.y / TILE)]]
    for (let i = 0; i < queue.length; i++) {
      const [x, y] = queue[i]!
      if (seen.has(`${x},${y}`)) continue
      seen.add(`${x},${y}`)
      for (const [dx, dy] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ]) {
        const nx = wrap(x! + dx!, COLS),
          ny = wrap(y! + dy!, ROWS)
        if (game.grid[ny]![nx] === 0 && !seen.has(`${nx},${ny}`)) queue.push([nx, ny])
      }
    }
    for (let y = 0; y < ROWS; y++)
      for (let x = 0; x < COLS; x++) {
        if (!game.grid[y]![x])
          assert.ok(seen.has(`${x},${y}`), `Unreachable floor at ${x},${y}, wave ${wave}`)
      }
    for (const entity of [...game.portals, ...game.enemies, game.player])
      assert.ok(game.canMove(entity.x, entity.y), `Entity in a wall at wave ${wave}`)
  }
})

test('movement, diagonal normalization, and dash obey walls', () => {
  const straight = new demonsGame()
  straight.start()
  straight.enemies = []
  straight.portals = []
  straight.portals.push({ x: 36, y: 36, hp: 7, timer: 100 })
  const x = straight.player.x,
    y = straight.player.y
  straight.keys.add('d')
  tick(straight, 0.1)
  const distance = straight.player.x - x
  const diagonal = new demonsGame()
  diagonal.start()
  diagonal.keys.add('w')
  diagonal.keys.add('d')
  tick(diagonal, 0.1)
  assert.ok(Math.abs(Math.hypot(diagonal.player.x - x, diagonal.player.y - y) - distance) < 0.01)
  straight.player.x = 19 * TILE
  straight.player.y = 11.5 * TILE
  straight.keys.add('shift')
  tick(straight, 0.1)
  assert.ok(straight.player.x < 20 * TILE - 6, 'Dash must stop before the wall')
  assert.ok(straight.dashCooldown > 2)
  assert.ok(straight.canMove(straight.player.x, straight.player.y))
})

test('shooting destroys a portal, awards points, and clears a wave', () => {
  const game = new demonsGame()
  game.start()
  game.enemies = []
  game.portals = [{ x: game.player.x + 30, y: game.player.y, hp: 7, timer: 100 }]
  game.keys.add('arrowright')
  tick(game, 1.5)
  assert.equal(game.portals.length, 0)
  assert.equal(game.status, 'cleared')
  assert.equal(game.score, 750)
  tick(game, 3)
  assert.equal(game.wave, 2)
  assert.equal(game.status, 'playing')
  assert.equal(game.portals.length, 5)
})

test('bullets cannot damage enemies through walls', () => {
  const game = new demonsGame()
  game.start()
  game.player.x = 19 * TILE
  game.player.y = 11.5 * TILE
  game.enemies = [
    { x: 21.5 * TILE, y: game.player.y, hp: 1, speed: 0, id: 1, phase: 0, fireCooldown: 1000 },
  ]
  game.keys.add('arrowright')
  tick(game, 1)
  assert.equal(game.kills, 0)
  assert.equal(game.enemies.length, 1)
})

test('enemy kills award points, and contact respects temporary invulnerability', () => {
  const game = new demonsGame()
  game.start()
  game.enemies = [
    {
      x: game.player.x + 28,
      y: game.player.y,
      hp: 1,
      speed: 0,
      id: 1,
      phase: 0,
      fireCooldown: 1000,
    },
  ]
  game.keys.add('arrowright')
  tick(game, 0.1)
  assert.equal(game.score, 50)
  assert.equal(game.kills, 1)
  game.keys.clear()
  game.player.invulnerable = 0
  game.enemies.push({
    x: game.player.x,
    y: game.player.y,
    hp: 1,
    speed: 0,
    id: 2,
    phase: 0,
    fireCooldown: 1000,
  })
  tick(game, 0.1)
  assert.equal(game.lives, 2)
  tick(game, 1)
  assert.equal(game.lives, 2)
  tick(game, 5)
  assert.equal(game.status, 'over')
  assert.equal(game.lives, 0)
})

test('enemies navigate the maze to a stationary player', () => {
  const game = new demonsGame()
  game.start()
  game.player.invulnerable = 100
  game.enemies = game.portals
    .slice(0, 2)
    .map((portal, id) => ({ ...enemyAt(portal.x, portal.y), id, speed: 43 }))
  for (const portal of game.portals) portal.timer = 1000
  // Portals now spawn at random points, so an enemy can start far from the player;
  // give pathfinding enough simulated time to cross the maze in the worst case.
  tick(game, 110)
  assert.equal(game.enemies.length, 2)
  for (const enemy of game.enemies)
    assert.ok(
      Math.hypot(
        wrappedDelta(enemy.x - game.player.x, WORLD_WIDTH),
        wrappedDelta(enemy.y - game.player.y, WORLD_HEIGHT),
      ) < 20,
      `Enemy ${enemy.id} stuck at ${enemy.x},${enemy.y}`,
    )
})

test('pausing freezes combat and the wave transition; restart resets the run', () => {
  const game = new demonsGame()
  game.start()
  game.keys.add('w')
  game.togglePause()
  const snapshot = game.snapshot(),
    y = game.player.y
  tick(game, 4)
  assert.deepEqual(game.snapshot(), snapshot)
  assert.equal(game.player.y, y)
  game.togglePause()
  game.enemies = []
  game.portals = []
  tick(game, 0.1)
  assert.equal(game.status, 'cleared')
  game.togglePause()
  tick(game, 4)
  assert.equal(game.wave, 1)
  game.togglePause()
  tick(game, 3)
  assert.equal(game.wave, 2)
  game.start()
  assert.equal(game.score, 0)
  assert.equal(game.wave, 1)
  assert.equal(game.lives, 3)
  assert.equal(game.elapsed, 0)
})

function openWorld() {
  const game = new demonsGame()
  game.start()
  game.grid = Array.from({ length: ROWS }, () => Array<number>(COLS).fill(0))
  game.player = { x: 120, y: 180, angle: 0, invulnerable: 0 }
  game.enemies = []
  game.portals = [{ x: WORLD_WIDTH - 100, y: WORLD_HEIGHT - 100, hp: 7, timer: 1000 }]
  return game
}

function enemyAt(x: number, y: number, fireCooldown = 1000) {
  return { x, y, hp: 1, speed: 0, id: 1, phase: 0, fireCooldown }
}

test('world is nine viewports with open edges and portals beyond the starting view', () => {
  const game = new demonsGame()
  assert.equal(WORLD_WIDTH, WIDTH * 3)
  assert.equal(WORLD_HEIGHT, HEIGHT * 3)
  assert.ok(game.grid[0]!.every((cell) => cell === 0))
  assert.ok(game.grid[ROWS - 1]!.every((cell) => cell === 0))
  assert.ok(game.grid.every((row) => row[0] === 0 && row[COLS - 1] === 0))
  assert.ok(
    game.portals.some((n) => Math.abs(wrappedDelta(n.x - game.player.x, WORLD_WIDTH)) > WIDTH / 2),
  )
})

test('movement wraps across all four edges, diagonal corners, and during a dash', () => {
  for (const [key, axis, size, position, expected] of [
    ['d', 'x', WORLD_WIDTH, WORLD_WIDTH - 2, 4],
    ['a', 'x', WORLD_WIDTH, 2, WORLD_WIDTH - 4],
    ['s', 'y', WORLD_HEIGHT, WORLD_HEIGHT - 2, 4],
    ['w', 'y', WORLD_HEIGHT, 2, WORLD_HEIGHT - 4],
  ] as const) {
    const game = openWorld()
    game.player[axis] = position
    game.keys.add(key)
    game.update(0.04)
    assert.ok(Math.abs(game.player[axis] - expected) < 0.001, `${key} should wrap within ${size}`)
  }
  const game = openWorld()
  game.player.x = 2
  game.player.y = 2
  game.keys.add('a')
  game.keys.add('w')
  game.update(0.04)
  assert.ok(game.player.x > WORLD_WIDTH - 5 && game.player.y > WORLD_HEIGHT - 5)
  game.keys.clear()
  game.player.x = WORLD_WIDTH - 20
  game.keys.add('d')
  game.keys.add('shift')
  game.update(1 / 60)
  assert.ok(game.player.x > 70 && game.player.x < 75)
})

test('walls across a wrapped boundary still block the player and dash', () => {
  const game = openWorld()
  game.player.x = WORLD_WIDTH - 12
  game.player.y = 12.5 * TILE
  game.grid[12]![0] = 1
  game.keys.add('d')
  game.keys.add('shift')
  tick(game, 0.2)
  assert.ok(game.player.x < WORLD_WIDTH - 6 && game.player.x > WORLD_WIDTH - 12)
  assert.ok(game.canMove(game.player.x, game.player.y))
})

test('camera and mouse aim remain continuous across the world seams', () => {
  const game = openWorld()
  game.player.x = WORLD_WIDTH - 1
  game.player.y = WORLD_HEIGHT - 1
  assert.deepEqual(game.worldToScreen(game.player), { x: WIDTH / 2, y: HEIGHT / 2 })
  const before = game.worldToScreen({ x: 20, y: 20 })
  game.player.x = 1
  game.player.y = 1
  const after = game.worldToScreen({ x: 20, y: 20 })
  assert.equal(after.x - before.x, -2)
  assert.equal(after.y - before.y, -2)
  game.pointer = { x: WIDTH / 2 + 100, y: HEIGHT / 2 }
  game.firing = true
  game.update(0.04)
  assert.equal(game.player.angle, 0)
  assert.ok(game.bullets[0]!.vx > 0)
  assert.equal(game.bullets[0]!.vy, 0)
})

test('both kinds of projectiles wrap horizontally and vertically', () => {
  for (const owner of ['player', 'enemy'] as const) {
    const game = openWorld()
    game.bullets = [
      { x: WORLD_WIDTH - 1, y: WORLD_HEIGHT - 1, vx: 200, vy: 200, ttl: 4, owner, bounces: 0 },
    ]
    game.update(0.04)
    assert.ok(Math.abs(game.bullets[0]!.x - 7) < 0.001)
    assert.ok(Math.abs(game.bullets[0]!.y - 7) < 0.001)
    assert.equal(game.bullets[0]!.bounces, 0)
  }
})

test('ricochets reflect the struck wall face and preserve the tangent velocity', () => {
  for (const axis of ['x', 'y'] as const) {
    const game = openWorld()
    game.grid[axis === 'x' ? 5 : 8]![axis === 'x' ? 8 : 5] = 1
    const bullet = {
      x: axis === 'x' ? 185 : 132,
      y: axis === 'x' ? 132 : 185,
      vx: axis === 'x' ? 100 : 40,
      vy: axis === 'x' ? 40 : 100,
      ttl: 4,
      owner: 'player' as const,
      bounces: 0,
    }
    game.bullets = [bullet]
    tick(game, 0.15)
    assert.equal(bullet.bounces, 1)
    assert.equal(axis === 'x' ? bullet.vx : bullet.vy, -100)
    assert.equal(axis === 'x' ? bullet.vy : bullet.vx, 40)
    assert.ok(!game.wallAt(bullet.x, bullet.y))
  }
})

test('shots reflect at convex and concave corners without tunneling or sticking', () => {
  for (const concave of [false, true]) {
    const game = openWorld()
    if (concave) {
      game.grid[7]![8] = 1
      game.grid[8]![7] = 1
    } else game.grid[8]![8] = 1
    const bullet = {
      x: 190,
      y: 190,
      vx: 100,
      vy: 100,
      ttl: 4,
      owner: 'player' as const,
      bounces: 0,
    }
    game.bullets = [bullet]
    game.update(0.04)
    assert.equal(bullet.vx, -100)
    assert.equal(bullet.vy, -100)
    assert.equal(bullet.bounces, 1)
    assert.ok(bullet.x < 190 && bullet.y < 190)
  }
})

test('a diagonal bank shot kills an enemy behind a corner obstruction', () => {
  const game = openWorld()
  game.grid[7]![7] = 1 // Direct fire from (120,180) to (240,180) is blocked.
  for (let x = 4; x <= 12; x++) game.grid[4]![x] = 1 // Bank off the ceiling.
  game.enemies = [enemyAt(240, 180)]
  const bullet = { x: 120, y: 180, vx: 140, vy: -140, ttl: 4, owner: 'player' as const, bounces: 0 }
  game.bullets = [bullet]
  tick(game, 0.95)
  assert.equal(bullet.bounces, 1)
  assert.equal(game.kills, 1)
  assert.equal(game.score, 50)
})

test('straight shots aimed into an adjacent wall stop instead of spawning through it', () => {
  const game = openWorld()
  game.player.x = 160
  game.player.y = 180
  game.grid[7]![7] = 1
  game.keys.add('arrowright')
  tick(game, 0.08)
  assert.equal(game.bullets.length, 0)
  assert.equal(game.lives, 3)
})

test('ricochets and enemy shots respect walls across the world seam', () => {
  for (const owner of ['player', 'enemy'] as const) {
    const game = openWorld()
    game.grid[12]![0] = 1
    const bullet = {
      x: WORLD_WIDTH - 2,
      y: 12.5 * TILE,
      vx: 200,
      vy: 100,
      ttl: 4,
      owner,
      bounces: 0,
    }
    game.bullets = [bullet]
    game.update(0.04)
    if (owner === 'player') {
      assert.ok(bullet.vx < 0)
      assert.ok(bullet.x > WORLD_WIDTH - 12)
    } else assert.equal(game.bullets.length, 0)
  }
})

test('demons fire aimed shots that can damage the hunter but cannot shoot through cover', () => {
  const game = openWorld()
  game.enemies = [enemyAt(240, 180, 0)]
  game.update(0.04)
  assert.equal(game.bullets[0]!.owner, 'enemy')
  assert.ok(game.bullets[0]!.vx < 0)
  assert.ok(Math.abs(game.bullets[0]!.vy) < 0.001)
  tick(game, 0.8)
  assert.equal(game.lives, 2)
  const covered = openWorld()
  covered.enemies = [enemyAt(240, 180, 0)]
  covered.grid[7]![7] = 1
  tick(covered, 1)
  assert.equal(covered.bullets.length, 0)
  assert.equal(covered.lives, 3)
})

test('enemy aiming, line of sight, hits, and pathfinding use the short route across a seam', () => {
  const game = openWorld()
  game.player.x = 2
  game.player.y = 300
  game.enemies = [enemyAt(WORLD_WIDTH - 100, 300, 0)]
  game.update(0.04)
  assert.ok(game.bullets[0]!.vx > 0)
  tick(game, 0.7)
  assert.equal(game.lives, 2)
  const covered = openWorld()
  covered.player.x = 36
  covered.player.y = 300
  covered.enemies = [enemyAt(WORLD_WIDTH - 36, 300, 0)]
  covered.grid[12]![0] = 1
  tick(covered, 0.5)
  assert.equal(covered.bullets.length, 0)
  const chase = openWorld()
  chase.player.x = 36
  chase.player.y = 300
  chase.player.invulnerable = 100
  chase.enemies = [{ ...enemyAt(WORLD_WIDTH - 60, 300), speed: 50 }]
  tick(chase, 3)
  assert.ok(Math.abs(wrappedDelta(chase.enemies[0]!.x - chase.player.x, WORLD_WIDTH)) < 10)
})

test('enemy projectiles are absorbed during invulnerability and own ricochets are harmless', () => {
  const game = openWorld()
  game.player.invulnerable = 1
  for (const owner of ['player', 'enemy'] as const)
    game.bullets.push({ x: 110, y: 180, vx: 100, vy: 0, ttl: 3, owner, bounces: 1 })
  tick(game, 0.2)
  assert.equal(game.lives, 3)
  assert.equal(game.bullets.length, 1)
  assert.equal(game.bullets[0]!.owner, 'player')
})

test('projectile lifetimes expire shots, and ricochets are not bounce-limited', () => {
  const game = openWorld()
  game.bullets = [{ x: 120, y: 120, vx: 100, vy: 0, ttl: 0.02, owner: 'player', bounces: 0 }]
  game.update(0.04)
  assert.equal(game.bullets.length, 0)
  game.grid[5]![8] = 1
  game.bullets = [{ x: 190, y: 132, vx: 100, vy: 40, ttl: 4, owner: 'player', bounces: 7 }]
  game.update(0.04)
  assert.equal(game.bullets.length, 1)
  assert.equal(game.bullets[0]!.bounces, 8)
})

test('pause freezes enemy fire and projectiles; wave transitions remove old shots', () => {
  const game = openWorld()
  game.enemies = [enemyAt(240, 180, 0)]
  game.update(0.04)
  const bullets = structuredClone(game.bullets),
    cooldown = game.enemies[0]!.fireCooldown
  game.togglePause()
  tick(game, 3)
  assert.deepEqual(game.bullets, bullets)
  assert.equal(game.enemies[0]!.fireCooldown, cooldown)
  game.togglePause()
  game.enemies = []
  game.portals = []
  game.update(0.01)
  tick(game, 2.6)
  assert.equal(game.wave, 2)
  assert.equal(game.bullets.length, 0)
})

test('all four cardinal shots are absorbed, including trigonometric rounding on vertical shots', () => {
  for (const [key, x, y] of [
    ['arrowright', 160, 180],
    ['arrowleft', 200, 180],
    ['arrowup', 180, 200],
    ['arrowdown', 180, 160],
  ] as const) {
    const game = openWorld()
    game.player.x = x
    game.player.y = y
    game.grid[7]![7] = 1
    game.keys.add(key)
    let reflections = 0
    game.onSound = (type) => {
      if (type === 'bounce') reflections++
    }
    tick(game, 0.08)
    assert.equal(game.bullets.length, 0, `${key} should stop at the wall`)
    assert.equal(reflections, 0)
  }
  const game = openWorld()
  game.player.x = 160
  game.grid[7]![7] = 1
  game.pointer = { x: WIDTH / 2 + 100, y: HEIGHT / 2 + 1e-10 }
  game.firing = true
  tick(game, 0.08)
  assert.equal(game.bullets.length, 0, 'Nearly axis-aligned mouse aim should also stop')
})

test('ready screen and each wave start empty, with a quiet opening and staggered arrivals', () => {
  const game = new demonsGame()
  assert.equal(game.snapshot().enemies, 0)
  tick(game, 20)
  assert.equal(game.enemies.length, 0)
  game.start()
  assert.equal(game.snapshot().enemies, 0)
  game.player.invulnerable = 1000
  tick(game, 5.9)
  assert.equal(game.enemies.length, 0)
  tick(game, 0.2)
  assert.equal(game.enemies.length, 1)
  tick(game, 3)
  assert.equal(game.enemies.length, 2)
  for (const enemy of game.enemies) assert.ok(game.canMove(enemy.x, enemy.y, 6))
  game.enemies = []
  game.portals = []
  game.update(0.01)
  tick(game, 2.6)
  assert.equal(game.wave, 2)
  assert.equal(game.snapshot().enemies, 0)
})

function arrivals(game: demonsGame, seconds: number) {
  let count = 0
  for (let i = 0; i < seconds * 60; i++) {
    game.update(1 / 60)
    count += game.enemies.length
    game.enemies = [] // Measure arrivals without filling the population cap.
  }
  return count
}

test('portals release progressively more demons during equal periods of active play', () => {
  const game = new demonsGame()
  game.start()
  game.player.invulnerable = 1000
  const early = arrivals(game, 30),
    middle = arrivals(game, 30),
    late = arrivals(game, 30)
  assert.ok(early > 0)
  assert.ok(middle > early, `Expected acceleration: ${early}, ${middle}, ${late}`)
  assert.ok(late > middle, `Expected acceleration: ${early}, ${middle}, ${late}`)
  game.start()
  assert.equal(game.enemies.length, 0)
  assert.equal(arrivals(game, 30), early, 'Restart must reset the spawn ramp')
})

test('pause freezes the spawn ramp and countdowns', () => {
  const game = new demonsGame()
  game.start()
  const control = new demonsGame()
  control.start()
  arrivals(game, 30)
  arrivals(control, 30)
  const timers = game.portals.map((n) => n.timer)
  game.togglePause()
  tick(game, 100)
  assert.deepEqual(
    game.portals.map((n) => n.timer),
    timers,
  )
  assert.equal(game.enemies.length, 0)
  game.togglePause()
  assert.equal(arrivals(game, 30), arrivals(control, 30))
})

test('Relentless mode and later waves accelerate arrivals without an initial swarm', () => {
  const classic = new demonsGame()
  classic.start()
  const hard = new demonsGame()
  hard.difficulty = 'hard'
  hard.start()
  const later = new demonsGame()
  later.start()
  later.wave = 5
  later.buildWave()
  assert.equal(hard.enemies.length, 0)
  assert.equal(later.enemies.length, 0)
  const baseline = arrivals(classic, 30)
  assert.ok(arrivals(hard, 30) > baseline)
  assert.ok(arrivals(later, 30) > baseline)
})

test('accelerating spawns remain capped and destroyed portals stop producing demons', () => {
  const game = new demonsGame()
  game.start()
  game.player.invulnerable = 1000
  tick(game, 120)
  assert.equal(game.status, 'playing')
  assert.equal(game.enemies.length, 65)
  game.enemies.pop()
  for (const portal of game.portals) portal.timer = 0
  game.update(0.04)
  assert.equal(game.enemies.length, 65)
  game.portals = []
  const count = game.enemies.length
  tick(game, 10)
  assert.equal(game.enemies.length, count)
})
