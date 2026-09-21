import { chromium } from '@playwright/test';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
await page.goto('http://localhost:3001', { waitUntil: 'networkidle' });
await page.waitForTimeout(1500);
await page.screenshot({ path: '/tmp/legend.png' });
// try to start the game to capture gameplay canvas with a demon
await page.keyboard.press('Enter').catch(()=>{});
await page.waitForTimeout(3000);
await page.screenshot({ path: '/tmp/gameplay.png' });
await browser.close();
