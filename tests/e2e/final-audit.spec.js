import { test, expect } from '@playwright/test'

const BASE = 'http://localhost:5180'
const LOGIN_EMAIL = 'info@madrigalmarketing.es'
const LOGIN_PASS = 'Admin123!'

/**
 * Final Audit – Cold Email Module
 * Checks all 7 pages load correctly, captures JS errors, takes screenshots.
 */

async function login(page) {
  await page.goto(`${BASE}/login`)
  await page.waitForTimeout(1000)
  await page.fill('input[type="email"]', LOGIN_EMAIL)
  await page.fill('input[type="password"]', LOGIN_PASS)
  await page.click('button[type="submit"]')
  // Wait for redirect away from /login (successful auth)
  await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 15000 })
  await page.waitForTimeout(2000)
}

const PAGES = [
  { name: 'Dashboard',  path: '/cold-email' },
  { name: 'Contactos',  path: '/cold-email/contactos' },
  { name: 'Secuencias', path: '/cold-email/secuencias' },
  { name: 'Respuestas', path: '/cold-email/respuestas' },
  { name: 'Envios',     path: '/cold-email/envios' },
  { name: 'Plantillas', path: '/cold-email/plantillas' },
  { name: 'Config',     path: '/cold-email/config' },
]

test.describe('Cold Email Module – Final Audit', () => {
  for (const pg of PAGES) {
    test(`${pg.name} (${pg.path}) loads without errors`, async ({ page }) => {
      // Collect JS errors
      const jsErrors = []
      const consoleErrors = []

      page.on('pageerror', (err) => {
        jsErrors.push(err.message)
      })
      page.on('console', (msg) => {
        if (msg.type() === 'error') {
          consoleErrors.push(msg.text())
        }
      })

      // Login
      await login(page)

      // Navigate to the page
      const response = await page.goto(`${BASE}${pg.path}`, { waitUntil: 'networkidle', timeout: 30000 })

      // Check HTTP response is OK
      expect(response.status(), `${pg.name} returned HTTP ${response.status()}`).toBeLessThan(400)

      // Wait for any loading spinners to disappear
      await page.waitForSelector('.ce-spinner, .loading, [data-loading="true"]', { state: 'hidden', timeout: 10000 }).catch(() => {})
      await page.waitForTimeout(2000)

      // Verify something rendered (not a blank page)
      const bodyText = await page.textContent('body')
      expect(bodyText.length, `${pg.name} body should not be empty`).toBeGreaterThan(50)

      // Take screenshot
      await page.screenshot({
        path: `tests/e2e/screenshots/final-audit-${pg.name.toLowerCase()}.png`,
        fullPage: true,
      })

      // Report console errors (log them but don't fail the test for warnings)
      if (consoleErrors.length > 0) {
        console.log(`[${pg.name}] Console errors (${consoleErrors.length}):`)
        consoleErrors.forEach((e) => console.log(`  - ${e}`))
      } else {
        console.log(`[${pg.name}] No console errors`)
      }

      // Fail on uncaught JS exceptions
      if (jsErrors.length > 0) {
        console.log(`[${pg.name}] JS page errors (${jsErrors.length}):`)
        jsErrors.forEach((e) => console.log(`  - ${e}`))
      }
      expect(jsErrors, `${pg.name} should have no uncaught JS errors`).toHaveLength(0)

      console.log(`[${pg.name}] PASS`)
    })
  }
})
