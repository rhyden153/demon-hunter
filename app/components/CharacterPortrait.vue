<script setup lang="ts">
import { drawDemon, drawHunter, drawPortal } from '../utils/characters'

const props = defineProps<{ kind: 'hunter' | 'demon' | 'watcher' | 'lurker' | 'portal' }>()
const canvas = ref<HTMLCanvasElement | null>(null)
onMounted(() => {
  const element = canvas.value
  if (!element) return
  const ratio = Math.min(window.devicePixelRatio || 1, 2)
  element.width = 44 * ratio
  element.height = 44 * ratio
  const ctx = element.getContext('2d')
  if (!ctx) return
  ctx.scale(ratio, ratio)
  ctx.translate(22, 24)
  const scale = props.kind === 'portal' ? 1.05 : 1.3
  ctx.scale(scale, scale)
  if (props.kind === 'hunter') drawHunter(ctx, -0.4)
  else if (props.kind === 'portal') drawPortal(ctx, 0, false)
  else drawDemon(ctx, 0, false, false, false, props.kind === 'demon' ? 'ravager' : props.kind)
})
</script>

<template>
  <canvas ref="canvas" class="character-portrait" width="44" height="44" aria-hidden="true" />
</template>

<style scoped>
.character-portrait {
  width: 44px;
  height: 44px;
  flex: 0 0 44px;
}
</style>
