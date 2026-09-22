// Shared, resolution-independent character artwork for the arena and field guide.
// Silhouettes fit a 24px corridor; accessories extend beyond the collision body.
export type DemonKind = 'ravager' | 'watcher' | 'lurker'

export function drawPickup(
  ctx: CanvasRenderingContext2D,
  kind: 'shield' | 'life',
  time = 0,
  effects = true,
) {
  ctx.save()
  shadow(ctx)
  if (effects) ctx.translate(0, Math.sin(time * 3) * 1.5)
  ctx.shadowColor = kind === 'shield' ? '#79dfff' : '#ff91b4'
  ctx.shadowBlur = effects ? 9 : 0
  if (kind === 'shield') {
    shape(
      ctx,
      'M0-10 9-6 8 3Q6 8 0 11Q-6 8-8 3L-9-6Z',
      gradient(ctx, '#a4edff', '#267ab1'),
      '#d4f8ff',
    )
    shape(ctx, 'M0-6 5-4 4 3 0 7-4 3-5-4Z', '#17465f', '#79dfff')
    shape(ctx, 'M-1-4H1V4H-1Z', '#b9f5ff', '#b9f5ff')
  } else {
    shape(
      ctx,
      'M0 10-8 2Q-13-4-8-8Q-3-11 0-5Q3-11 8-8Q13-4 8 2Z',
      gradient(ctx, '#ffc0d5', '#c74471'),
      '#ffe0eb',
    )
    shape(ctx, 'M-1-4H1V-1H4V1H1V4H-1V1H-4V-1H-1Z', '#fff4f8', '#fff4f8')
  }
  ctx.restore()
}

const shapes = new Map<string, Path2D>()
function shape(
  ctx: CanvasRenderingContext2D,
  path: string,
  fill: string | CanvasGradient,
  stroke = '#10191f',
) {
  let geometry = shapes.get(path)
  if (!geometry) {
    geometry = new Path2D(path)
    shapes.set(path, geometry)
  }
  ctx.fillStyle = fill
  ctx.strokeStyle = stroke
  ctx.lineWidth = 0.8
  ctx.lineJoin = 'round'
  ctx.fill(geometry)
  ctx.stroke(geometry)
}

function gradient(ctx: CanvasRenderingContext2D, top: string, bottom: string) {
  const paint = ctx.createLinearGradient(-5, -10, 7, 12)
  paint.addColorStop(0, top)
  paint.addColorStop(1, bottom)
  return paint
}

function shadow(ctx: CanvasRenderingContext2D) {
  ctx.fillStyle = '#00000065'
  ctx.beginPath()
  ctx.ellipse(0, 10, 10, 3, 0, 0, Math.PI * 2)
  ctx.fill()
}

export function drawPortal(ctx: CanvasRenderingContext2D, time = 0, effects = true) {
  ctx.save()
  const pulse = effects ? 0.85 + Math.sin(time * 3) * 0.15 : 1
  ctx.fillStyle = '#00000080'
  ctx.beginPath()
  ctx.ellipse(0, 12, 15, 4, 0, 0, Math.PI * 2)
  ctx.fill()
  // An obsidian arch surrounds the rift; its forked crown echoes the demons' horns.
  shape(ctx, 'M-14 13-13-4-9-12 0-16 9-12 13-4 14 13Z', gradient(ctx, '#69717a', '#26222e'))
  shape(
    ctx,
    'M-10-8-14-14-13-19-9-14-5-12ZM10-8 14-14 13-19 9-14 5-12Z',
    gradient(ctx, '#a29a98', '#46414d'),
  )
  ctx.save()
  ctx.shadowColor = '#ff582e'
  ctx.shadowBlur = effects ? 12 * pulse : 0
  const fire = ctx.createLinearGradient(0, -12, 0, 12)
  fire.addColorStop(0, '#96213c')
  fire.addColorStop(0.55, '#f34b29')
  fire.addColorStop(1, '#ffd781')
  shape(ctx, 'M-9 11V-3Q-8-10 0-12Q8-10 9-3V11Z', fire, '#ffaf67')
  ctx.restore()
  shape(ctx, 'M-6 10-7-2Q-6-8 0-10Q6-8 7-2L6 10Z', '#260e23', '#9f2a38')
  // Layered flame tongues leave a dark opening, so the portal reads as a gateway.
  ctx.save()
  ctx.translate(0, 11)
  ctx.scale(1, pulse)
  shape(ctx, 'M-8 0-8-10Q-6-8-5-3Q-2-7-3-12Q2-9 1-4Q5-6 6-11L8 0Z', '#ff6836', '#ff9d52')
  shape(ctx, 'M-5 0Q-5-5-3-6L-2-2 1-7 2-2 5-4 5 0Z', '#ffe3a1', '#ffbf69')
  ctx.restore()
  shape(ctx, 'M-15 12H15L16 15H-16Z', '#49414b', '#847078')
  shape(ctx, 'M-3-14 0-17 3-14 0-11Z', '#ffbf70', '#ec6d42')
  ctx.strokeStyle = '#ffb36c'
  ctx.lineWidth = 0.9
  for (const side of [-1, 1]) {
    ctx.save()
    ctx.scale(side, 1)
    ctx.beginPath()
    ctx.moveTo(10, -5)
    ctx.lineTo(12, -3)
    ctx.lineTo(10, -1)
    ctx.moveTo(11, 3)
    ctx.lineTo(11, 8)
    ctx.moveTo(10, 5)
    ctx.lineTo(12, 5)
    ctx.stroke()
    ctx.restore()
  }
  if (effects) {
    ctx.fillStyle = '#ffcf83'
    for (let i = 0; i < 3; i++) {
      const rise = (time * 5 + i * 4) % 13
      ctx.globalAlpha = (1 - rise / 13) * 0.8
      ctx.fillRect(Math.sin(i * 3 + time) * 5, 5 - rise, 0.8, 1.4)
    }
  }
  ctx.restore()
}

export function drawHunter(
  ctx: CanvasRenderingContext2D,
  angle: number,
  stride = 0,
  effects = true,
) {
  ctx.save()
  shadow(ctx)
  // Broad combat armor over a charcoal undersuit, with separate armored boots.
  shape(ctx, 'M-6-5H6L7 5 4 8H-4L-7 5Z', '#202c30')
  for (const side of [-1, 1]) {
    ctx.save()
    ctx.translate(side * 3.5, side * stride)
    shape(ctx, 'M-2.5 4H2.5V9H-2.5Z', '#364546')
    shape(ctx, 'M-2.5 5H2.5V8L0 9-2.5 8Z', '#789b62')
    shape(ctx, 'M-2.5 9H2.5L3 12H-3V10Z', gradient(ctx, '#67767a', '#293339'))
    ctx.fillStyle = '#9da9a8'
    ctx.fillRect(-2, 10, 4, 0.8)
    ctx.restore()
  }
  shape(ctx, 'M-7-5-10-3-10 3-7 5-5 2V-3ZM7-5 10-3 10 3 7 5 5 2V-3Z', '#3d5546')
  shape(ctx, 'M-6-6-11-4-10 0-6 1-4-3ZM6-6 11-4 10 0 6 1 4-3Z', gradient(ctx, '#a1c882', '#50743f'))
  shape(ctx, 'M-6-5H6L7 1 4 5H-4L-7 1Z', gradient(ctx, '#92bc76', '#456938'))
  shape(ctx, 'M-5-3-1-2V2L-4 1ZM5-3 1-2V2L4 1Z', '#b0d591')
  shape(ctx, 'M-3 3H3V5H-3Z', '#283738')
  shape(ctx, 'M-6 5H6V7H-6Z', '#20292d')
  shape(ctx, 'M-5 4H-2V7H-5ZM2 4H5V7H2Z', '#718261')
  shape(ctx, 'M-1 5H1V7H-1Z', '#abb6aa')
  // A sealed military helmet: squared shell, wide dark visor, and respirator.
  shape(ctx, 'M-6-7-5-11-3-13H3L5-11 6-7 5-2H-5Z', gradient(ctx, '#a6b6aa', '#596e66'))
  shape(ctx, 'M-4-11-2-13H2L4-11V-9H-4Z', '#80a569')
  shape(ctx, 'M-5-8H5L4-4H-4Z', '#14272e', '#b7c6b6')
  ctx.save()
  ctx.shadowColor = '#91efbd'
  ctx.shadowBlur = effects ? 2 : 0
  shape(ctx, 'M-4-7H4L3.5-5.5H-3.5Z', '#9cdeb5', '#38594c')
  ctx.restore()
  shape(ctx, 'M-3-3-2-5H2L3-3 2-1H-2Z', '#879894')
  ctx.fillStyle = '#28383d'
  ctx.fillRect(-1.5, -3.5, 3, 1)
  // A bulky rifle turns with aim: stock, receiver, magazine, vented barrel, muzzle.
  ctx.save()
  ctx.translate(0, 1)
  ctx.rotate(angle)
  shape(ctx, 'M-4 1-2 4 7 4 9 1 6 0 4 2 0 1Z', '#6c9156')
  shape(ctx, 'M0-2H4V2H0L-2 3V-3Z', '#354148')
  shape(ctx, 'M3-3H10L12-2V2H3Z', gradient(ctx, '#8a979b', '#354249'))
  shape(ctx, 'M5 2H8L7 6H4Z', '#28333b')
  shape(ctx, 'M10-2H15V1.5H10Z', '#59676b')
  shape(ctx, 'M14-2.5H16.5V2H14Z', '#303a40', '#8e9b9d')
  shape(ctx, 'M5-4H8V-3H5Z', '#202b31')
  ctx.fillStyle = '#18272c'
  ctx.fillRect(10.5, -1.5, 1, 2)
  ctx.fillRect(12.3, -1.5, 1, 2)
  ctx.fillStyle = '#9caeaa'
  ctx.fillRect(7, 0, 2, 1)
  shape(ctx, 'M2 1H5V3H2Z', '#40544b')
  ctx.restore()
  ctx.restore()
}

// A quick armor malfunction: recoil, a shower of plates, then a bouncing helmet.
export function drawHunterDeath(
  ctx: CanvasRenderingContext2D,
  progress: number,
  angle: number,
  effects = true,
) {
  const p = Math.max(0, Math.min(1, progress))
  ctx.save()
  if (!effects) {
    ctx.globalAlpha *= 1 - p * 0.65
    ctx.translate(0, 6 * Math.min(1, p * 3))
    ctx.rotate((Math.min(1, p * 3) * Math.PI) / 2)
    drawHunter(ctx, angle, 0, false)
    ctx.restore()
    return
  }
  if (p < 0.28) {
    const recoil = p / 0.28
    ctx.translate(-Math.cos(angle) * recoil * 7, -Math.sin(angle) * recoil * 7)
    ctx.rotate(Math.sin(recoil * Math.PI) * 0.35)
    ctx.scale(1 + recoil * 0.2, 1 - recoil * 0.18)
    drawHunter(ctx, angle, 0, false)
  } else {
    const flight = (p - 0.28) / 0.72
    // Deterministic arcs keep rendering stable while paused or at different frame rates.
    for (let i = 0; i < 9; i++) {
      const direction = (i * Math.PI * 2) / 9
      const radius = (18 + (i % 3) * 7) * Math.min(1, flight * 2)
      ctx.save()
      ctx.translate(
        Math.cos(direction) * radius,
        10 + Math.sin(direction) * radius * 0.35 - Math.sin(flight * Math.PI) * (15 + (i % 3) * 8),
      )
      ctx.rotate(direction + flight * (i % 2 ? 5 : -5))
      ctx.globalAlpha *= 1 - Math.max(0, flight - 0.7) * 2
      shape(ctx, 'M-3-2H3L2 2H-2Z', i % 2 ? '#92bc76' : '#899da3')
      ctx.restore()
    }
    // Helmet springs free, lands, and gives one small final bounce.
    const bounce =
      flight < 0.7
        ? Math.sin((flight / 0.7) * Math.PI) * 35
        : Math.sin(((flight - 0.7) / 0.3) * Math.PI) * 7
    ctx.save()
    ctx.translate(flight * 12, 5 - bounce)
    ctx.rotate(Math.sin(flight * Math.PI) * 1.5)
    shape(ctx, 'M-6 0-5-5-3-7H3L5-5 6 0 5 5H-5Z', gradient(ctx, '#a6b6aa', '#596e66'))
    shape(ctx, 'M-4-5-2-7H2L4-5V-3H-4Z', '#80a569')
    shape(ctx, 'M-5-2H5L4 2H-4Z', '#14272e', '#b7c6b6')
    shape(ctx, 'M-4-1H4L3 0.5H-3Z', '#9cdeb5')
    ctx.restore()
    if (flight > 0.65) {
      ctx.fillStyle = '#ffd782'
      for (let i = 0; i < 3; i++) {
        const orbit = flight * 7 + (i * Math.PI * 2) / 3
        ctx.save()
        ctx.translate(12 + Math.cos(orbit) * 13, -10 + Math.sin(orbit) * 4)
        shape(ctx, 'M0-3 1-1 3 0 1 1 0 3-1 1-3 0-1-1Z', '#ffd782', '#dba25c')
        ctx.restore()
      }
    }
  }
  ctx.restore()
}

export function drawDemon(
  ctx: CanvasRenderingContext2D,
  stride = 0,
  charging = false,
  armored = false,
  effects = true,
  kind: DemonKind = 'ravager',
) {
  if (kind === 'watcher') return drawWatcher(ctx, stride, charging, armored, effects)
  if (kind === 'lurker') return drawLurker(ctx, stride, charging, armored, effects)
  ctx.save()
  shadow(ctx)
  // A barbed tail, digitigrade legs, and bone claws make the silhouette monstrous.
  shape(ctx, 'M5 6Q14 9 10 1L8 3 10-2 13 2 11 2Q16 12 5 9Z', '#ae4548')
  for (const side of [-1, 1]) {
    ctx.save()
    ctx.scale(side, 1)
    ctx.translate(0, side * stride)
    shape(ctx, 'M2 3H6L7 7 5 9 7 11H2L3 7Z', '#87313c')
    shape(ctx, 'M2 9 5 9 7 11H2Z', '#d9b49c')
    ctx.restore()
  }
  shape(
    ctx,
    'M-5-5-9-3-11 3-8 6-6 2-4 1H4L6 2 8 6 11 3 9-3 5-5Z',
    gradient(ctx, '#f5886b', '#8c283e'),
  )
  shape(ctx, 'M-10 2-12 6-10 5-9 7-8 3ZM10 2 12 6 10 5 9 7 8 3Z', '#eac6a5')
  shape(
    ctx,
    'M-5-3 0-1 5-3 4 4 0 7-4 4Z',
    gradient(ctx, armored ? '#717b87' : '#dc6557', armored ? '#252433' : '#842737'),
  )
  shape(ctx, 'M-1-1 1-1 2 2 0 4-2 2Z', charging ? '#fff0ad' : '#ffac69', '#a44142')
  shape(
    ctx,
    'M-6-7-9-9-9-14Q-6-12-6-10L-3-8ZM6-7 9-9 9-14Q6-12 6-10L3-8Z',
    gradient(ctx, '#ffe3b6', '#aa7969'),
  )
  shape(ctx, 'M-6-8-3-10H3L6-8 5-3 2 0H-2L-5-3Z', gradient(ctx, '#ed9276', '#b73b43'))
  shape(ctx, 'M-5-7-1-5-4-4ZM5-7 1-5 4-4Z', '#3b1929')
  ctx.save()
  ctx.shadowColor = '#ffb94f'
  ctx.shadowBlur = effects ? (charging ? 9 : 3) : 0
  shape(ctx, 'M-4.5-6-1.5-5-4-4.5ZM4.5-6 1.5-5 4-4.5Z', charging ? '#fffbd4' : '#ffd184', '#ffb45c')
  ctx.restore()
  shape(ctx, 'M-3-2.5 0-2 3-2.5 2-0.5H-2Z', '#401c29')
  ctx.fillStyle = '#ffe4bf'
  ctx.fillRect(-2, -2.5, 1, 1.5)
  ctx.fillRect(1, -2.5, 1, 1.5)
  ctx.restore()
}

function drawWatcher(
  ctx: CanvasRenderingContext2D,
  stride: number,
  charging: boolean,
  armored: boolean,
  effects: boolean,
) {
  ctx.save()
  shadow(ctx)
  // A violet, single-eyed demon with swept horns and a split, winglike mantle.
  shape(
    ctx,
    'M-4-6-11-10-10-2-13 5-7 3-5 8H5L7 3 13 5 10-2 11-10 4-6Z',
    gradient(ctx, '#a18ae8', '#492967'),
  )
  for (const side of [-1, 1]) {
    ctx.save()
    ctx.scale(side, 1)
    ctx.translate(0, side * stride)
    shape(ctx, 'M1 3H5L6 11 3 9 1 12Z', '#b298dd')
    ctx.restore()
  }
  shape(ctx, 'M-5-3H5L4 5 0 9-4 5Z', gradient(ctx, armored ? '#9294b2' : '#a782dc', '#46345f'))
  shape(ctx, 'M-4-7-10-12-11-16-7-12-2-10ZM4-7 10-12 11-16 7-12 2-10Z', '#d9cafa')
  shape(ctx, 'M-6-8Q0-13 6-8L5-2 0 2-5-2Z', gradient(ctx, '#c5a4f4', '#7552a2'))
  ctx.save()
  ctx.shadowColor = '#dfb4ff'
  ctx.shadowBlur = effects ? (charging ? 9 : 3) : 0
  shape(ctx, 'M-5-6Q0-11 5-6Q0-1-5-6Z', charging ? '#ffffff' : '#f1deff', '#422651')
  shape(ctx, 'M0-9 1.5-6 0-3-1.5-6Z', '#522070')
  ctx.restore()
  shape(ctx, 'M-2-1H2L0 2Z', '#261b36')
  ctx.restore()
}

function drawLurker(
  ctx: CanvasRenderingContext2D,
  stride: number,
  charging: boolean,
  armored: boolean,
  effects: boolean,
) {
  ctx.save()
  shadow(ctx)
  // A squat amber beetle demon: six hooked legs, a spiked shell, and wide tusks.
  for (const side of [-1, 1]) {
    ctx.save()
    ctx.scale(side, 1)
    ctx.translate(0, side * stride)
    shape(ctx, 'M4-4 10-6 12-2 8-3 5 0ZM5 0 12 2 13 6 9 4 5 4ZM4 5 9 8 8 12 5 9 2 8Z', '#d7aa56')
    ctx.restore()
  }
  shape(
    ctx,
    'M-7-4-5-8 0-11 5-8 7-4 8 5 4 10H-4L-8 5Z',
    gradient(ctx, armored ? '#b6a581' : '#e5b34f', '#765024'),
  )
  shape(ctx, 'M0-10 2-4 1 8H-1L-2-4Z', '#f5d890')
  shape(ctx, 'M-6-5-8-11-4-8ZM6-5 8-11 4-8Z', '#fff0bc')
  shape(ctx, 'M-6-5-3-7H3L6-5 5 1 2 4H-2L-5 1Z', '#a67932')
  ctx.save()
  ctx.shadowColor = '#ffd86a'
  ctx.shadowBlur = effects ? (charging ? 9 : 3) : 0
  shape(ctx, 'M-5-4-1-3-4-1ZM5-4 1-3 4-1Z', charging ? '#ffffff' : '#fff3a6', '#624019')
  ctx.restore()
  shape(ctx, 'M-5 0-7 4-3 3-2 1ZM5 0 7 4 3 3 2 1Z', '#fff0bc')
  ctx.restore()
}
