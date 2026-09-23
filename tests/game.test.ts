import { test } from 'node:test'
import assert from 'node:assert/strict'
import { demonsGame, DEATH_DURATION } from '../app/utils/game.ts'
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
  createMaze,
  MAZE_COUNT,
} from '../app/utils/maze.ts'

function tick(game: demonsGame, seconds: number) {
  for (let i = 0; i < seconds * 60; i++) game.update(1 / 60)
}

test('the last hit plays death once, freezes combat, then ends the run', () => {
  for (const attack of ['contact', 'shot']) {
    const game = openWorld()
    game.lives = 1
    game.score = 150
    game.enemies = [enemyAt(game.player.x + (attack === 'contact' ? 0 : 80), game.player.y)]
    if (attack === 'shot')
      game.bullets = [{ ...game.player, vx: 0, vy: 0, ttl: 1, owner: 'enemy' }]
    const sounds: string[] = []
    game.onSound = (sound) => sounds.push(sound)
    game.update(0.01)
    assert.equal(game.lives, 0)
    assert.equal(game.status, 'dying')
    assert.equal(game.deathElapsed, 0)
    assert.equal(game.bullets.length, 0)
    const position = { ...game.player }
    const portalTimer = game.portals[0]!.timer
    const elapsed = game.elapsed
    game.keys.add('arrowright')
    game.firing = true
    tick(game, DEATH_DURATION / 2)
    assert.equal(game.status, 'dying')
    assert.deepEqual(game.player, position)
    assert.equal(game.portals[0]!.timer, portalTimer)
    assert.equal(game.elapsed, elapsed)
    assert.equal(game.score, 150)
    assert.equal(game.bullets.length, 0)
    tick(game, DEATH_DURATION)
    assert.equal(game.status, 'over')
    assert.equal(game.deathElapsed, DEATH_DURATION)
    assert.deepEqual(sounds, ['death'])
    game.start()
    assert.equal(game.status, 'playing')
    assert.equal(game.deathElapsed, 0)
    assert.equal(game.lives, 3)
    assert.equal(game.firing, false)
  }
})

test('death animation pauses and completes with visual effects disabled', () => {
  const game = openWorld()
  game.effects = false
  game.lives = 1
  game.enemies = [enemyAt(game.player.x, game.player.y)]
  game.update(0.01)
  tick(game, 0.3)
  const elapsed = game.deathElapsed
  game.togglePause()
  tick(game, 3)
  assert.equal(game.deathElapsed, elapsed)
  assert.equal(game.status, 'paused')
  game.togglePause()
  assert.equal(game.status, 'dying')
  tick(game, DEATH_DURATION)
  assert.equal(game.status, 'over')
})

test('all six mazes have reachable floors and safe spawns in early and later waves', (t) => {
  const game = new demonsGame()
  for (let mazeIndex = 0; mazeIndex < MAZE_COUNT; mazeIndex++) {
    t.mock.method(Math, 'random', () => (mazeIndex + 0.5) / MAZE_COUNT)
    for (const wave of [1, 6]) {
      game.wave = wave
      game.buildWave()
      assert.equal(game.mazeIndex, mazeIndex)
      assert.equal(game.grid.length, ROWS)
      assert.ok(game.grid.every((row) => row.length === COLS))
      assert.ok(game.grid[0]!.every((cell) => cell === 0))
      assert.ok(game.grid[ROWS - 1]!.every((cell) => cell === 0))
      assert.ok(game.grid.every((row) => row[0] === 0 && row[COLS - 1] === 0))
      assert.equal(game.portals.length, Math.min(3 + wave, 6))
      assert.equal(game.pickups.length, wave === 6 ? 2 : 0)
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
            assert.ok(
              seen.has(`${x},${y}`),
              `Unreachable floor at ${x},${y}, maze ${mazeIndex}, wave ${wave}`,
            )
        }
      for (const entity of [...game.portals, ...game.pickups, ...game.enemies, game.player]) {
        assert.ok(game.canMove(entity.x, entity.y), `Entity in a wall at wave ${wave}`)
        assert.ok(seen.has(`${Math.floor(entity.x / TILE)},${Math.floor(entity.y / TILE)}`))
      }
    }
    t.mock.restoreAll()
  }
})

test('the maze pool has six distinct fixed layouts and returns independent grids', () => {
  assert.equal(MAZE_COUNT, 6)
  const signatures = new Set<string>()
  for (let index = 0; index < MAZE_COUNT; index++) {
    const grid = createMaze(index)
    const signature = JSON.stringify(grid)
    signatures.add(signature)
    grid[0]![0] = 1
    assert.equal(
      JSON.stringify(createMaze(index)),
      signature,
      'Game mutations must not alter a stored layout',
    )
  }
  assert.equal(signatures.size, 6)
})

test('each wave and restart selects a maze randomly rather than cycling by wave number', (t) => {
  const game = new demonsGame()
  const choices = [5, 0, 3, 3, 1, 4, 2]
  for (const mazeIndex of choices) {
    t.mock.method(Math, 'random', () => (mazeIndex + 0.5) / MAZE_COUNT)
    game.enemies = []
    game.portals = []
    game.status = 'playing'
    game.update(0.01)
    assert.equal(game.status, 'cleared')
    tick(game, 2.6)
    assert.equal(game.mazeIndex, mazeIndex)
    assert.deepEqual(game.grid, createMaze(mazeIndex))
    game.start()
    assert.equal(game.mazeIndex, mazeIndex)
    assert.equal(game.wave, 1)
    t.mock.restoreAll()
  }
})

test('movement, diagonal normalization, and dash obey walls', () => {
  const straight = openWorld()
  straight.enemies = []
  straight.portals = []
  straight.portals.push({ x: 36, y: 36, hp: 7, timer: 100 })
  const x = straight.player.x,
    y = straight.player.y
  straight.keys.add('arrowright')
  tick(straight, 0.1)
  const distance = straight.player.x - x
  const diagonal = openWorld()
  diagonal.keys.add('arrowup')
  diagonal.keys.add('arrowright')
  tick(diagonal, 0.1)
  assert.ok(Math.abs(Math.hypot(diagonal.player.x - x, diagonal.player.y - y) - distance) < 0.01)
  straight.player.x = 19 * TILE
  straight.player.y = 11.5 * TILE
  straight.grid[11]![20] = 1
  straight.keys.add('shift')
  tick(straight, 0.1)
  assert.ok(straight.player.x < 20 * TILE - 6, 'Dash must stop before the wall')
  assert.ok(straight.dashCooldown > 2)
  assert.ok(straight.canMove(straight.player.x, straight.player.y))
})

test('shooting destroys a portal, awards points, and clears a wave', () => {
  const game = openWorld()
  game.enemies = []
  game.portals = [{ x: game.player.x + 30, y: game.player.y, hp: 7, timer: 100 }]
  game.keys.add('d')
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
  const game = openWorld()
  game.player.x = 19 * TILE
  game.player.y = 11.5 * TILE
  game.grid[11]![20] = 1
  game.enemies = [enemyAt(21.5 * TILE, game.player.y)]
  game.keys.add('d')
  tick(game, 1)
  assert.equal(game.kills, 0)
  assert.equal(game.enemies.length, 1)
})

test('enemy kills award points, and contact respects temporary invulnerability', () => {
  const game = openWorld()
  game.player.invulnerable = 2
  game.enemies = [enemyAt(game.player.x + 28, game.player.y)]
  game.keys.add('d')
  tick(game, 0.1)
  assert.equal(game.score, 50)
  assert.equal(game.kills, 1)
  game.keys.clear()
  game.player.invulnerable = 0
  game.enemies.push({
    ...enemyAt(game.player.x, game.player.y),
    id: 2,
  })
  tick(game, 0.1)
  assert.equal(game.lives, 2)
  tick(game, 1)
  assert.equal(game.lives, 2)
  tick(game, 5)
  assert.equal(game.status, 'over')
  assert.equal(game.lives, 0)
})

test('enemies navigate all six mazes to a stationary player', (t) => {
  for (let mazeIndex = 0; mazeIndex < MAZE_COUNT; mazeIndex++) {
    t.mock.method(Math, 'random', () => (mazeIndex + 0.5) / MAZE_COUNT)
    const game = new demonsGame()
    game.start()
    t.mock.restoreAll()
    game.player.invulnerable = 1000
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
  }
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

function enemyAt(x: number, y: number, fireCooldown = 1000): demonsGame['enemies'][number] {
  return {
    x,
    y,
    hp: 1,
    speed: 0,
    id: 1,
    phase: 0,
    fireCooldown,
    kind: 'ravager',
    aggressive: true,
    wanderTarget: null,
  }
}

test('portals spawn one of each demon per three arrivals, with equal combat stats', () => {
  const game = openWorld()
  game.player.invulnerable = 1000
  for (const difficulty of ['normal', 'hard'] as const) {
    game.difficulty = difficulty
    for (const wave of [1, 5]) {
      game.wave = wave
      game.buildWave()
      const counts = { ravager: 0, watcher: 0, lurker: 0 }
      for (let i = 0; i < 30; i++) {
        for (const portal of game.portals) portal.timer = 1000
        game.portals[i % game.portals.length]!.timer = 0
        game.update(1 / 60)
        assert.equal(game.enemies.length, 1)
        const enemy = game.enemies[0]!
        counts[enemy.kind]++
        assert.equal(enemy.hp, wave > 3 ? 2 : 1)
        assert.equal(enemy.speed, (39 + wave * 4) * (difficulty === 'hard' ? 1.3 : 1))
        assert.ok(Math.max(...Object.values(counts)) - Math.min(...Object.values(counts)) <= 1)
        game.enemies = []
      }
      assert.deepEqual(counts, { ravager: 10, watcher: 10, lurker: 10 })
    }
  }
})

test('watchers wander without shooting behind cover, then remain hostile after sight is lost', () => {
  const game = openWorld()
  const enemy = enemyAt(240, 180, 0)
  Object.assign(enemy, { kind: 'watcher', aggressive: false, speed: 43 })
  game.enemies = [enemy]
  game.grid[7]![7] = 1
  game.update(0.04)
  assert.equal(enemy.aggressive, false)
  assert.ok(enemy.x !== 240 || enemy.y !== 180, 'An idle watcher should wander')
  assert.equal(game.bullets.length, 0)
  game.grid[7]![7] = 0
  game.update(0.04)
  assert.equal(enemy.aggressive, true)
  assert.equal(game.bullets[0]!.owner, 'enemy')
  game.grid[7]![7] = 1
  game.bullets = []
  enemy.fireCooldown = 0
  const before = { x: enemy.x, y: enemy.y }
  game.update(0.04)
  assert.equal(enemy.aggressive, true, 'First sighting permanently activates a watcher')
  assert.ok(enemy.x !== before.x || enemy.y !== before.y, 'It keeps chasing through cover')
  assert.equal(game.bullets.length, 0, 'Cover still blocks its shots')
})

test('lurkers activate at seven squares, chase beyond that range, and reset behind cover', () => {
  const game = openWorld()
  const enemy = enemyAt(game.player.x + 7 * TILE + 1, game.player.y, 0)
  Object.assign(enemy, { kind: 'lurker', aggressive: false })
  game.enemies = [enemy]
  game.update(0.04)
  assert.equal(enemy.aggressive, false)
  assert.equal(game.bullets.length, 0, 'Sight alone outside seven squares must not trigger fire')
  enemy.x--
  game.update(0.04)
  assert.equal(enemy.aggressive, true, 'The seven-square boundary is inclusive')
  assert.equal(game.bullets[0]!.owner, 'enemy')
  enemy.x += TILE
  game.update(0.04)
  assert.equal(enemy.aggressive, true, 'Range does not end an active chase')
  game.grid[7]![7] = 1
  game.bullets = []
  enemy.fireCooldown = 0
  game.update(0.04)
  assert.equal(enemy.aggressive, false)
  assert.equal(game.bullets.length, 0)
  game.grid[7]![7] = 0
  game.update(0.04)
  assert.equal(enemy.aggressive, false, 'Sight regained outside the radius must not reactivate')
  enemy.x -= TILE
  game.grid[7]![7] = 1
  game.update(0.04)
  assert.equal(enemy.aggressive, false, 'A wall prevents activation even within range')
  game.grid[7]![7] = 0
  game.update(0.04)
  assert.equal(enemy.aggressive, true, 'A lurker can reactivate on a later encounter')
})

test('lurker proximity uses radial distance and the shortest route across either world seam', () => {
  for (const axis of ['x', 'y'] as const) {
    const game = openWorld()
    game.player[axis] = 12
    const enemy = enemyAt(game.player.x, game.player.y)
    const size = axis === 'x' ? WORLD_WIDTH : WORLD_HEIGHT
    enemy[axis] = size - (7 * TILE - 12)
    Object.assign(enemy, { kind: 'lurker', aggressive: false })
    game.enemies = [enemy]
    game.update(0.04)
    assert.equal(enemy.aggressive, true)
    const gx = axis === 'x' ? COLS - 2 : Math.floor(game.player.x / TILE)
    const gy = axis === 'y' ? ROWS - 2 : Math.floor(game.player.y / TILE)
    game.grid[gy]![gx] = 1
    game.update(0.04)
    assert.equal(enemy.aggressive, false, 'Walls across the seam break sight')
  }
  const game = openWorld()
  const enemy = enemyAt(game.player.x + 5 * TILE, game.player.y + 5 * TILE, 0)
  Object.assign(enemy, { kind: 'lurker', aggressive: false })
  game.enemies = [enemy]
  game.update(0.04)
  assert.equal(enemy.aggressive, false, 'A diagonal distance over seven tiles stays outside')
  enemy.y -= TILE
  game.update(0.04)
  assert.equal(enemy.aggressive, true)
})

test('wandering follows random open corridors, turns at dead ends, and wraps without hitting walls', (t) => {
  // A one-tile corridor crossing the seam with a dead end at either end.
  for (const kind of ['watcher', 'lurker'] as const) {
    const game = openWorld()
    game.grid = Array.from({ length: ROWS }, () => Array<number>(COLS).fill(1))
    game.player = { x: 20.5 * TILE, y: 20.5 * TILE, angle: 0, invulnerable: 1000 }
    game.grid[20]![20] = 0
    for (const x of [COLS - 2, COLS - 1, 0, 1]) game.grid[10]![x] = 0
    const enemy = enemyAt(WORLD_WIDTH - TILE / 2, 10.5 * TILE, 0)
    Object.assign(enemy, { kind, aggressive: false, speed: 43 })
    game.enemies = [enemy]
    let crossed = false
    let reachedEnd = false
    let returned = false
    t.mock.method(Math, 'random', () => (reachedEnd ? 0.999 : 0))
    for (let i = 0; i < 180; i++) {
      game.update(1 / 60)
      assert.ok(game.canMove(enemy.x, enemy.y, 6))
      assert.equal(enemy.aggressive, false)
      assert.equal(game.bullets.length, 0)
      if (enemy.x < TILE * 2) crossed = true
      if (Math.abs(enemy.x - 1.5 * TILE) < 0.01) reachedEnd = true
      if (crossed && enemy.x > WORLD_WIDTH - TILE * 2) returned = true
    }
    assert.ok(
      crossed && reachedEnd && returned,
      'Wanderer must cross the seam and turn back at a dead end',
    )
    t.mock.restoreAll()
  }
})

test('awakened demons use the original chase movement and projectile stats', () => {
  const results = []
  for (const kind of ['ravager', 'watcher', 'lurker'] as const) {
    const game = openWorld()
    const enemy = enemyAt(240, 180, 0)
    Object.assign(enemy, { kind, aggressive: kind === 'ravager', speed: 43 })
    game.enemies = [enemy]
    game.update(0.04)
    assert.equal(enemy.aggressive, true)
    results.push({ x: enemy.x, y: enemy.y, bullets: game.bullets })
  }
  assert.deepEqual(results[1], results[0])
  assert.deepEqual(results[2], results[0])
})

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
    ['arrowright', 'x', WORLD_WIDTH, WORLD_WIDTH - 2, 4],
    ['arrowleft', 'x', WORLD_WIDTH, 2, WORLD_WIDTH - 4],
    ['arrowdown', 'y', WORLD_HEIGHT, WORLD_HEIGHT - 2, 4],
    ['arrowup', 'y', WORLD_HEIGHT, 2, WORLD_HEIGHT - 4],
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
  game.keys.add('arrowleft')
  game.keys.add('arrowup')
  game.update(0.04)
  assert.ok(game.player.x > WORLD_WIDTH - 5 && game.player.y > WORLD_HEIGHT - 5)
  game.keys.clear()
  game.player.x = WORLD_WIDTH - 20
  game.keys.add('arrowright')
  game.keys.add('shift')
  game.update(1 / 60)
  assert.ok(game.player.x > 70 && game.player.x < 75)
})

test('walls across a wrapped boundary still block the player and dash', () => {
  const game = openWorld()
  game.player.x = WORLD_WIDTH - 12
  game.player.y = 12.5 * TILE
  game.grid[12]![0] = 1
  game.keys.add('arrowright')
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
      { x: WORLD_WIDTH - 1, y: WORLD_HEIGHT - 1, vx: 200, vy: 200, ttl: 4, owner },
    ]
    game.update(0.04)
    assert.ok(Math.abs(game.bullets[0]!.x - 7) < 0.001)
    assert.ok(Math.abs(game.bullets[0]!.y - 7) < 0.001)
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
    }
    game.bullets = [bullet]
    tick(game, 0.15)
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
    }
    game.bullets = [bullet]
    game.update(0.04)
    assert.equal(bullet.vx, -100)
    assert.equal(bullet.vy, -100)
    assert.ok(bullet.x < 190 && bullet.y < 190)
  }
})

test('a diagonal bank shot kills an enemy behind a corner obstruction', () => {
  const game = openWorld()
  game.grid[7]![7] = 1 // Direct fire from (120,180) to (240,180) is blocked.
  for (let x = 4; x <= 12; x++) game.grid[4]![x] = 1 // Bank off the ceiling.
  game.enemies = [enemyAt(240, 180)]
  const bullet = { x: 120, y: 180, vx: 140, vy: -140, ttl: 4, owner: 'player' as const }
  game.bullets = [bullet]
  tick(game, 0.95)
  assert.equal(game.kills, 1)
  assert.equal(game.score, 50)
})

test('straight shots aimed into an adjacent wall stop instead of spawning through it', () => {
  const game = openWorld()
  game.player.x = 160
  game.player.y = 180
  game.grid[7]![7] = 1
  game.keys.add('d')
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
    game.bullets.push({ x: 110, y: 180, vx: 100, vy: 0, ttl: 3, owner })
  tick(game, 0.2)
  assert.equal(game.lives, 3)
  assert.equal(game.bullets.length, 1)
  assert.equal(game.bullets[0]!.owner, 'player')
})

test('projectile lifetimes expire shots; player shots have no bounce limit', () => {
  const game = openWorld()
  game.bullets = [{ x: 120, y: 120, vx: 100, vy: 0, ttl: 0.02, owner: 'player' }]
  game.update(0.04)
  assert.equal(game.bullets.length, 0)
  game.grid[5]![8] = 1
  game.bullets = [{ x: 190, y: 132, vx: 100, vy: 40, ttl: 4, owner: 'player' }]
  game.update(0.04)
  assert.equal(game.bullets.length, 1)
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
    ['d', 160, 180],
    ['a', 200, 180],
    ['w', 180, 200],
    ['s', 180, 160],
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

test('one shield spawns after wave three and one extra life after wave four, away from portals', () => {
  const game = new demonsGame()
  for (let wave = 1; wave <= 10; wave++) {
    game.wave = wave
    game.buildWave()
    assert.deepEqual(
      game.pickups.map((pickup) => pickup.kind),
      wave > 4 ? ['shield', 'life'] : wave > 3 ? ['shield'] : [],
    )
    for (const pickup of game.pickups) {
      for (const other of [
        game.player,
        ...game.portals,
        ...game.pickups.filter((p) => p !== pickup),
      ]) {
        const distance = Math.hypot(
          wrappedDelta(pickup.x - other.x, WORLD_WIDTH),
          wrappedDelta(pickup.y - other.y, WORLD_HEIGHT),
        )
        assert.ok(
          distance >= 2 * TILE,
          'Pickups must not overlap the player, portals, or each other',
        )
      }
    }
  }
})

test('shield absorbs exactly three hits from every demon type and from enemy shots', () => {
  for (const kind of ['ravager', 'watcher', 'lurker'] as const) {
    for (const attack of ['contact', 'shot'] as const) {
      const game = openWorld()
      game.pickups = [{ ...game.player, kind: 'shield' }]
      game.update(0.01)
      assert.equal(game.shield, 3)
      assert.equal(game.pickups.length, 0)
      for (let hit = 1; hit <= 4; hit++) {
        game.player.invulnerable = 0
        if (attack === 'contact') {
          game.enemies = [{ ...enemyAt(game.player.x, game.player.y), kind }]
        } else {
          game.bullets = [{ ...game.player, vx: 0, vy: 0, ttl: 1, owner: 'enemy' }]
        }
        game.update(0.01)
        assert.equal(game.shield, Math.max(0, 3 - hit))
        assert.equal(game.snapshot().shield, game.shield)
        assert.equal(game.lives, hit <= 3 ? 3 : 2)
        assert.ok(game.player.invulnerable > 0)
        game.update(0.01)
        assert.equal(
          game.shield,
          Math.max(0, 3 - hit),
          'Invulnerability must prevent repeated charge loss',
        )
      }
    }
  }
})

test('shield protection persists across waves, refills without stacking, and resets on restart', () => {
  const game = openWorld()
  game.shield = 1
  game.pickups = [{ ...game.player, kind: 'shield' }]
  game.update(0.01)
  assert.equal(game.shield, 3)
  game.shield = 2
  game.portals = []
  game.update(0.01)
  assert.equal(game.status, 'cleared')
  tick(game, 3)
  assert.equal(game.wave, 2)
  assert.equal(game.shield, 2)
  game.start()
  assert.equal(game.shield, 0)
  assert.deepEqual(game.pickups, [])
})

test('extra-life pickups add exactly one life, including above three, and survive a wave clear', () => {
  for (const lives of [1, 3, 4]) {
    const game = openWorld()
    game.lives = lives
    game.pickups = [{ ...game.player, kind: 'life' }]
    game.update(0.01)
    assert.equal(game.lives, lives + 1)
    assert.equal(game.pickups.length, 0)
    game.update(0.01)
    assert.equal(game.lives, lives + 1)
    game.portals = []
    game.update(0.01)
    assert.equal(game.lives, Math.max(3, lives + 1), 'Wave rewards must not remove extra lives')
    tick(game, 3)
    assert.equal(game.lives, Math.max(3, lives + 1))
    game.start()
    assert.equal(game.lives, 3)
  }
})

test('pickups respect pause, walls, world wrapping, and collection along a dash', () => {
  const game = openWorld()
  game.pickups = [{ ...game.player, kind: 'shield' }]
  game.togglePause()
  game.update(0.04)
  assert.equal(game.shield, 0)
  assert.equal(game.pickups.length, 1)
  game.togglePause()
  game.update(0.04)
  assert.equal(game.shield, 3)
  game.shield = 0
  game.player.x = WORLD_WIDTH - 5
  game.pickups = [{ x: 5, y: game.player.y, kind: 'shield' }]
  game.grid[Math.floor(game.player.y / TILE)]![0] = 1
  game.update(0.01)
  assert.equal(game.shield, 0, 'Cannot collect through a wall at the seam')
  game.grid[Math.floor(game.player.y / TILE)]![0] = 0
  game.update(0.01)
  assert.equal(game.shield, 3)
  game.player.x = 120
  game.pickups = [{ x: 165, y: game.player.y, kind: 'life' }]
  game.keys.add('arrowright')
  game.keys.add('shift')
  game.update(0.04)
  assert.ok(game.player.x > 200)
  assert.equal(game.lives, 4, 'Dash must collect a pickup it passes over')
  assert.equal(game.pickups.length, 0)
})
