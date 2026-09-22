<script setup lang="ts">
import { demonsGame, type Snapshot } from './utils/game'
import { WIDTH, HEIGHT, WORLD_WIDTH, WORLD_HEIGHT } from './utils/maze'
import './assets/main.css'

useHead({
  title: 'Demon Hunter — Enter the maze',
  meta: [
    {
      name: 'description',
      content:
        'An arcade classic, recompiled. Explore the maze, eliminate the demons, and destroy their portals in this modern browser arcade game.',
    },
  ],
  link: [{ rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' }],
})
type Run = {
  score: number
  wave: number
  kills: number
  duration: number
  date: string
  difficulty: string
}
const canvas = ref<HTMLCanvasElement | null>(null)
const arena = ref<HTMLElement | null>(null)
const music = ref<HTMLAudioElement | null>(null)
const view = ref('play')
const settingsOpen = ref(false)
const initialized = ref(false)
const sound = ref(true)
const effects = ref(true)
const difficulty = ref<'normal' | 'hard'>('normal')
const runs = ref<Run[]>([])
const best = computed(() => Math.max(0, ...runs.value.map((r) => r.score)))
const state = ref<Snapshot>({
  status: 'ready',
  score: 0,
  wave: 1,
  lives: 3,
  shield: 0,
  enemies: 0,
  portals: 4,
  kills: 0,
  elapsed: 0,
  dash: 0,
  x: WORLD_WIDTH / 2,
  y: WORLD_HEIGHT / 2,
})
const active = computed(() =>
  ['playing', 'paused', 'cleared', 'dying'].includes(state.value.status),
)
const elapsed = computed(
  () =>
    `${Math.floor(state.value.elapsed / 60)
      .toString()
      .padStart(2, '0')}:${Math.floor(state.value.elapsed % 60)
      .toString()
      .padStart(2, '0')}`,
)
const statusLabel = computed(
  () =>
    ({
      ready: 'AWAITING DEPLOYMENT',
      playing: 'MISSION IN PROGRESS',
      paused: 'MISSION PAUSED',
      over: 'SIGNAL LOST',
      dying: 'ARMOR FAILURE',
      cleared: 'SECTOR SECURED',
    })[state.value.status],
)
let game: demonsGame
let frame = 0,
  previous = 0,
  lastSync = 0
let recorded = false
let audioContext: AudioContext | null = null
let observer: ResizeObserver | null = null
let returnFocus: HTMLElement | null = null
function sync() {
  if (game) state.value = game.snapshot()
  syncMusic()
}
watch([sound, effects, difficulty], () => {
  try {
    localStorage.setItem(
      'demons-settings',
      JSON.stringify({ sound: sound.value, effects: effects.value, difficulty: difficulty.value }),
    )
  } catch {
    /* Storage is optional. */
  }
  if (game) game.effects = effects.value
  syncMusic()
})
function syncMusic() {
  if (!music.value) return
  if (sound.value && state.value.status === 'playing') music.value.play().catch(() => {})
  else music.value.pause()
}
function initAudio() {
  if (!sound.value) return
  try {
    audioContext ||= new AudioContext()
    void audioContext.resume().catch(() => {})
  } catch {
    /* Audio is optional. */
  }
}
function playSound(type: string) {
  if (!sound.value || !audioContext || audioContext.state !== 'running') return
  const oscillator = audioContext.createOscillator(),
    gain = audioContext.createGain(),
    now = audioContext.currentTime
  const frequency: Record<string, number> = {
    shoot: 510,
    hit: 150,
    portal: 110,
    hurt: 75,
    death: 260,
    wave: 540,
    dash: 300,
    enemyShoot: 230,
    bounce: 920,
  }
  const duration = type === 'death' ? 0.65 : 0.16
  oscillator.type = type === 'death' ? 'sawtooth' : type === 'shoot' ? 'triangle' : 'square'
  oscillator.frequency.setValueAtTime(frequency[type] || 200, now)
  oscillator.frequency.exponentialRampToValueAtTime(
    type === 'wave' ? 850 : 40,
    now + duration * 0.8,
  )
  gain.gain.setValueAtTime(
    type === 'bounce' ? 0.008 : type === 'enemyShoot' ? 0.012 : type === 'shoot' ? 0.022 : 0.04,
    now,
  )
  gain.gain.exponentialRampToValueAtTime(0.001, now + duration)
  oscillator.connect(gain)
  gain.connect(audioContext.destination)
  oscillator.start(now)
  oscillator.stop(now + duration + 0.01)
}
function start() {
  if (!game) return
  initAudio()
  view.value = 'play'
  game.difficulty = difficulty.value
  game.start()
  recorded = false
  if (music.value) music.value.currentTime = 0
  sync()
  nextTick(() => canvas.value?.focus())
}
function pause() {
  game?.togglePause()
  sync()
  if (game?.status === 'playing') canvas.value?.focus()
}
function changeView(next: string) {
  if (game && ['playing', 'cleared', 'dying'].includes(game.status)) {
    game.togglePause()
    sync()
  }
  view.value = next
}
function openSettings() {
  if (game && ['playing', 'cleared', 'dying'].includes(game.status)) {
    game.togglePause()
    sync()
  }
  returnFocus = document.activeElement as HTMLElement
  settingsOpen.value = true
  nextTick(() =>
    document.querySelector<HTMLButtonElement>('.settings-dialog .icon-button')?.focus(),
  )
}
function closeSettings() {
  settingsOpen.value = false
  returnFocus?.focus()
}
function trapFocus(event: KeyboardEvent) {
  if (event.key !== 'Tab') return
  const elements = [
    ...(event.currentTarget as HTMLElement).querySelectorAll<HTMLElement>(
      'button, select, input, [tabindex="0"]',
    ),
  ]
  const first = elements[0],
    last = elements.at(-1)
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault()
    last?.focus()
  }
  if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault()
    first?.focus()
  }
}
function toggleSound() {
  sound.value = !sound.value
  if (sound.value) initAudio()
}
function keyDown(event: KeyboardEvent) {
  const key = event.key.toLowerCase()
  if (settingsOpen.value) {
    if (key === 'escape') closeSettings()
    return
  }
  if (
    view.value !== 'play' ||
    ['INPUT', 'SELECT', 'BUTTON'].includes((event.target as HTMLElement)?.tagName)
  )
    return
  if (
    [
      'w',
      'a',
      's',
      'd',
      'arrowup',
      'arrowdown',
      'arrowleft',
      'arrowright',
      ' ',
      'shift',
      'escape',
      'p',
      'enter',
    ].includes(key)
  )
    event.preventDefault()
  if ((key === 'p' || key === 'escape') && !event.repeat) pause()
  else if (key === 'enter' && !event.repeat && ['ready', 'over'].includes(game.status)) start()
  else if (key === 'm' && !event.repeat) toggleSound()
  else game.keys.add(key)
}
function keyUp(event: KeyboardEvent) {
  game?.keys.delete(event.key.toLowerCase())
}
function loseFocus() {
  if (game && ['playing', 'cleared', 'dying'].includes(game.status)) {
    game.togglePause()
    sync()
  }
}
function visibilityChange() {
  if (document.hidden) loseFocus()
}
function point(event: PointerEvent) {
  if (!canvas.value || !game) return
  const rect = canvas.value.getBoundingClientRect()
  game.pointer = {
    x: ((event.clientX - rect.left) / rect.width) * WIDTH,
    y: ((event.clientY - rect.top) / rect.height) * HEIGHT,
  }
}
function fire(event: PointerEvent) {
  point(event)
  if (game?.status === 'playing') {
    initAudio()
    game.firing = true
    canvas.value?.focus()
  }
}
function stopFire() {
  if (game) game.firing = false
}
function touchKey(key: string, down: boolean, event: PointerEvent) {
  event.preventDefault()
  if (!game) return
  if (down) {
    ;(event.currentTarget as HTMLElement).setPointerCapture(event.pointerId)
    game.keys.add(key)
    if (['w', 'a', 's', 'd'].includes(key)) game.pointer = null
  } else game.keys.delete(key)
}
async function fullscreen() {
  try {
    if (document.fullscreenElement) await document.exitFullscreen()
    else await arena.value?.requestFullscreen()
    canvas.value?.focus()
  } catch {
    /* Fullscreen is optional. */
  }
}
function recordRun() {
  if (recorded) return
  recorded = true
  runs.value = [
    ...runs.value,
    {
      score: game.score,
      wave: game.wave,
      kills: game.kills,
      duration: Math.floor(game.elapsed),
      date: new Date().toISOString(),
      difficulty: game.difficulty,
    },
  ]
    .sort((a, b) => b.score - a.score)
    .slice(0, 10)
  try {
    localStorage.setItem('demons-runs', JSON.stringify(runs.value))
  } catch {
    /* Storage is optional. */
  }
}
function resize() {
  if (!canvas.value) return
  const ratio = Math.min(window.devicePixelRatio || 1, 2)
  canvas.value.width = WIDTH * ratio
  canvas.value.height = HEIGHT * ratio
  canvas.value.getContext('2d')?.setTransform(ratio, 0, 0, ratio, 0, 0)
}
function animate(time: number) {
  game.update(previous ? (time - previous) / 1000 : 0)
  previous = time
  const context = canvas.value?.getContext('2d')
  if (context && view.value === 'play') game.draw(context, time / 1000)
  if (time - lastSync > 75) {
    sync()
    lastSync = time
  }
  if (game.status === 'over') recordRun()
  frame = requestAnimationFrame(animate)
}
onMounted(() => {
  effects.value = !window.matchMedia('(prefers-reduced-motion: reduce)').matches
  try {
    const saved = JSON.parse(localStorage.getItem('demons-settings') || 'null')
    if (saved) {
      sound.value = saved.sound !== false
      effects.value = saved.effects !== false
      difficulty.value = saved.difficulty === 'hard' ? 'hard' : 'normal'
    }
    const scores = JSON.parse(localStorage.getItem('demons-runs') || '[]')
    if (Array.isArray(scores))
      runs.value = scores
        .filter(
          (r) =>
            r &&
            Number.isFinite(r.score) &&
            Number.isFinite(r.wave) &&
            Number.isFinite(r.kills) &&
            Number.isFinite(r.duration) &&
            typeof r.date === 'string',
        )
        .slice(0, 10)
  } catch {
    /* Start with defaults if storage is unavailable. */
  }
  game = new demonsGame()
  game.effects = effects.value
  game.onSound = playSound
  if (music.value) music.value.volume = 0.35
  resize()
  observer = new ResizeObserver(resize)
  if (canvas.value) observer.observe(canvas.value)
  initialized.value = true
  window.addEventListener('keydown', keyDown)
  window.addEventListener('keyup', keyUp)
  window.addEventListener('blur', loseFocus)
  window.addEventListener('pointerup', stopFire)
  document.addEventListener('visibilitychange', visibilityChange)
  frame = requestAnimationFrame(animate)
})
onBeforeUnmount(() => {
  cancelAnimationFrame(frame)
  observer?.disconnect()
  music.value?.pause()
  void audioContext?.close()
  window.removeEventListener('keydown', keyDown)
  window.removeEventListener('keyup', keyUp)
  window.removeEventListener('blur', loseFocus)
  window.removeEventListener('pointerup', stopFire)
  document.removeEventListener('visibilitychange', visibilityChange)
})
</script>

<template>
  <div class="app-shell">
    <header class="site-header">
      <a class="brand" href="#" aria-label="demons home" @click.prevent="changeView('play')"
        ><span class="brand-symbol"><span></span><span></span><span></span></span
        ><span class="brand-name"
          >Demon Hunter<span class="brand-edition">Portals from Hell</span></span
        ></a
      >
      <nav class="main-nav" aria-label="Main navigation">
        <button :class="{ selected: view === 'play' }" @click="changeView('play')">
          <GameIcon name="play" :size="15" /> Play<span class="nav-index">01</span></button
        ><button :class="{ selected: view === 'manual' }" @click="changeView('manual')">
          <GameIcon name="book" :size="16" /> Field manual<span class="nav-index">02</span></button
        ><button :class="{ selected: view === 'records' }" @click="changeView('records')">
          <GameIcon name="trophy" :size="16" /> Leaderboard<span class="nav-index">03</span>
        </button>
      </nav>
      <div class="header-actions">
        <button
          class="icon-button"
          :aria-label="sound ? 'Mute sound' : 'Enable sound'"
          :title="sound ? 'Mute sound (M)' : 'Enable sound (M)'"
          :aria-pressed="sound"
          @click="toggleSound"
        >
          <GameIcon :name="sound ? 'sound' : 'mute'" /></button
        ><span class="action-divider"></span
        ><button
          class="icon-button"
          aria-label="Open settings"
          title="Settings"
          @click="openSettings"
        >
          <GameIcon name="settings" />
        </button>
      </div>
    </header>
    <main>
      <section class="intro">
        <div>
          <div class="eyebrow">
            <span class="tiny-cross">+</span> Close the Portals, Save the World
          </div>
          <h1>
            {{
              view === 'manual'
                ? 'Know your enemy.'
                : view === 'records'
                  ? 'Leave your mark.'
                  : 'One hunter. A demon horde.'
            }}
          </h1>
          <p>
            {{
              view === 'manual'
                ? 'A little intel goes a long way. Make every shot count.'
                : view === 'records'
                  ? 'Good runs end. Great scores stick around.'
                  : 'A demon swarm in a relentless maze. Clear the portals to stop the invasion.'
            }}
          </p>
        </div>
        <div class="system-status">
          <span><i class="status-dot"></i> SYSTEM ONLINE</span
          ><small>WEB EDITION <span>/</span> V.2.0</small>
        </div>
      </section>
      <div v-show="view === 'play'" class="play-layout">
        <section ref="arena" class="game-panel" aria-label="demons game">
          <div class="game-hud">
            <div class="hud-stat score-stat">
              <span class="stat-label">SCORE</span
              ><strong>{{ state.score.toString().padStart(6, '0') }}</strong>
            </div>
            <div class="hud-stat">
              <span class="stat-label">WAVE</span
              ><strong
                ><span class="muted-hash">/</span>
                {{ state.wave.toString().padStart(2, '0') }}</strong
              >
            </div>
            <div class="hud-stat lives-stat">
              <span class="stat-label">LIVES</span>
              <div class="hearts" :aria-label="`${state.lives} lives remaining`">
                <GameIcon
                  v-for="n in 3"
                  :key="n"
                  name="heart"
                  :size="18"
                  :class="{ lost: n > state.lives }"
                />
                <span v-if="state.lives > 3" class="extra-lives">+{{ state.lives - 3 }}</span>
              </div>
              <span
                v-if="state.shield"
                class="shield-charges"
                :aria-label="`${state.shield} shield hits remaining`"
              >
                <GameIcon name="shield" :size="12" /> {{ state.shield }} / 3
              </span>
            </div>
            <div class="wave-tracker">
              <div>
                <span class="stat-label">DEMONS</span
                ><strong
                  >{{ state.enemies.toString().padStart(2, '0') }}<span> / ACTIVE</span></strong
                >
              </div>
              <div>
                <span class="stat-label">PORTALS</span
                ><strong
                  >{{ state.portals.toString().padStart(2, '0') }}<span> / LEFT</span></strong
                >
              </div>
            </div>
            <div class="hud-stat best-stat">
              <span class="stat-label"><GameIcon name="trophy" :size="11" /> PERSONAL BEST</span
              ><strong>{{ best.toString().padStart(6, '0') }}</strong>
            </div>
            <button
              class="icon-button pause-button"
              :aria-label="state.status === 'paused' ? 'Resume game' : 'Pause game'"
              :disabled="!['playing', 'paused', 'dying'].includes(state.status)"
              @click="pause"
            >
              <GameIcon :name="state.status === 'paused' ? 'play' : 'pause'" :size="18" />
            </button>
          </div>
          <div class="arena-screen" :class="{ 'is-ready': state.status === 'ready' }">
            <audio ref="music" src="/audio/sector-death.mp3" loop preload="auto"></audio>
            <canvas
              ref="canvas"
              :width="WIDTH"
              :height="HEIGHT"
              tabindex="0"
              aria-label="demons maze. Move with arrow keys. Aim and shoot with W A S D or mouse. Press Enter to start and Escape to pause."
              @pointermove="point"
              @pointerdown="fire"
              @pointerleave="stopFire"
              @contextmenu.prevent
            ></canvas>
            <div class="arena-coordinate top-coordinate">
              <span class="small-square"></span> WAVE {{ state.wave.toString().padStart(2, '0') }}
            </div>
            <div class="arena-coordinate bottom-coordinate">
              X: {{ state.x }} <span>/</span> Y: {{ state.y }} <span>//</span> {{ WORLD_WIDTH }} ×
              {{ WORLD_HEIGHT }} <span class="arena-cross">+</span>
            </div>
            <div v-if="state.status === 'ready'" class="game-overlay ready-overlay">
              <div class="deploy-tag"><span></span> ONE PILOT. NO BACKUP.</div>
              <h2>Outnumbered.<br /><span>Never outgunned.</span></h2>
              <p>Clear the portals. Survive the swarm.</p>
              <button class="primary-button deploy-button" :disabled="!initialized" @click="start">
                <GameIcon name="play" :size="16" /> ENTER THE MAZE
                <GameIcon name="arrow" :size="18" /></button
              ><span class="enter-hint">or press <kbd>ENTER</kbd> to deploy</span>
            </div>
            <div v-else-if="state.status === 'paused'" class="game-overlay state-overlay">
              <div class="deploy-tag">TAKE A BREATHER</div>
              <h2>Holding position.</h2>
              <p>Your maze will be right here.</p>
              <button class="primary-button" @click="pause">
                <GameIcon name="play" :size="16" /> RESUME MISSION</button
              ><span class="enter-hint">Press <kbd>ESC</kbd> to resume</span>
            </div>
            <div v-else-if="state.status === 'over'" class="game-overlay state-overlay">
              <div class="deploy-tag">CONNECTION TERMINATED</div>
              <h2>A good run, hunter.</h2>
              <p>
                {{ state.score.toLocaleString() }} points · {{ state.kills }} demons eliminated ·
                Wave {{ state.wave }}
              </p>
              <button class="primary-button" @click="start">
                <GameIcon name="reset" :size="17" /> GO AGAIN</button
              ><span class="enter-hint">Your score is saved to the local leaderboard.</span>
            </div>
            <div v-else-if="state.status === 'cleared'" class="game-overlay state-overlay">
              <div class="deploy-tag">+500 CLEAR BONUS</div>
              <h2>Sector secured.</h2>
              <p>Catch your breath. Wave {{ state.wave + 1 }} is incoming.</p>
            </div>
            <div v-if="state.status === 'playing'" class="dash-indicator">
              <GameIcon name="bolt" :size="13" /><span>{{
                state.dash > 0 ? `RECHARGING ${state.dash.toFixed(1)}s` : 'DASH READY'
              }}</span
              ><kbd>SHIFT</kbd>
            </div>
          </div>
          <div class="arena-toolbar">
            <span class="arena-state" :class="{ live: state.status === 'playing' }"
              ><i class="status-dot"></i>{{ statusLabel }}</span
            >
            <div>
              <span class="timer">{{ elapsed }}</span
              ><span class="toolbar-divider"></span
              ><button
                class="icon-button"
                aria-label="Toggle fullscreen"
                title="Fullscreen"
                @click="fullscreen"
              >
                <GameIcon name="expand" :size="16" />
              </button>
            </div>
          </div>
          <div class="touch-controls">
            <div class="touch-pad">
              <span>MOVE</span
              ><button
                v-for="[key, label] in [
                  ['arrowup', '↑'],
                  ['arrowleft', '←'],
                  ['arrowdown', '↓'],
                  ['arrowright', '→'],
                ]"
                :key="key"
                :aria-label="`Move ${label}`"
                @pointerdown="touchKey(key!, true, $event)"
                @pointerup="touchKey(key!, false, $event)"
                @pointercancel="touchKey(key!, false, $event)"
              >
                {{ label }}
              </button>
            </div>
            <div class="touch-actions">
              <button
                aria-label="Touch dash"
                :disabled="state.status !== 'playing' || state.dash > 0"
                @pointerdown="touchKey('shift', true, $event)"
                @pointerup="touchKey('shift', false, $event)"
                @pointercancel="touchKey('shift', false, $event)"
              >
                <GameIcon name="bolt" :size="15" /> DASH
              </button>
              <button
                :aria-label="state.status === 'paused' ? 'Touch resume' : 'Touch pause'"
                :disabled="!['playing', 'paused', 'cleared', 'dying'].includes(state.status)"
                @click="pause"
              >
                <GameIcon :name="state.status === 'paused' ? 'play' : 'pause'" :size="15" />
                {{ state.status === 'paused' ? 'PLAY' : 'PAUSE' }}
              </button>
            </div>
            <div class="touch-pad">
              <span>FIRE</span
              ><button
                v-for="[key, label] in [
                  ['w', '↑'],
                  ['a', '←'],
                  ['s', '↓'],
                  ['d', '→'],
                ]"
                :key="key"
                :aria-label="`Fire ${label}`"
                @pointerdown="touchKey(key!, true, $event)"
                @pointerup="touchKey(key!, false, $event)"
                @pointercancel="touchKey(key!, false, $event)"
              >
                {{ label }}
              </button>
            </div>
          </div>
        </section>
        <aside class="mission-sidebar">
          <section class="briefing-card">
            <div class="card-eyebrow">
              <span class="small-square orange"></span> MISSION BRIEF <span>001</span>
            </div>
            <h2>Less thinking.<br />More surviving.</h2>
            <p>You’re in their territory now.<br />Make yourself unwelcome.</p>
            <div class="mission-objective">
              <span class="objective-icon"><GameIcon name="target" :size="20" /></span>
              <div>
                <h3>Destroy the portals</h3>
                <p>Cut off the swarm at its source.</p>
              </div>
            </div>
            <div class="mission-objective">
              <span class="objective-icon"><GameIcon name="bolt" :size="20" /></span>
              <div>
                <h3>Bank your shots</h3>
                <p>Ricochet around corners. Dodge theirs.</p>
              </div>
            </div>
            <div class="mission-objective">
              <span class="objective-icon"><GameIcon name="shield" :size="20" /></span>
              <div>
                <h3>Clear. Repeat. Survive.</h3>
                <p>Every wave turns up the heat.</p>
              </div>
            </div>
            <div class="briefing-bottom">
              <span>NO EXITS. JUST HIGH SCORES.</span><GameIcon name="arrow" :size="15" />
            </div>
          </section>
          <section class="field-card">
            <div class="card-eyebrow">KNOW YOUR ENEMY <span>+</span></div>
            <div class="entity-row">
              <CharacterPortrait kind="hunter" />
              <div>
                <strong>You, the hunter</strong><span>Shoot the demons, close the portals</span>
              </div>
              <span class="entity-badge green">01</span>
            </div>
            <div class="entity-row">
              <CharacterPortrait kind="demon" />
              <div><strong>Ravager</strong><span>Always hunting. Always hostile.</span></div>
              <span class="entity-points">50 PT</span>
            </div>
            <div class="entity-row">
              <CharacterPortrait kind="watcher" />
              <div><strong>Watcher</strong><span>Sees you once. Hunts you forever.</span></div>
              <span class="entity-points">50 PT</span>
            </div>
            <div class="entity-row">
              <CharacterPortrait kind="lurker" />
              <div>
                <strong>Lurker</strong
                ><span>Almost blind. Will attack you if you get too close.</span>
              </div>
              <span class="entity-points">50 PT</span>
            </div>
            <div class="entity-row">
              <CharacterPortrait kind="portal" />
              <div><strong>The portals</strong><span>The root of your problems.</span></div>
              <span class="entity-points">250 PT</span>
            </div>
            <button class="text-button" @click="changeView('manual')">
              Open field manual <GameIcon name="arrow" :size="15" />
            </button>
          </section>
        </aside>
        <section class="controls-strip" aria-label="Game controls">
          <div class="controls-title">
            <GameIcon name="keyboard" :size="19" /><span>THE BASICS</span>
          </div>
          <div class="control-item">
            <div class="key-group"><kbd>↑</kbd><kbd>←</kbd><kbd>↓</kbd><kbd>→</kbd></div>
            <span>Move</span>
          </div>
          <div class="control-item">
            <div class="key-group"><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd></div>
            <span>Shoot</span>
          </div>
          <div class="control-item"><kbd class="wide-key">SHIFT</kbd><span>Dash</span></div>
          <div class="control-item"><kbd class="wide-key">ESC</kbd><span>Pause</span></div>
          <div class="mouse-hint">
            <span class="mouse-outline"></span> Mouse aim + click also works
          </div>
        </section>
      </div>
      <section v-if="view === 'manual'" class="manual-view">
        <div class="manual-hero">
          <div class="eyebrow">FIELD MANUAL / 01</div>
          <h2>Stay sharp.<br />Stay in motion.</h2>
          <p>
            You're the hunter in green combat armor and a sealed helmet, carrying a rifle. The
            demons are hunting you. Fiery portals keep making more. Destroy every portal and
            eliminate the remaining demons to advance.
          </p>
          <button class="primary-button" @click="active ? changeView('play') : start()">
            {{ active ? 'BACK TO MISSION' : 'READY TO DEPLOY' }}<GameIcon name="arrow" :size="18" />
          </button>
        </div>
        <div class="manual-grid">
          <article>
            <span class="manual-number">01 / MOVEMENT</span>
            <h3>Don’t get cornered.</h3>
            <p>
              Move with <b>arrow keys</b> through a maze nine times the screen area. The camera
              follows you, and every edge <b>wraps to the opposite side</b>. There's no map — learn
              the maze as you go. Each wave randomly picks one of <b>six maze layouts</b>, all the
              same size. Hold <b>Shift</b> while moving to dash; it recharges in three seconds.
            </p>
          </article>
          <article>
            <span class="manual-number">02 / FIREPOWER</span>
            <h3>Point. Shoot. Repeat.</h3>
            <p>
              Hold <b>W A S D</b> to shoot in a direction, including diagonally. Or aim with your
              <b>mouse</b> and hold the primary button to fire. <b>Space</b> fires in your current
              direction. Only diagonal shots <b>bounce off walls</b>, allowing bank shots around
              corners. Horizontal and vertical shots stop at walls. Diagonal shots keep ricocheting
              until their 3.2-second fuse runs out.
            </p>
          </article>
          <article>
            <span class="manual-number">03 / THE ENEMY</span>
            <h3>Go for the source.</h3>
            <p>
              Hostile demons follow you and <b>fire orange shots</b> when they can see you. Their
              shots stop at walls; your diagonal shots ricochet. Each kill earns <b>50 points</b>.
              Portals take several hits and are worth <b>250 points</b>. Each wave starts with no
              demons. Portals release them slowly at first, then faster the longer you survive.
            </p>
            <p>
              All three types spawn equally often. <b>Red Ravagers</b> always hunt you.
              <b>Violet Watchers</b> wander randomly until they see you, then keep hunting even
              through cover. <b>Amber Lurkers</b> wander until they see you within a
              <b>seven-square radius</b>. They keep chasing beyond that range until you break line
              of sight, then return to wandering.
            </p>
          </article>
          <article>
            <span class="manual-number">04 / SURVIVAL</span>
            <h3>Make all three count.</h3>
            <p>
              You have <b>three lives</b>. Contact with a deamon or an orange shot costs one. Dash
              briefly protects you, and your own ricochets are harmless to you. Clear a wave for
              <b>500 bonus points</b> and one restored life, up to three. Later waves get faster and
              tougher.
            </p>
            <p>
              From <b>wave 4</b>, find a blue shield in the maze to absorb <b>three demon hits</b>,
              including shots and contact. Unused protection carries into the next wave; another
              shield refills it to three hits. From <b>wave 5</b>, find a pink heart for an
              <b>extra life</b>, even above three. One of each unlocked pickup appears at a random
              location each wave. Walk over it to collect it.
            </p>
          </article>
        </div>
        <div class="manual-note">
          <GameIcon name="pause" :size="19" />
          <p>
            Press <kbd>ESC</kbd> or <kbd>P</kbd> to pause. The game also pauses when you leave the
            window. Playing on touch? Use the directional controls beneath the arena.
          </p>
        </div>
      </section>
      <section v-if="view === 'records'" class="records-view">
        <div class="records-header">
          <div>
            <div class="eyebrow">THE LOCAL LEGENDS</div>
            <h2>Top runs.</h2>
          </div>
          <span class="local-badge"><i class="status-dot"></i> SAVED ON THIS DEVICE</span>
        </div>
        <div v-if="!runs.length" class="empty-records">
          <div class="trophy-emblem"><GameIcon name="trophy" :size="38" /></div>
          <h3>The top spot is yours to take.</h3>
          <p>Finish your first run to put a score on the board.</p>
          <button class="primary-button" @click="active ? changeView('play') : start()">
            {{ active ? 'BACK TO MISSION' : 'MAKE YOUR FIRST RUN'
            }}<GameIcon name="arrow" :size="18" />
          </button>
        </div>
        <div v-else class="score-table-wrap">
          <table class="score-table">
            <thead>
              <tr>
                <th>RANK</th>
                <th>SCORE</th>
                <th>WAVE</th>
                <th>ELIMINATIONS</th>
                <th>MODE</th>
                <th>DATE</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(run, index) in runs" :key="`${run.date}-${index}`">
                <td>
                  <span :class="{ 'top-rank': index === 0 }">{{
                    (index + 1).toString().padStart(2, '0')
                  }}</span>
                </td>
                <td>{{ run.score.toLocaleString() }}</td>
                <td>{{ run.wave.toString().padStart(2, '0') }}</td>
                <td>{{ run.kills }}</td>
                <td>
                  <span class="mode-tag">{{ run.difficulty || 'normal' }}</span>
                </td>
                <td>
                  {{
                    new Date(run.date).toLocaleDateString(undefined, {
                      month: 'short',
                      day: 'numeric',
                    })
                  }}
                </td>
              </tr>
            </tbody>
          </table>
          <div class="records-footer">
            <p>Your best 10 completed runs. All modes included.</p>
            <button class="primary-button" @click="active ? changeView('play') : start()">
              {{ active ? 'BACK TO MISSION' : 'ONE MORE RUN' }}<GameIcon name="arrow" :size="16" />
            </button>
          </div>
        </div>
      </section>
      <footer class="site-footer">
        <div><span class="footer-mark">S/</span> AN ARCADE CLASSIC. REBUILT FOR RIGHT NOW.</div>
        <span
          >NO DOWNLOADS. NO QUARTERS. <span class="footer-accent">JUST ONE MORE RUN.</span></span
        >
      </footer>
    </main>
    <div v-if="settingsOpen" class="modal-backdrop" @click.self="closeSettings">
      <section
        class="settings-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-title"
        @keydown="trapFocus"
      >
        <div class="dialog-header">
          <div>
            <div class="eyebrow">YOUR GAME, YOUR WAY</div>
            <h2 id="settings-title">Settings.</h2>
          </div>
          <button class="icon-button" aria-label="Close settings" @click="closeSettings">
            <GameIcon name="close" />
          </button>
        </div>
        <div class="setting-row">
          <div>
            <h3>Arcade audio</h3>
            <p>Original synthesized game sounds.</p>
          </div>
          <button
            class="toggle"
            :class="{ on: sound }"
            role="switch"
            :aria-checked="sound"
            aria-label="Arcade audio"
            @click="toggleSound"
          >
            <span></span>
          </button>
        </div>
        <div class="setting-row">
          <div>
            <h3>Visual effects</h3>
            <p>Glow, particles, and animated sprites.</p>
          </div>
          <button
            class="toggle"
            :class="{ on: effects }"
            role="switch"
            :aria-checked="effects"
            aria-label="Visual effects"
            @click="effects = !effects"
          >
            <span></span>
          </button>
        </div>
        <div class="setting-row">
          <div>
            <label for="difficulty">Difficulty</label>
            <p>Applies to your next run.</p>
          </div>
          <select id="difficulty" v-model="difficulty">
            <option value="normal">Classic</option>
            <option value="hard">Relentless</option>
          </select>
        </div>
        <div class="settings-note">
          <GameIcon name="shield" :size="17" /><span
            >Progress and preferences stay on this device.</span
          >
        </div>
        <button class="primary-button" @click="closeSettings">
          ALL SET <GameIcon name="arrow" :size="18" />
        </button>
      </section>
    </div>
  </div>
</template>
