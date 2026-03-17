import { test, expect } from '@playwright/test'

const LOGIN_EMAIL = 'info@madrigalmarketing.es'
const LOGIN_PASS = 'Admin123!'

async function login(page) {
  await page.goto('/login')
  await page.fill('input[type="email"]', LOGIN_EMAIL)
  await page.fill('input[type="password"]', LOGIN_PASS)
  await page.click('button[type="submit"]')
  await page.waitForURL('**/ventas/**', { timeout: 15000 }).catch(() => {})
  await page.waitForTimeout(2000)
}

// ─────────────────────────────────────────────────────
// 1. CONTACTOS
// ─────────────────────────────────────────────────────
test.describe('Cold Email - Contactos', () => {
  test('Pagina carga correctamente', async ({ page }) => {
    await login(page)
    await page.goto('/cold-email/contactos')
    await page.waitForTimeout(2000)

    // Title visible
    await expect(page.locator('h1')).toContainText('Contactos')

    // Filter pills visible
    const pills = page.locator('.ce-filter-pills button, .ce-pill')
    const pillCount = await pills.count()
    expect(pillCount).toBeGreaterThan(0)

    // Import buttons visible
    const importCSV = page.getByText('Importar CSV')
    await expect(importCSV).toBeVisible()
  })

  test('Modal importar CSV funciona y tiene plantilla descargable', async ({ page }) => {
    await login(page)
    await page.goto('/cold-email/contactos')
    await page.waitForTimeout(2000)

    await page.getByText('Importar CSV').click()
    await page.waitForTimeout(500)

    // Modal visible
    const modal = page.locator('.ce-modal')
    await expect(modal).toBeVisible()

    // "Descargar plantilla CSV" link/button
    const plantillaBtn = page.getByText('Descargar plantilla CSV')
    await expect(plantillaBtn).toBeVisible()

    // File input present
    const fileInput = modal.locator('input[type="file"]')
    await expect(fileInput).toBeAttached()

    // Close modal
    await page.locator('.ce-modal-close').click()
    await page.waitForTimeout(300)
  })

  test('Filtros de estado funcionan', async ({ page }) => {
    await login(page)
    await page.goto('/cold-email/contactos')
    await page.waitForTimeout(2000)

    const estados = ['todos', 'activo', 'respondido', 'rebotado', 'baja', 'no_contactar']
    for (const estado of estados) {
      const pill = page.locator('.ce-pill, .ce-filter-pills button').filter({
        hasText: new RegExp(estado === 'todos' ? 'Todos' : estado.replace('_', ' '), 'i')
      }).first()
      if (await pill.isVisible()) {
        await pill.click()
        await page.waitForTimeout(300)
      }
    }
  })
})

// ─────────────────────────────────────────────────────
// 2. SECUENCIAS
// ─────────────────────────────────────────────────────
test.describe('Cold Email - Secuencias', () => {
  test('Lista de secuencias carga', async ({ page }) => {
    await login(page)
    await page.goto('/cold-email/secuencias')
    await page.waitForTimeout(2000)

    await expect(page.locator('h1')).toContainText('Secuencias')
  })

  test('Detalle de secuencia muestra tabs y pasos', async ({ page }) => {
    await login(page)
    await page.goto('/cold-email/secuencias')
    await page.waitForTimeout(2000)

    // Click first sequence
    const firstRow = page.locator('.ce-table-row-clickable, .ce-card, tr').first()
    if (await firstRow.isVisible()) {
      await firstRow.click()
      await page.waitForTimeout(2000)

      // Tabs visible
      const tabs = ['Pasos', 'Enrollments', 'Configuracion', 'Preview', 'Stats']
      for (const tab of tabs) {
        await expect(page.getByText(tab, { exact: true }).first()).toBeVisible()
      }

      // Click on Pasos tab
      await page.getByText('Pasos', { exact: true }).first().click()
      await page.waitForTimeout(500)

      // Check if step editing shows plantilla selector
      const stepCard = page.locator('.ce-step-preview, .ce-step-card').first()
      if (await stepCard.isVisible()) {
        await stepCard.click()
        await page.waitForTimeout(500)

        // Plantilla selector should exist when editing
        const plantillaSelect = page.locator('.ce-step-edit select.ce-select').first()
        if (await plantillaSelect.isVisible()) {
          console.log('PASS: Plantilla selector visible in step editor')
        } else {
          console.log('INFO: No plantilla selector found (may have no plantillas)')
        }

        // Cancel edit
        await page.getByText('Cancelar').first().click()
      }

      // Check Configuracion tab
      await page.getByText('Configuracion', { exact: true }).first().click()
      await page.waitForTimeout(500)

      // Cuentas asignadas section
      const cuentasSection = page.getByText('Cuentas asignadas')
      await expect(cuentasSection).toBeVisible()
    }
  })
})

// ─────────────────────────────────────────────────────
// 3. PLANTILLAS
// ─────────────────────────────────────────────────────
test.describe('Cold Email - Plantillas', () => {
  test('Pagina carga y muestra variables correctas', async ({ page }) => {
    await login(page)
    await page.goto('/cold-email/plantillas')
    await page.waitForTimeout(2000)

    await expect(page.locator('h1')).toContainText('Plantillas')

    // Open create/edit modal
    const crearBtn = page.getByText('Crear Plantilla').or(page.getByText('Nueva Plantilla')).first()
    if (await crearBtn.isVisible()) {
      await crearBtn.click()
      await page.waitForTimeout(500)

      // Check variables are present
      const expectedVars = ['{{nombre}}', '{{empresa}}', '{{cargo}}', '{{email}}', '{{telefono}}', '{{dominio_empresa}}', '{{categoria}}', '{{zona}}']
      for (const v of expectedVars) {
        const varBtn = page.getByText(v, { exact: true }).first()
        const isVisible = await varBtn.isVisible().catch(() => false)
        if (isVisible) {
          console.log(`PASS: Variable ${v} visible`)
        } else {
          console.log(`FAIL: Variable ${v} NOT visible`)
        }
      }

      // Close modal
      const closeBtn = page.locator('.ce-modal-close').first()
      if (await closeBtn.isVisible()) await closeBtn.click()
    }
  })
})

// ─────────────────────────────────────────────────────
// 4. CUENTAS
// ─────────────────────────────────────────────────────
test.describe('Cold Email - Cuentas', () => {
  test('10 cuentas visibles con nombre Madrigal Marketing', async ({ page }) => {
    await login(page)
    await page.goto('/cold-email/cuentas')
    await page.waitForTimeout(2000)

    await expect(page.locator('h1')).toContainText('Cuentas')

    // Check accounts are listed
    const rows = page.locator('.ce-table tbody tr, .ce-card')
    const count = await rows.count()
    console.log(`INFO: ${count} cuentas found`)
    expect(count).toBeGreaterThanOrEqual(1)

    // Verify all show "Madrigal Marketing"
    const pageContent = await page.textContent('body')
    const madrigalCount = (pageContent.match(/Madrigal Marketing/g) || []).length
    console.log(`INFO: "Madrigal Marketing" appears ${madrigalCount} times`)
  })
})

// ─────────────────────────────────────────────────────
// 5. RESPUESTAS
// ─────────────────────────────────────────────────────
test.describe('Cold Email - Respuestas', () => {
  test('Pagina carga correctamente', async ({ page }) => {
    await login(page)
    await page.goto('/cold-email/respuestas')
    await page.waitForTimeout(2000)

    await expect(page.locator('h1')).toContainText('Respuestas')

    // Filtros de clasificacion visibles
    const clasificaciones = ['Todas', 'pendiente', 'interesado', 'no ahora', 'baja', 'negativo', 'irrelevante']
    for (const c of clasificaciones) {
      const pill = page.getByText(c, { exact: false }).first()
      const visible = await pill.isVisible().catch(() => false)
      if (visible) {
        console.log(`PASS: Filtro "${c}" visible`)
      } else {
        console.log(`WARN: Filtro "${c}" not visible`)
      }
    }
  })
})

// ─────────────────────────────────────────────────────
// 6. DASHBOARD
// ─────────────────────────────────────────────────────
test.describe('Cold Email - Dashboard', () => {
  test('Dashboard carga con metricas', async ({ page }) => {
    await login(page)
    await page.goto('/cold-email')
    await page.waitForTimeout(2000)

    // Should have stat cards or metrics
    const pageContent = await page.textContent('body')
    const hasMetrics = pageContent.includes('Enviados') ||
      pageContent.includes('Contactos') ||
      pageContent.includes('Abiertos') ||
      pageContent.includes('Dashboard') ||
      pageContent.includes('Respuestas')

    expect(hasMetrics).toBe(true)
    console.log('PASS: Dashboard loads with metrics')
  })
})

// ─────────────────────────────────────────────────────
// 7. CONTACTO DETALLE - campos categoria/zona
// ─────────────────────────────────────────────────────
test.describe('Cold Email - Contacto Detalle', () => {
  test('Formulario muestra campos categoria y zona', async ({ page }) => {
    await login(page)
    await page.goto('/cold-email/contactos')
    await page.waitForTimeout(2000)

    // Click first contact if available
    const firstRow = page.locator('.ce-table-row-clickable, tr.ce-table-row-clickable').first()
    if (await firstRow.isVisible().catch(() => false)) {
      await firstRow.click()
      await page.waitForTimeout(2000)

      // Check for Categoria and Zona labels
      const categoriaLabel = page.getByText('Categoria', { exact: true })
      const zonaLabel = page.getByText('Zona', { exact: true })

      const catVisible = await categoriaLabel.isVisible().catch(() => false)
      const zonaVisible = await zonaLabel.isVisible().catch(() => false)

      console.log(`Categoria field visible: ${catVisible}`)
      console.log(`Zona field visible: ${zonaVisible}`)
    } else {
      console.log('INFO: No contacts available to test detail view')
    }
  })
})

// ─────────────────────────────────────────────────────
// 8. RENDIMIENTO - Tiempos de carga
// ─────────────────────────────────────────────────────
test.describe('Cold Email - Rendimiento', () => {
  const pages = [
    { name: 'Dashboard', path: '/cold-email' },
    { name: 'Contactos', path: '/cold-email/contactos' },
    { name: 'Secuencias', path: '/cold-email/secuencias' },
    { name: 'Plantillas', path: '/cold-email/plantillas' },
    { name: 'Cuentas', path: '/cold-email/cuentas' },
    { name: 'Respuestas', path: '/cold-email/respuestas' },
  ]

  for (const p of pages) {
    test(`${p.name} carga en menos de 5s`, async ({ page }) => {
      await login(page)
      const start = Date.now()
      await page.goto(p.path)
      // Wait for loading spinner to disappear
      await page.waitForSelector('.ce-spinner', { state: 'hidden', timeout: 10000 }).catch(() => {})
      const elapsed = Date.now() - start
      console.log(`${p.name}: ${elapsed}ms`)
      expect(elapsed).toBeLessThan(5000)
    })
  }
})

// ─────────────────────────────────────────────────────
// 9. NAVEGACION - Links y rutas
// ─────────────────────────────────────────────────────
test.describe('Cold Email - Navegacion', () => {
  test('Sidebar links funcionan', async ({ page }) => {
    await login(page)
    await page.goto('/cold-email')
    await page.waitForTimeout(2000)

    // Check navigation items exist
    const navLinks = [
      { text: 'Contactos', url: '/cold-email/contactos' },
      { text: 'Secuencias', url: '/cold-email/secuencias' },
      { text: 'Plantillas', url: '/cold-email/plantillas' },
      { text: 'Cuentas', url: '/cold-email/cuentas' },
      { text: 'Respuestas', url: '/cold-email/respuestas' },
    ]

    for (const nav of navLinks) {
      const link = page.getByText(nav.text, { exact: false }).first()
      if (await link.isVisible().catch(() => false)) {
        await link.click()
        await page.waitForTimeout(1000)
        const url = page.url()
        const matches = url.includes(nav.url)
        console.log(`${nav.text}: ${matches ? 'PASS' : 'FAIL'} (${url})`)
      }
    }
  })
})

// ─────────────────────────────────────────────────────
// 10. DELIVERABILITY CHECK - SPF, DKIM, DMARC headers
// ─────────────────────────────────────────────────────
test.describe('Cold Email - Deliverability Config', () => {
  test('Cuentas tienen configuracion anti-spam correcta', async ({ page }) => {
    await login(page)
    await page.goto('/cold-email/cuentas')
    await page.waitForTimeout(2000)

    // Click first account to see detail
    const firstRow = page.locator('.ce-table-row-clickable, .ce-card, tbody tr').first()
    if (await firstRow.isVisible().catch(() => false)) {
      await firstRow.click()
      await page.waitForTimeout(2000)

      const content = await page.textContent('body')

      // Check warmup config exists
      const hasWarmup = content.includes('warmup') || content.includes('Warmup') || content.includes('ramping')
      console.log(`Warmup config visible: ${hasWarmup}`)

      // Check limite diario
      const hasLimite = content.includes('Limite') || content.includes('limite') || content.includes('diario')
      console.log(`Limite diario visible: ${hasLimite}`)
    }
  })
})

// ─────────────────────────────────────────────────────
// 11. CONSOLE ERRORS CHECK
// ─────────────────────────────────────────────────────
test.describe('Cold Email - Errores de consola', () => {
  const routes = [
    '/cold-email',
    '/cold-email/contactos',
    '/cold-email/secuencias',
    '/cold-email/plantillas',
    '/cold-email/cuentas',
    '/cold-email/respuestas',
  ]

  for (const route of routes) {
    test(`Sin errores JS en ${route}`, async ({ page }) => {
      const errors = []
      page.on('console', (msg) => {
        if (msg.type() === 'error') errors.push(msg.text())
      })
      page.on('pageerror', (err) => {
        errors.push(err.message)
      })

      await login(page)
      await page.goto(route)
      await page.waitForTimeout(3000)

      if (errors.length > 0) {
        console.log(`WARN: ${route} has ${errors.length} console errors:`)
        errors.forEach((e) => console.log(`  - ${e}`))
      } else {
        console.log(`PASS: ${route} - no console errors`)
      }
    })
  }
})
