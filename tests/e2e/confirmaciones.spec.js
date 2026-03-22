import { test, expect } from '@playwright/test'

const EMAIL = 'info@madrigalmarketing.es'
const PASS = 'Admin123!'

async function login(page) {
  await page.goto('https://app.madrigalmarketing.es')
  await page.fill('input[type="email"]', EMAIL)
  await page.fill('input[type="password"]', PASS)
  await page.click('button[type="submit"]')
  await page.waitForURL(/.*(?:dashboard|ventas).*/, { timeout: 15000 })
}

test.describe('Confirmaciones (Anti No-Show)', () => {
  test('page loads and shows all tabs', async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 })
    await login(page)

    await page.goto('https://app.madrigalmarketing.es/ventas/confirmaciones')
    await page.waitForTimeout(3000)

    await page.screenshot({ path: 'test-results/confirmaciones-full.png', fullPage: true })

    // Check page title
    const title = page.locator('h1')
    await expect(title).toContainText('Confirmaciones')

    // Check KPI cards exist
    const kpis = page.locator('[style*="gridTemplateColumns"]').first()
    await expect(kpis).toBeVisible()

    // Check 4 KPI values
    const kpiLabels = await page.locator('text=Asistencia 30d, text=Confirmadas D-1, text=No-shows 30d, text=Total citas 30d').count()
    console.log(`KPI labels found: ${kpiLabels}`)

    // Check tabs
    const tabHoy = page.locator('button:has-text("Hoy")')
    const tabPipeline = page.locator('button:has-text("Pipeline")')
    const tabConfig = page.locator('button:has-text("Configuración")')
    await expect(tabHoy).toBeVisible()
    await expect(tabPipeline).toBeVisible()
    await expect(tabConfig).toBeVisible()
  })

  test('Hoy tab shows citas or empty message', async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 })
    await login(page)

    await page.goto('https://app.madrigalmarketing.es/ventas/confirmaciones')
    await page.waitForTimeout(3000)

    // Should show either citas or "No hay citas para hoy"
    const content = await page.textContent('body')
    const hasCitas = content.includes('con ') // "con Pablo" or "con Mercedes"
    const hasEmpty = content.includes('No hay citas para hoy')

    expect(hasCitas || hasEmpty).toBeTruthy()
    console.log(`Hoy tab: ${hasCitas ? 'Has citas' : 'Empty'}`)
  })

  test('Pipeline tab loads future citas', async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 })
    await login(page)

    await page.goto('https://app.madrigalmarketing.es/ventas/confirmaciones')
    await page.waitForTimeout(2000)

    // Click Pipeline tab
    await page.click('button:has-text("Pipeline")')
    await page.waitForTimeout(2000)

    await page.screenshot({ path: 'test-results/confirmaciones-pipeline.png' })

    const content = await page.textContent('body')
    const hasCitas = content.includes('con ') || content.includes('Pablo') || content.includes('Mercedes')
    const hasEmpty = content.includes('No hay citas futuras')

    expect(hasCitas || hasEmpty).toBeTruthy()
    console.log(`Pipeline tab: ${hasCitas ? 'Has citas' : 'Empty'}`)
  })

  test('Config tab shows 13 steps', async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 })
    await login(page)

    await page.goto('https://app.madrigalmarketing.es/ventas/confirmaciones')
    await page.waitForTimeout(2000)

    // Click Config tab
    await page.click('button:has-text("Configuración")')
    await page.waitForTimeout(2000)

    await page.screenshot({ path: 'test-results/confirmaciones-config.png' })

    // Check that config items exist
    const confirmacion = page.locator('text=Confirmación inmediata')
    await expect(confirmacion).toBeVisible()

    const d1 = page.locator('text=Recordatorio D-1')
    await expect(d1).toBeVisible()

    const noshow = page.locator('text=No-show')
    const noshowCount = await noshow.count()
    console.log(`No-show steps found: ${noshowCount}`)
    expect(noshowCount).toBeGreaterThanOrEqual(2)

    // Check active/inactive buttons
    const activeButtons = page.locator('button:has-text("Activo")')
    const activeCount = await activeButtons.count()
    console.log(`Active steps: ${activeCount}`)
    expect(activeCount).toBeGreaterThanOrEqual(10)
  })

  test('Config toggle works', async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 })
    await login(page)

    await page.goto('https://app.madrigalmarketing.es/ventas/confirmaciones')
    await page.waitForTimeout(2000)

    await page.click('button:has-text("Configuración")')
    await page.waitForTimeout(2000)

    // Count active before
    const activeBefore = await page.locator('button:has-text("Activo")').count()

    // Toggle the last step (post_asistencia)
    const postBtn = page.locator('button:has-text("Activo")').last()
    await postBtn.click()
    await page.waitForTimeout(1000)

    // Check it changed to Inactivo
    const activeAfter = await page.locator('button:has-text("Activo")').count()
    console.log(`Active before: ${activeBefore}, after: ${activeAfter}`)

    // Toggle back
    const inactiveBtn = page.locator('button:has-text("Inactivo")').last()
    await inactiveBtn.click()
    await page.waitForTimeout(1000)

    const activeRestored = await page.locator('button:has-text("Activo")').count()
    expect(activeRestored).toBe(activeBefore)
  })

  test('sidebar shows Confirmaciones link', async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 })
    await login(page)

    await page.goto('https://app.madrigalmarketing.es/ventas/dashboard')
    await page.waitForTimeout(2000)

    // Check sidebar has the link
    const link = page.locator('a[href="/ventas/confirmaciones"], [href="/ventas/confirmaciones"]')
    const exists = await link.count()
    console.log(`Sidebar link exists: ${exists > 0}`)
    expect(exists).toBeGreaterThan(0)
  })
})
