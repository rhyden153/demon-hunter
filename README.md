# demons / RELOADED

A modern browser arcade game inspired by DOS demons. Hunter a small ship through the maze, destroy enemy portals, and survive increasingly difficult waves.

Built with Nuxt 4, Vue 3, TypeScript, Canvas 2D, and synthesized Web Audio. No game engine or external image assets required.

## Run locally

Use Node.js 24 or later.

```sh
npm install
npm run dev
```

Open http://localhost:3000. For production, run `npm run build`, then `npm run preview`.

## Controls

| Action                    | Control                              |
| ------------------------- | ------------------------------------ |
| Move                      | W A S D                              |
| Aim and fire              | Arrow keys, including diagonals      |
| Mouse aim and fire        | Move pointer and hold primary button |
| Fire in current direction | Space                                |
| Dash                      | Shift while moving                   |
| Pause / resume            | Escape or P                          |
| Toggle audio              | M                                    |
| Start / retry             | Enter                                |

Touch controls appear on mobile devices. Settings include audio, visual effects, and Classic or Relentless difficulty. Difficulty changes apply to the next run. Switching tabs, opening settings, or leaving the browser window pauses the mission.

## Rules

- Explore a 111 × 69 tile maze (nine screen-sized sectors) with a following camera. The world wraps horizontally and vertically for the hunter, demons, and projectiles.
- Start with three lives. Contact with a deamon or its orange shots costs a life and grants brief invulnerability. demons shoot when they have a clear line of sight; walls absorb their shots.
- Eliminate demons for 50 points; destroy portals for 250 points.
- From wave 4, each maze contains a blue shield pickup that absorbs three demon hits (shots or contact). Unused charges carry between waves; collecting another shield refills to three. From wave 6, each maze also contains a pink extra-life pickup, which can raise lives above three. Walk over pickups to collect them. Both spawn on random reachable floor tiles away from portals and the starting position; uncollected pickups are replaced each wave.
- Portals release equal numbers of three demon types in shuffled groups of three. Red Ravagers always hunt. Violet, single-eyed Watchers wander randomly until they see the hunter, then stay aggressive. Amber, six-legged Lurkers wander until the hunter is visible within seven grid squares (a 168-pixel radius, including across world seams); they keep chasing beyond that range until line of sight breaks. All three share the same combat stats and attack behavior when aggressive.
- Destroy every portal and remaining enemy to clear a wave, earn 500 points, and restore one life (maximum three).
- Each wave randomly selects one of six fixed maze layouts with equal probability. All share the same dimensions, wrapping edges, and gameplay rules; consecutive repeats are possible. Later waves introduce more portals and increase enemy speed and toughness.
- Only diagonal player shots ricochet off walls. Horizontal and vertical shots stop on impact. Diagonal bank shots expire after four seconds or eight reflections and cannot hurt the hunter.
- Each wave starts with zero demons, and portals spawn at random open locations in the maze. In the first Classic wave, portals begin releasing demons after six seconds, staggered three seconds apart. Their spawn intervals gradually shorten from 12 to 2 seconds over 100 seconds of active play. Later waves and Relentless mode increase the rate; pausing freezes the ramp. Destroying a portal stops its spawns. The live deamon population is capped at 65.
- Dash briefly protects the hunter and recharges in three seconds. Walls block movement, even across world seams.
- The ten best completed runs and preferences are saved in this browser's local storage. The leaderboard is local, with no account or server needed.

## Checks

```sh
npm test
npm run typecheck
npm run test:browser
npm run build
```

Engine tests cover maze reachability, wrapping, camera coordinates, pathfinding, ricochets, enemy fire, scoring, lives, and wave transitions. Browser tests cover play/pause, navigation, settings persistence, completed scores, and mobile layout. Browser tests use locally installed Google Chrome and start a development server if one isn't already running. Screenshots are written to `test-results/`.

`app/utils/game.ts` contains the game simulation and canvas renderer. `app/utils/maze.ts` defines the world layout and wrapping coordinates. `app/app.vue` manages the interface, inputs, sound, and persistence. `app/assets/main.css` contains responsive styles. Fonts are requested from Google Fonts with local fallbacks.
