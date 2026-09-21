import { test, expect } from '@playwright/test'

test.beforeEach(async ({ page }) => {
  page.on('pageerror', (error) => console.error('Browser error:', error.message))
})

test('desktop arena renders and keyboard controls start, fire, pause, and resume', async ({
  page,
}) => {
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  await page.goto('/')
  await expect(page.getByRole('button', { name: 'ENTER THE MAZE' })).toBeEnabled()
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('One hunter. A demon horde.')
  await page.evaluate(() => document.fonts.ready)
  await page.screenshot({ path: 'test-results/desktop.png', fullPage: true })
  await page.getByRole('button', { name: 'ENTER THE MAZE' }).click()
  await expect(page.locator('.arena-state')).toHaveText('MISSION IN PROGRESS')
  await page.keyboard.down('d')
  await page.waitForTimeout(250)
  await page.keyboard.up('d')
  await page.keyboard.down('ArrowUp')
  await page.waitForTimeout(1100)
  await page.keyboard.up('ArrowUp')
  await page.keyboard.press('Escape')
  await expect(page.getByRole('heading', { name: 'Holding position.' })).toBeVisible()
  const timer = await page.locator('.timer').textContent()
  await page.waitForTimeout(1100)
  await expect(page.locator('.timer')).toHaveText(timer!)
  await page.getByRole('button', { name: 'RESUME MISSION' }).click()
  await expect(page.locator('.arena-state')).toHaveText('MISSION IN PROGRESS')
  await page.screenshot({ path: 'test-results/playing.png', fullPage: true })
  expect(errors).toEqual([])
})

test('navigation preserves and pauses the current run', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'ENTER THE MAZE' }).click()
  await page.getByRole('button', { name: /Field manual/ }).click()
  await expect(page.getByRole('heading', { name: 'Know your enemy.' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Go for the source.' })).toBeVisible()
  await expect(page.getByText('wraps to the opposite side', { exact: true })).toBeVisible()
  await expect(page.getByText('bounce off walls', { exact: true })).toBeVisible()
  await expect(page.getByText('fire orange shots', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'BACK TO MISSION' }).click()
  await expect(page.locator('.arena-state')).toHaveText('MISSION PAUSED')
  await page.getByRole('button', { name: /Leaderboard/ }).click()
  await expect(page.getByText('The top spot is yours to take.')).toBeVisible()
  await page.getByRole('button', { name: 'BACK TO MISSION' }).click()
  await expect(page.getByRole('button', { name: 'RESUME MISSION' })).toBeVisible()
})

test('the camera keeps the hunter centered while world coordinates change', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'ENTER THE MAZE' }).click()
  await expect(page.locator('.top-coordinate')).toContainText('WAVE 01')
  const before = await page.locator('.bottom-coordinate').textContent()
  await page.keyboard.down('ArrowUp')
  await page.waitForTimeout(400)
  await page.keyboard.up('ArrowUp')
  await expect(page.locator('.bottom-coordinate')).not.toHaveText(before!)
  // The live canvas must still draw the mint hunter at its center after scrolling.
  const mintPixels = await page
    .locator('.arena-screen canvas')
    .evaluate((canvas: HTMLCanvasElement) => {
      const ctx = canvas.getContext('2d')!
      const image = ctx.getImageData(canvas.width / 2 - 15, canvas.height / 2 - 15, 30, 30)
      let count = 0
      for (let i = 0; i < image.data.length; i += 4) {
        const [r, g, b] = image.data.slice(i, i + 3)
        if (g! > 80 && g! > r! * 1.15 && g! > b! * 1.05) count++
      }
      return count
    })
  expect(mintPixels).toBeGreaterThan(20)
  await page.screenshot({ path: 'test-results/scrolling-maze.png', fullPage: true })
})

test('settings are accessible and persist after reload', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('button', { name: 'ENTER THE MAZE' })).toBeEnabled()
  await page.getByRole('button', { name: 'Open settings' }).click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Close settings' })).toBeFocused()
  await page.getByRole('switch', { name: 'Arcade audio' }).click()
  await page.getByRole('switch', { name: 'Visual effects' }).click()
  await page.getByLabel('Difficulty', { exact: true }).selectOption('hard')
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog')).not.toBeVisible()
  await expect(page.getByRole('button', { name: 'Open settings' })).toBeFocused()
  await page.reload()
  await expect(page.getByRole('button', { name: 'ENTER THE MAZE' })).toBeEnabled()
  await page.getByRole('button', { name: 'Open settings' }).click()
  await expect(page.getByRole('switch', { name: 'Arcade audio' })).toHaveAttribute(
    'aria-checked',
    'false',
  )
  await expect(page.getByRole('switch', { name: 'Visual effects' })).toHaveAttribute(
    'aria-checked',
    'false',
  )
  await expect(page.getByLabel('Difficulty', { exact: true })).toHaveValue('hard')
})

test('a completed run is recorded once and survives reload', async ({ page }) => {
  await page.clock.install()
  await page.goto('/')
  await page.getByRole('button', { name: 'ENTER THE MAZE' }).click()
  await expect(page.locator('.arena-state')).toHaveText('MISSION IN PROGRESS')
  await page.clock.runFor(35000)
  await expect(page.getByRole('heading', { name: 'A good run, hunter.' })).toBeVisible()
  await page.getByRole('button', { name: /Leaderboard/ }).click()
  await expect(page.locator('.score-table tbody tr')).toHaveCount(1)
  await page.reload()
  await expect(page.getByRole('button', { name: 'ENTER THE MAZE' })).toBeEnabled()
  await page.getByRole('button', { name: /Leaderboard/ }).click()
  await expect(page.locator('.score-table tbody tr')).toHaveCount(1)
})

test('hostile counter starts at zero and portals introduce demons gradually', async ({ page }) => {
  await page.clock.install()
  await page.goto('/')
  const counter = page.locator('.wave-tracker > div').first().locator('strong')
  await expect(counter).toHaveText('00 / ACTIVE')
  await page.getByRole('button', { name: 'ENTER THE MAZE' }).click()
  await page.clock.runFor(5000)
  await expect(counter).toHaveText('00 / ACTIVE')
  await page.clock.runFor(1500)
  await expect(counter).toHaveText('01 / ACTIVE')
  await page.keyboard.press('Escape')
  await page.clock.runFor(10000)
  await expect(counter).toHaveText('01 / ACTIVE')
})

test('mobile layout fits the screen and provides touch controls', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/')
  await expect(page.getByRole('button', { name: 'ENTER THE MAZE' })).toBeEnabled()
  await page.evaluate(() => document.fonts.ready)
  await expect(page.getByRole('button', { name: 'Move ↑', exact: true })).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  )
  await page.screenshot({ path: 'test-results/mobile.png', fullPage: true })
  await page.getByRole('button', { name: 'ENTER THE MAZE' }).click()
  await expect(page.locator('.arena-state')).toHaveText('MISSION IN PROGRESS')
  const move = await page.getByRole('button', { name: 'Move ↑', exact: true }).boundingBox()
  await page.mouse.move(move!.x + move!.width / 2, move!.y + move!.height / 2)
  await page.mouse.down()
  await page.waitForTimeout(250)
  await page.mouse.up()
  await page.getByRole('button', { name: 'Touch pause' }).click()
  await expect(page.locator('.arena-state')).toHaveText('MISSION PAUSED')
  await page.getByRole('button', { name: 'Touch resume' }).click()
  await expect(page.locator('.arena-state')).toHaveText('MISSION IN PROGRESS')
})
