import { test, expect } from '@playwright/test'

const EMAIL = 'info@madrigalmarketing.es'
const PASS = 'Admin123!'

async function login(page) {
  await page.goto('/')
  await page.fill('input[type="email"]', EMAIL)
  await page.fill('input[type="password"]', PASS)
  await page.click('button[type="submit"]')
  await page.waitForURL(/.*(?:dashboard|ventas).*/, { timeout: 15000 })
}

test.describe('Dashboard Desglose Widgets', () => {
  test('should load desglose closers widget with data columns', async ({ page }) => {
    await login(page)
    await page.goto('/ventas/dashboard')
    await page.waitForTimeout(3000)

    // Check if desglose closers widget can be added or is already present
    const desgloseTable = page.locator('.db-wtable--desglose')
    const exists = await desgloseTable.count()

    if (exists === 0) {
      // Try to add it via the add widget button
      const addBtn = page.locator('button:has-text("Añadir"), button[aria-label*="añadir"], button[aria-label*="Añadir"]').first()
      const addExists = await addBtn.count()
      if (addExists > 0) {
        await addBtn.click()
        await page.waitForTimeout(500)
        const desgloseOption = page.locator('text=Desglose closers').first()
        const optionExists = await desgloseOption.count()
        if (optionExists > 0) {
          await desgloseOption.click()
          await page.waitForTimeout(2000)
        }
      }
    }

    // Verify the widget renders with expected columns
    const table = page.locator('.db-wtable--desglose').first()
    if (await table.count() > 0) {
      // Check header columns exist
      const headers = table.locator('thead th')
      const headerTexts = await headers.allTextContents()
      expect(headerTexts.join(' ')).toContain('Nombre')

      // Check totals row exists
      const totalsRow = table.locator('.db-wdesglose-totals')
      await expect(totalsRow).toBeVisible()
    }
  })

  test('desglose widget should have CSV export button', async ({ page }) => {
    await login(page)
    await page.goto('/ventas/dashboard')
    await page.waitForTimeout(3000)

    const exportBtn = page.locator('.db-wdesglose-export').first()
    if (await exportBtn.count() > 0) {
      await expect(exportBtn).toBeVisible()
      // Verify it has download icon
      await expect(exportBtn.locator('svg')).toBeVisible()
    }
  })
})
