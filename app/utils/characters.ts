// Shared, resolution-independent character artwork for the arena and field guide.
// Silhouettes fit a 24px corridor; accessories extend beyond the collision body.
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
  // Split leather cloak, boots, and silver shoulder plates frame a human silhouette.
  shape(ctx, 'M-6-4 Q-10 3-9 11 L-3 9 0 5 3 10 9 12 Q9 3 6-4Z', gradient(ctx, '#477f75', '#152c32'))
  for (const side of [-1, 1]) {
    ctx.save()
    ctx.translate(side * 3, side * stride)
    shape(ctx, 'M-2 4H2L2.5 10H-2.5Z', '#17222d')
    shape(ctx, 'M-2 8H2L3 11H-2.5Z', '#779c9d')
    ctx.restore()
  }
  shape(ctx, 'M-5-4H5L6 3 3 7H-3L-6 3Z', gradient(ctx, '#a3c7bd', '#38555b'))
  shape(ctx, 'M-6-5-10-2-9 2-5 1-3-3ZM6-5 10-2 9 2 5 1 3-3Z', '#9eb5ba')
  shape(ctx, 'M-4-2 3 5 2 6-5-1Z', '#493a35')
  shape(ctx, 'M-5 4H5V6H-5Z', '#252b32')
  shape(ctx, 'M-1 4H1V6H-1Z', '#dfbc79')
  // Deep hood, exposed face, and a mint ward distinguish the hunter from enemies.
  shape(ctx, 'M-6-5Q-6-11 0-13Q6-11 6-5L4 0H-4Z', gradient(ctx, '#86cbb1', '#294a49'))
  shape(ctx, 'M-4-6Q0-11 4-6L3-2 0 0-3-2Z', '#17262d')
  shape(ctx, 'M-2.8-5H2.8L2-2 0-1-2-2Z', '#d5ad87')
  ctx.fillStyle = '#baffdf'
  ctx.fillRect(-2.5, -5.6, 5, 1)
  // The weapon turns independently so the face stays legible at every aim angle.
  ctx.save()
  ctx.rotate(angle)
  shape(ctx, 'M3-2H8V3H3Z', '#609e8a')
  shape(ctx, 'M7-2H14L16-1V1H10V3H7Z', '#b6c9cd')
  shape(ctx, 'M9 1H12L11 5H9Z', '#423b3b')
  ctx.shadowColor = '#91efbd'
  ctx.shadowBlur = effects ? 5 : 0
  ctx.fillStyle = '#baffdf'
  ctx.fillRect(11, -1.5, 5, 1)
  ctx.restore()
  ctx.restore()
}

export function drawDemon(
  ctx: CanvasRenderingContext2D,
  stride = 0,
  charging = false,
  armored = false,
  effects = true,
) {
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
