import { drawDemon, drawHunter, drawPortal } from './characters.ts'
import {
  COLS,
  ROWS,
  TILE,
  WIDTH,
  HEIGHT,
  WORLD_WIDTH,
  WORLD_HEIGHT,
  VIEW_COLS,
  VIEW_ROWS,
  wrap,
  wrappedDelta,
  createMaze,
} from './maze.ts'

export type GameStatus = 'ready' | 'playing' | 'paused' | 'over' | 'cleared'
export type Point = { x: number; y: number }
type Enemy = Point & { id: number; hp: number; speed: number; phase: number; fireCooldown: number }
type Portal = Point & { hp: number; timer: number }
type Bullet = Point & {
  vx: number
  vy: number
  ttl: number
  owner: 'player' | 'enemy'
  bounces: number
}
type Particle = Point & { vx: number; vy: number; ttl: number; max: number; color: string }
export type Snapshot = {
  status: GameStatus
  score: number
  wave: number
  lives: number
  enemies: number
  portals: number
  kills: number
  elapsed: number
  dash: number
  x: number
  y: number
}

export class demonsGame {
  status: GameStatus = 'ready'
  score = 0
  wave = 1
  lives = 3
  kills = 0
  elapsed = 0
  dashCooldown = 0
  player = { x: WORLD_WIDTH / 2, y: WORLD_HEIGHT / 2, angle: -Math.PI / 2, invulnerable: 0 }
  keys = new Set<string>()
  pointer: Point | null = null
  firing = false
  grid: number[][] = []
  enemies: Enemy[] = []
  portals: Portal[] = []
  bullets: Bullet[] = []
  particles: Particle[] = []
  difficulty: 'normal' | 'hard' = 'normal'
  effects = true
  onSound: (
    type: 'shoot' | 'hit' | 'portal' | 'hurt' | 'wave' | 'dash' | 'enemyShoot' | 'bounce',
  ) => void = () => {}
  private cooldown = 0
  private pathTimer = 0
  private distance: number[][] = []
  private clearTimer = 0
  private waveElapsed = 0
  private nextId = 0
  private pausedStatus: 'playing' | 'cleared' = 'playing'

  constructor() {
    this.buildWave()
  }

  snapshot(): Snapshot {
    return {
      status: this.status,
      score: this.score,
      wave: this.wave,
      lives: this.lives,
      enemies: this.enemies.length,
      portals: this.portals.length,
      kills: this.kills,
      elapsed: this.elapsed,
      dash: this.dashCooldown,
      x: Math.floor(this.player.x),
      y: Math.floor(this.player.y),
    }
  }

  start() {
    this.score = 0
    this.wave = 1
    this.lives = 3
    this.kills = 0
    this.elapsed = 0
    this.dashCooldown = 0
    this.keys.clear()
    this.firing = false
    this.buildWave()
    this.status = 'playing'
  }

  togglePause() {
    if (this.status === 'playing' || this.status === 'cleared') {
      this.pausedStatus = this.status
      this.status = 'paused'
    } else if (this.status === 'paused') this.status = this.pausedStatus
    this.keys.clear()
    this.firing = false
  }

  buildWave() {
    this.waveElapsed = 0
    this.grid = createMaze(this.wave)
    this.player = { x: WORLD_WIDTH / 2, y: WORLD_HEIGHT / 2, angle: -Math.PI / 2, invulnerable: 2 }
    this.bullets = []
    this.particles = []
    this.enemies = []
    this.portals = this.randomPortalLocations(Math.min(3 + this.wave, 6)).map((point, i) => ({
      ...point,
      hp: 6 + this.wave,
      timer: this.spawnInterval() / 2 + i * 3,
    }))
    this.cooldown = 0
    this.pathTimer = 0
    this.updatePaths()
  }

  private randomPortalLocations(count: number): Point[] {
    const sectors: [number, number][] = []
    for (let sy = 0; sy < 3; sy++) for (let sx = 0; sx < 3; sx++) sectors.push([sx, sy])
    for (let i = sectors.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[sectors[i], sectors[j]] = [sectors[j]!, sectors[i]!]
    }
    // Keep at least one portal off the player's starting screen.
    const farIndex = sectors.findIndex(([sx]) => sx !== 1)
    if (farIndex > 0) [sectors[0], sectors[farIndex]] = [sectors[farIndex]!, sectors[0]!]

    const points: Point[] = []
    for (const [sx, sy] of sectors) {
      if (points.length >= count) break
      const point = this.randomFloorTile(sx * VIEW_COLS, sy * VIEW_ROWS, VIEW_COLS, VIEW_ROWS)
      if (point) points.push(point)
    }
    let attempts = 0
    while (points.length < count && attempts < 400) {
      attempts++
      const point = this.randomFloorTile(0, 0, COLS, ROWS)
      if (point) points.push(point)
    }
    return points
  }

  private randomFloorTile(startX: number, startY: number, w: number, h: number): Point | null {
    const spawn = { x: WORLD_WIDTH / 2, y: WORLD_HEIGHT / 2 }
    for (let attempt = 0; attempt < 60; attempt++) {
      const gx = startX + Math.floor(Math.random() * w),
        gy = startY + Math.floor(Math.random() * h)
      if (this.grid[gy]?.[gx] !== 0) continue
      const point = { x: (gx + 0.5) * TILE, y: (gy + 0.5) * TILE }
      if (!this.canMove(point.x, point.y)) continue
      if (this.distanceTo(point, spawn) < TILE * 6) continue
      return point
    }
    return null
  }

  private spawnInterval() {
    // Start gently, then shorten the interval during active play. Later waves
    // and Relentless mode accelerate the ramp; the population cap still applies.
    return (
      Math.max(2, 12 - this.waveElapsed / 10 - (this.wave - 1) * 0.75) /
      (this.difficulty === 'hard' ? 1.3 : 1)
    )
  }

  private spawnEnemy(x: number, y: number) {
    if (this.enemies.length >= 65 || this.wallAt(x, y)) return
    this.enemies.push({
      x,
      y,
      id: this.nextId++,
      hp: this.wave > 3 ? 2 : 1,
      speed: (39 + this.wave * 4) * (this.difficulty === 'hard' ? 1.3 : 1),
      phase: Math.random() * 6.28,
      fireCooldown: 1.2 + Math.random() * 1.8,
    })
  }

  wallAt(x: number, y: number) {
    return this.grid[wrap(Math.floor(y / TILE), ROWS)]![wrap(Math.floor(x / TILE), COLS)] !== 0
  }

  worldToScreen(point: Point): Point {
    return {
      x: WIDTH / 2 + wrappedDelta(point.x - this.player.x, WORLD_WIDTH),
      y: HEIGHT / 2 + wrappedDelta(point.y - this.player.y, WORLD_HEIGHT),
    }
  }

  private distanceTo(a: Point, b: Point) {
    return Math.hypot(wrappedDelta(b.x - a.x, WORLD_WIDTH), wrappedDelta(b.y - a.y, WORLD_HEIGHT))
  }

  private lineOfSight(from: Point, to: Point) {
    const dx = wrappedDelta(to.x - from.x, WORLD_WIDTH),
      dy = wrappedDelta(to.y - from.y, WORLD_HEIGHT)
    const steps = Math.ceil(Math.hypot(dx, dy) / 4)
    for (let i = 1; i <= steps; i++)
      if (this.wallAt(from.x + (dx * i) / steps, from.y + (dy * i) / steps)) return false
    return true
  }

  canMove(x: number, y: number, r = 7) {
    return (
      !this.wallAt(x - r, y - r) &&
      !this.wallAt(x + r, y - r) &&
      !this.wallAt(x - r, y + r) &&
      !this.wallAt(x + r, y + r)
    )
  }

  private move(body: Point, dx: number, dy: number, radius = 7) {
    if (this.canMove(body.x + dx, body.y, radius)) body.x = wrap(body.x + dx, WORLD_WIDTH)
    if (this.canMove(body.x, body.y + dy, radius)) body.y = wrap(body.y + dy, WORLD_HEIGHT)
  }

  private updatePaths() {
    this.distance = Array.from({ length: ROWS }, () => Array(COLS).fill(999))
    const sx = Math.floor(this.player.x / TILE),
      sy = Math.floor(this.player.y / TILE)
    this.distance[sy]![sx] = 0
    const queue = [[sx, sy]]
    for (let i = 0; i < queue.length; i++) {
      const [x = 0, y = 0] = queue[i]!
      for (const [dx = 0, dy = 0] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ]) {
        const nx = wrap(x + dx, COLS),
          ny = wrap(y + dy, ROWS)
        if (this.grid[ny]?.[nx] === 0 && this.distance[ny]![nx] === 999) {
          this.distance[ny]![nx] = this.distance[y]![x]! + 1
          queue.push([nx, ny])
        }
      }
    }
  }

  private burst(x: number, y: number, color: string, count = 12) {
    if (!this.effects) return
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2,
        speed = 20 + Math.random() * 100,
        ttl = 0.2 + Math.random() * 0.45
      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        ttl,
        max: ttl,
        color,
      })
    }
  }

  update(dt: number) {
    dt = Math.min(dt, 0.04)
    if (this.status === 'cleared') {
      this.clearTimer -= dt
      if (this.clearTimer <= 0) {
        this.wave++
        this.buildWave()
        this.status = 'playing'
        this.onSound('wave')
      }
      return
    }
    if (this.status !== 'playing') return
    this.elapsed += dt
    this.waveElapsed += dt
    this.cooldown -= dt
    this.dashCooldown = Math.max(0, this.dashCooldown - dt)
    this.player.invulnerable = Math.max(0, this.player.invulnerable - dt)
    let mx = Number(this.keys.has('arrowright')) - Number(this.keys.has('arrowleft'))
    let my = Number(this.keys.has('arrowdown')) - Number(this.keys.has('arrowup'))
    const length = Math.hypot(mx, my)
    if (length) {
      mx /= length
      my /= length
    }
    this.move(this.player, mx * 150 * dt, my * 150 * dt)
    if (this.keys.has('shift') && this.dashCooldown <= 0 && length) {
      for (let i = 0; i < 18; i++) {
        this.burst(this.player.x, this.player.y, '#91efbd', 1)
        this.move(this.player, mx * 5, my * 5)
      }
      this.dashCooldown = 3
      this.player.invulnerable = Math.max(this.player.invulnerable, 0.35)
      this.onSound('dash')
    }
    const ax = Number(this.keys.has('d')) - Number(this.keys.has('a'))
    const ay = Number(this.keys.has('s')) - Number(this.keys.has('w'))
    const keyAim = ax || ay ? Math.atan2(ay, ax) : null
    const pointerAim = this.pointer
      ? Math.atan2(this.pointer.y - HEIGHT / 2, this.pointer.x - WIDTH / 2)
      : null
    const isShooting = Boolean(ax || ay || this.firing || this.keys.has(' '))
    const aimAngle = keyAim ?? pointerAim
    // Gun points at the aim target only while shooting; otherwise it follows movement.
    if (isShooting && aimAngle !== null) this.player.angle = aimAngle
    else if (length) this.player.angle = Math.atan2(my, mx)
    if (isShooting && this.cooldown <= 0) {
      const angle = aimAngle ?? this.player.angle
      const vx = Math.cos(angle),
        vy = Math.sin(angle)
      this.bullets.push({
        x: this.player.x,
        y: this.player.y,
        vx: vx * 440,
        vy: vy * 440,
        ttl: 4,
        owner: 'player',
        bounces: 0,
      })
      this.cooldown = 0.15
      this.onSound('shoot')
    }
    for (const portal of this.portals) {
      portal.timer -= dt
      if (portal.timer <= 0) {
        this.spawnEnemy(portal.x, portal.y)
        portal.timer += this.spawnInterval()
      }
    }
    this.pathTimer -= dt
    if (this.pathTimer <= 0) {
      this.updatePaths()
      this.pathTimer = 0.3
    }
    for (const enemy of this.enemies) {
      const cx = Math.floor(enemy.x / TILE),
        cy = Math.floor(enemy.y / TILE)
      let tx = this.player.x,
        ty = this.player.y
      if (this.distanceTo(enemy, this.player) > TILE) {
        let best = this.distance[cy]?.[cx] ?? 999
        tx = (cx + 0.5) * TILE
        ty = (cy + 0.5) * TILE
        for (const [dx = 0, dy = 0] of [
          [1, 0],
          [0, 1],
          [-1, 0],
          [0, -1],
        ]) {
          const distance = this.distance[wrap(cy + dy, ROWS)]![wrap(cx + dx, COLS)]!
          if (distance < best) {
            best = distance
            tx = (cx + dx + 0.5) * TILE
            ty = (cy + dy + 0.5) * TILE
          }
        }
      }
      const dx = wrappedDelta(tx - enemy.x, WORLD_WIDTH),
        dy = wrappedDelta(ty - enemy.y, WORLD_HEIGHT),
        dist = Math.hypot(dx, dy)
      if (dist > 1)
        this.move(enemy, (dx / dist) * enemy.speed * dt, (dy / dist) * enemy.speed * dt, 6)
      const playerDistance = this.distanceTo(enemy, this.player)
      if (playerDistance < 17) this.damagePlayer()
      if (this.lives <= 0) return
      enemy.fireCooldown -= dt
      if (enemy.fireCooldown <= 0) {
        if (playerDistance < 420 && this.lineOfSight(enemy, this.player)) {
          const angle = Math.atan2(
            wrappedDelta(this.player.y - enemy.y, WORLD_HEIGHT),
            wrappedDelta(this.player.x - enemy.x, WORLD_WIDTH),
          )
          const speed = Math.min(270, 170 + this.wave * 8)
          this.bullets.push({
            x: enemy.x,
            y: enemy.y,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            ttl: 2.55, // 15% shorter range than before
            owner: 'enemy',
            bounces: 0,
          })
          enemy.fireCooldown = (2.3 + Math.random() * 0.9) / (this.difficulty === 'hard' ? 1.4 : 1)
          this.onSound('enemyShoot')
        } else enemy.fireCooldown = 0.2
      }
    }
    for (const bullet of this.bullets) {
      bullet.ttl -= dt
      // At most four pixels per step, even during a slow frame. Resolve the
      // struck face before moving so a bounce never places a shot inside a wall.
      const steps = Math.max(1, Math.ceil((Math.hypot(bullet.vx, bullet.vy) * dt) / 4))
      for (let step = 0; step < steps && bullet.ttl > 0; step++) {
        const nx = wrap(bullet.x + (bullet.vx * dt) / steps, WORLD_WIDTH)
        const ny = wrap(bullet.y + (bullet.vy * dt) / steps, WORLD_HEIGHT)
        if (this.wallAt(nx, ny) || (this.wallAt(nx, bullet.y) && this.wallAt(bullet.x, ny))) {
          // Trig leaves tiny nonzero components on cardinal shots (for example,
          // cos(PI / 2)). Treat those as straight shots, not diagonals.
          const diagonal = Math.abs(bullet.vx) > 1e-6 && Math.abs(bullet.vy) > 1e-6
          if (bullet.owner === 'enemy' || !diagonal) {
            bullet.ttl = 0
            this.burst(bullet.x, bullet.y, bullet.owner === 'enemy' ? '#f08965' : '#91efbd', 3)
            break
          }
          let hitX = this.wallAt(nx, bullet.y),
            hitY = this.wallAt(bullet.x, ny)
          if (!hitX && !hitY) {
            hitX = true
            hitY = true
          }
          if (hitX) bullet.vx *= -1
          else bullet.x = nx
          if (hitY) bullet.vy *= -1
          else bullet.y = ny
          bullet.bounces++
          this.burst(bullet.x, bullet.y, '#ceffe2', 4)
          if (this.distanceTo(this.player, bullet) < 420) this.onSound('bounce')
        } else {
          bullet.x = nx
          bullet.y = ny
        }
        if (bullet.owner === 'enemy') {
          if (this.distanceTo(bullet, this.player) < 11) {
            bullet.ttl = 0
            this.damagePlayer()
            if (this.lives <= 0) return
          }
          continue
        }
        const portal = this.portals.find((n) => n.hp > 0 && this.distanceTo(n, bullet) < 17)
        if (portal) {
          portal.hp--
          bullet.ttl = 0
          this.burst(bullet.x, bullet.y, '#ffad67', 5)
          if (portal.hp <= 0) {
            this.score += 250
            this.burst(portal.x, portal.y, '#ffad67', 32)
            this.onSound('portal')
          }
          break
        }
        const enemy = this.enemies.find((e) => e.hp > 0 && this.distanceTo(e, bullet) < 10)
        if (enemy) {
          enemy.hp--
          bullet.ttl = 0
          this.burst(enemy.x, enemy.y, '#ff835c')
          this.onSound('hit')
          if (enemy.hp <= 0) {
            this.score += 50
            this.kills++
          }
          break
        }
      }
    }
    this.portals = this.portals.filter((n) => n.hp > 0)
    this.enemies = this.enemies.filter((e) => e.hp > 0)
    this.bullets = this.bullets.filter((b) => b.ttl > 0)
    for (const p of this.particles) {
      p.x = wrap(p.x + p.vx * dt, WORLD_WIDTH)
      p.y = wrap(p.y + p.vy * dt, WORLD_HEIGHT)
      p.ttl -= dt
    }
    this.particles = this.particles.filter((p) => p.ttl > 0)
    if (!this.portals.length && !this.enemies.length) {
      this.score += 500
      this.lives = Math.min(3, this.lives + 1)
      this.status = 'cleared'
      this.clearTimer = 2.5
      this.onSound('wave')
    }
  }

  private damagePlayer() {
    if (this.player.invulnerable > 0 || this.status !== 'playing') return
    this.lives--
    this.player.invulnerable = 2.2
    this.burst(this.player.x, this.player.y, '#ff785a', 24)
    this.onSound('hurt')
    if (this.lives <= 0) {
      this.status = 'over'
      this.keys.clear()
      this.firing = false
    }
  }

  draw(ctx: CanvasRenderingContext2D, time: number) {
    ctx.clearRect(0, 0, WIDTH, HEIGHT)
    ctx.fillStyle = '#10171b'
    ctx.fillRect(0, 0, WIDTH, HEIGHT)
    const cameraX = this.player.x - WIDTH / 2,
      cameraY = this.player.y - HEIGHT / 2
    const startX = Math.floor(cameraX / TILE),
      startY = Math.floor(cameraY / TILE)
    // Render only visible tiles; raw cell coordinates continue across either seam.
    for (let gy = startY; gy <= startY + HEIGHT / TILE + 1; gy++) {
      for (let gx = startX; gx <= startX + WIDTH / TILE + 1; gx++) {
        const x = wrap(gx, COLS),
          y = wrap(gy, ROWS)
        const px = gx * TILE - cameraX,
          py = gy * TILE - cameraY
        ctx.strokeStyle = '#1b2429'
        ctx.lineWidth = 0.5
        ctx.strokeRect(px, py, TILE, TILE)
        if (!this.grid[y]![x]) {
          if (x % 4 === 2 && y % 4 === 2) {
            ctx.fillStyle = '#344047'
            ctx.fillRect(px - 2, py, 5, 1)
            ctx.fillRect(px, py - 2, 1, 5)
          }
          continue
        }
        ctx.fillStyle = '#27343c'
        ctx.fillRect(px, py, TILE, TILE)
        ctx.fillStyle = '#2e3e47'
        ctx.fillRect(px + 2, py + 2, TILE - 4, TILE - 4)
        ctx.strokeStyle = '#4b6069'
        ctx.lineWidth = 1
        ctx.beginPath()
        if (!this.grid[wrap(y - 1, ROWS)]![x]) {
          ctx.moveTo(px + 0.5, py + 0.5)
          ctx.lineTo(px + TILE - 0.5, py + 0.5)
        }
        if (!this.grid[y]![wrap(x - 1, COLS)]) {
          ctx.moveTo(px + 0.5, py + 0.5)
          ctx.lineTo(px + 0.5, py + TILE - 0.5)
        }
        ctx.stroke()
        ctx.strokeStyle = '#18242b'
        ctx.beginPath()
        if (!this.grid[wrap(y + 1, ROWS)]![x]) {
          ctx.moveTo(px, py + TILE - 0.5)
          ctx.lineTo(px + TILE, py + TILE - 0.5)
        }
        if (!this.grid[y]![wrap(x + 1, COLS)]) {
          ctx.moveTo(px + TILE - 0.5, py)
          ctx.lineTo(px + TILE - 0.5, py + TILE)
        }
        ctx.stroke()
      }
    }
    for (const worldPortal of this.portals) {
      const portal = { ...worldPortal, ...this.worldToScreen(worldPortal) }
      if (portal.x < -30 || portal.x > WIDTH + 30 || portal.y < -30 || portal.y > HEIGHT + 30)
        continue
      ctx.save()
      ctx.translate(portal.x, portal.y)
      drawPortal(ctx, time + worldPortal.x, this.effects)
      ctx.restore()
      ctx.fillStyle = '#42324c'
      ctx.fillRect(portal.x - 13, portal.y + 19, 26, 2)
      ctx.fillStyle = '#ffad67'
      ctx.fillRect(portal.x - 13, portal.y + 19, (26 * portal.hp) / (6 + this.wave), 2)
    }
    for (const worldEnemy of this.enemies) {
      const enemy = { ...worldEnemy, ...this.worldToScreen(worldEnemy) }
      if (enemy.x < -20 || enemy.x > WIDTH + 20 || enemy.y < -20 || enemy.y > HEIGHT + 20) continue
      ctx.save()
      ctx.translate(enemy.x, enemy.y)
      drawDemon(
        ctx,
        this.effects ? Math.sin(time * 9 + enemy.phase) * 1.2 : 0,
        enemy.fireCooldown < 0.35,
        enemy.hp > 1,
        this.effects,
      )
      ctx.restore()
    }
    ctx.save()
    ctx.translate(WIDTH / 2, HEIGHT / 2)
    if (this.status === 'playing' && this.player.invulnerable > 0 && Math.floor(time * 12) % 2)
      ctx.globalAlpha = 0.45
    const moving =
      this.status === 'playing' &&
      ['arrowup', 'arrowdown', 'arrowleft', 'arrowright'].some((key) => this.keys.has(key))
    drawHunter(
      ctx,
      this.player.angle,
      this.effects && moving ? Math.sin(time * 14) * 1.2 : 0,
      this.effects,
    )
    ctx.restore()
    if (this.status === 'ready') {
      ctx.fillStyle = '#a1b0aa'
      ctx.font = '9px monospace'
      ctx.textAlign = 'center'
      ctx.fillText('YOU', WIDTH / 2, HEIGHT / 2 + 33)
    }
    ctx.save()
    ctx.strokeStyle = '#ceffe2'
    ctx.lineWidth = 2
    ctx.shadowColor = '#91efbd'
    ctx.shadowBlur = this.effects ? 10 : 0
    for (const bullet of this.bullets) {
      const b = { ...bullet, ...this.worldToScreen(bullet) }
      ctx.strokeStyle = bullet.owner === 'enemy' ? '#ff946b' : '#ceffe2'
      ctx.shadowColor = bullet.owner === 'enemy' ? '#ff785a' : '#91efbd'
      ctx.lineWidth = bullet.owner === 'enemy' ? 3 : 2
      ctx.beginPath()
      ctx.moveTo(b.x, b.y)
      ctx.lineTo(b.x - b.vx * 0.017, b.y - b.vy * 0.017)
      ctx.stroke()
    }
    ctx.restore()
    for (const p of this.particles) {
      ctx.globalAlpha = p.ttl / p.max
      ctx.fillStyle = p.color
      const screen = this.worldToScreen(p)
      ctx.fillRect(screen.x - 1, screen.y - 1, 3, 3)
    }
    ctx.globalAlpha = 1
    const vignette = ctx.createRadialGradient(
      WIDTH / 2,
      HEIGHT / 2,
      HEIGHT * 0.3,
      WIDTH / 2,
      HEIGHT / 2,
      WIDTH * 0.65,
    )
    vignette.addColorStop(0, '#05090c00')
    vignette.addColorStop(1, '#05090c85')
    ctx.fillStyle = vignette
    ctx.fillRect(0, 0, WIDTH, HEIGHT)
  }
}
