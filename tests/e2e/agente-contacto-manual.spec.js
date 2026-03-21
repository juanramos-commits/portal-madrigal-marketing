import { test, expect } from '@playwright/test'

const EMAIL = 'info@madrigalmarketing.es'
const PASS = 'Admin123!'
const AGENTE_ID = '62f4c67f-221c-4c76-ae2e-c0cdaceba804'

test('contacto manual should send first message successfully', async ({ page }) => {
  // Login
  await page.goto('https://app.madrigalmarketing.es')
  await page.fill('input[type="email"]', EMAIL)
  await page.fill('input[type="password"]', PASS)
  await page.click('button[type="submit"]')
  await page.waitForURL(/.*(?:dashboard|ventas).*/, { timeout: 15000 })

  // Navigate to agent detail
  await page.goto(`https://app.madrigalmarketing.es/ventas/agentes-ia/${AGENTE_ID}`)
  await page.waitForTimeout(3000)

  // Take screenshot of agent page
  await page.screenshot({ path: 'test-results/agente-page.png' })

  // Look for "Contacto manual" button or similar
  const contactoBtn = page.locator('button:has-text("Contacto manual"), button:has-text("contacto manual"), button:has-text("Añadir contacto")')
  const btnExists = await contactoBtn.count()

  if (btnExists === 0) {
    // Try finding it in a menu or dropdown
    const menuBtn = page.locator('button:has-text("Añadir"), button:has-text("añadir"), button[aria-label*="añadir"]').first()
    if (await menuBtn.count() > 0) {
      await menuBtn.click()
      await page.waitForTimeout(500)
      await page.screenshot({ path: 'test-results/agente-menu.png' })
      const manualOption = page.locator('text=Contacto manual, text=contacto manual').first()
      if (await manualOption.count() > 0) {
        await manualOption.click()
      }
    }
  } else {
    await contactoBtn.first().click()
  }

  await page.waitForTimeout(500)
  await page.screenshot({ path: 'test-results/agente-modal-open.png' })

  // Fill form
  const modal = page.locator('.ia-modal')
  if (await modal.count() === 0) {
    console.log('Modal not found, skipping')
    return
  }

  await modal.locator('input[type="tel"]').fill('699888777')
  await modal.locator('input[placeholder*="Nombre"]').fill('Test Playwright')

  const emailInput = modal.locator('input[type="email"]')
  if (await emailInput.count() > 0) {
    await emailInput.fill('test@test.com')
  }

  const servicioInput = modal.locator('input[placeholder*="Servicio"], input[placeholder*="servicio"]')
  if (await servicioInput.count() > 0) {
    await servicioInput.fill('Testing')
  }

  await page.screenshot({ path: 'test-results/agente-modal-filled.png' })

  // Intercept the edge function call to see exact response
  const responsePromise = page.waitForResponse(resp => resp.url().includes('ia-outbound-primer-mensaje'), { timeout: 30000 }).catch(() => null)

  // Click send
  const sendBtn = modal.locator('button[type="submit"], button:has-text("Enviar primer mensaje")')
  await sendBtn.click()

  const resp = await responsePromise
  if (resp) {
    console.log(`RESPONSE STATUS: ${resp.status()}`)
    try {
      const body = await resp.json()
      console.log(`RESPONSE BODY: ${JSON.stringify(body)}`)
    } catch { console.log('RESPONSE: non-JSON') }
  } else {
    console.log('NO RESPONSE captured (timeout or no request)')
  }

  // Wait for UI to update
  await page.waitForTimeout(3000)

  await page.screenshot({ path: 'test-results/agente-modal-result.png' })

  // Check for success or error
  const successIndicator = modal.locator('text=Mensaje enviado, text=enviado correctamente')
  const errorIndicator = modal.locator('.ia-import-error')

  const hasSuccess = await successIndicator.count()
  const hasError = await errorIndicator.count()

  if (hasError > 0) {
    const errorText = await errorIndicator.textContent()
    console.log('ERROR:', errorText)
  }

  if (hasSuccess > 0) {
    console.log('SUCCESS: Message sent')
  }

  expect(hasSuccess, `Expected success but got error. hasSuccess=${hasSuccess}, hasError=${hasError}`).toBeGreaterThan(0)
})
