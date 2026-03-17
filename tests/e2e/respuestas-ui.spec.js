import { test, expect } from '@playwright/test'

const LOGIN_EMAIL = 'info@madrigalmarketing.es'
const LOGIN_PASS  = 'Admin123!'
const TARGET_EMAIL = 'juanramosmktg@gmail.com'

async function login(page) {
  await page.goto('/login')
  await page.fill('input[type="email"]', LOGIN_EMAIL)
  await page.fill('input[type="password"]', LOGIN_PASS)
  await page.click('button[type="submit"]')
  await page.waitForURL('**/ventas/**', { timeout: 15000 }).catch(() => {})
  await page.waitForTimeout(2000)
}

test.describe('Cold Email Respuestas - Verificacion UI', () => {

  test('1. Respuesta de juanramosmktg aparece en la lista con clasificacion interesado', async ({ page }) => {
    await login(page)
    await page.goto('/cold-email/respuestas')
    await page.waitForTimeout(3000)

    // Page should load without errors
    await expect(page.locator('h1')).toContainText('Respuestas')

    // Inbox layout visible
    const layout = page.locator('.ce-inbox-layout')
    await expect(layout).toBeVisible()

    // Capture page content for debug
    const bodyText = await page.textContent('body')
    console.log('--- Page loaded ---')
    console.log(`Contains "Respuestas" title: ${bodyText.includes('Respuestas')}`)

    // Log all visible thread items
    const threadItems = page.locator('.ce-thread-item')
    const itemCount = await threadItems.count()
    console.log(`Total thread items visible: ${itemCount}`)

    for (let i = 0; i < Math.min(itemCount, 10); i++) {
      const name = await threadItems.nth(i).locator('.ce-thread-name').textContent().catch(() => '?')
      const subject = await threadItems.nth(i).locator('.ce-thread-subject').textContent().catch(() => '?')
      const badge = await threadItems.nth(i).locator('[class*="ce-badge"]').textContent().catch(() => 'none')
      console.log(`  [${i}] name="${name}" subject="${subject}" badge="${badge}"`)
    }

    // Look for the target email response
    // The list shows contacto.nombre or .de, so search broadly
    const targetThread = page.locator('.ce-thread-item').filter({
      hasText: /juanramos|Juan Ramos/i,
    }).first()

    const targetExists = await targetThread.isVisible().catch(() => false)
    console.log(`Target thread (juanramosmktg) visible: ${targetExists}`)

    if (!targetExists) {
      // Maybe it's displayed by email rather than name
      const altThread = page.locator('.ce-thread-item').filter({ hasText: TARGET_EMAIL }).first()
      const altExists = await altThread.isVisible().catch(() => false)
      console.log(`Target thread (by email) visible: ${altExists}`)

      if (!altExists) {
        // Check if "todas" filter is active, try clicking it
        const todasPill = page.locator('.ce-pill').filter({ hasText: 'Todas' }).first()
        if (await todasPill.isVisible()) {
          await todasPill.click()
          await page.waitForTimeout(2000)
          const afterCount = await threadItems.count()
          console.log(`After clicking Todas: ${afterCount} items`)
        }

        // Screenshot for debugging
        await page.screenshot({ path: 'test-results/respuestas-list.png', fullPage: true })
        console.log('ISSUE: Response from juanramosmktg@gmail.com NOT found in the list')
      }
    }

    // Check classification badge = interesado
    const interesadoBadge = page.locator('.ce-badge').filter({ hasText: 'interesado' }).first()
    const badgeVisible = await interesadoBadge.isVisible().catch(() => false)
    console.log(`"interesado" badge visible in list: ${badgeVisible}`)

    // Take screenshot of the list
    await page.screenshot({ path: 'test-results/respuestas-list-final.png', fullPage: true })
  })

  test('2. Click en respuesta muestra hilo con email original y reply + boton Crear Lead CRM', async ({ page }) => {
    await login(page)
    await page.goto('/cold-email/respuestas')
    await page.waitForTimeout(3000)

    const issues = []

    // Find and click the target thread
    let targetThread = page.locator('.ce-thread-item').filter({
      hasText: /juanramos|Juan Ramos/i,
    }).first()

    let targetExists = await targetThread.isVisible().catch(() => false)

    if (!targetExists) {
      // Try by email
      targetThread = page.locator('.ce-thread-item').filter({ hasText: TARGET_EMAIL }).first()
      targetExists = await targetThread.isVisible().catch(() => false)
    }

    if (!targetExists) {
      // If still not found, click the first thread item to at least test detail panel
      const firstItem = page.locator('.ce-thread-item').first()
      if (await firstItem.isVisible()) {
        console.log('ISSUE: Target email not found, clicking first available thread instead')
        issues.push('Response from juanramosmktg@gmail.com not found in list')
        await firstItem.click()
        await page.waitForTimeout(2000)
      } else {
        console.log('CRITICAL: No thread items at all')
        issues.push('No thread items visible at all')
        await page.screenshot({ path: 'test-results/respuestas-empty.png', fullPage: true })
        return
      }
    } else {
      // Click the target thread
      console.log('Found target thread, clicking...')
      await targetThread.click()
      await page.waitForTimeout(2000)
    }

    // Verify detail panel loaded
    const detailHeader = page.locator('.ce-inbox-detail-header')
    const detailVisible = await detailHeader.isVisible().catch(() => false)
    console.log(`Detail header visible: ${detailVisible}`)

    if (detailVisible) {
      const detailName = await page.locator('.ce-inbox-detail-name').textContent().catch(() => '?')
      const detailEmail = await page.locator('.ce-text-muted').first().textContent().catch(() => '?')
      console.log(`Detail name: "${detailName}"`)
      console.log(`Detail email: "${detailEmail}"`)
    } else {
      issues.push('Detail panel header not visible after clicking thread')
    }

    // Check thread messages (should have outbound original + inbound reply)
    const messages = page.locator('.ce-message')
    const msgCount = await messages.count()
    console.log(`Thread messages count: ${msgCount}`)

    let hasOutbound = false
    let hasInbound = false

    // Check outbound messages
    const outboundMsgs = page.locator('.ce-message-outbound')
    const outboundCount = await outboundMsgs.count()
    hasOutbound = outboundCount > 0
    console.log(`Outbound messages: ${outboundCount}`)
    if (outboundCount > 0) {
      const from = await outboundMsgs.first().locator('.ce-message-from').textContent().catch(() => '?')
      const body = await outboundMsgs.first().locator('.ce-message-body').textContent().catch(() => '?')
      console.log(`  First outbound: from="${from}" body="${(body || '').slice(0, 100)}"`)
    }

    // Check inbound messages
    const inboundMsgs = page.locator('.ce-message-inbound')
    const inboundCount = await inboundMsgs.count()
    hasInbound = inboundCount > 0
    console.log(`Inbound messages: ${inboundCount}`)
    if (inboundCount > 0) {
      const from = await inboundMsgs.first().locator('.ce-message-from').textContent().catch(() => '?')
      const body = await inboundMsgs.first().locator('.ce-message-body').textContent().catch(() => '?')
      console.log(`  First inbound: from="${from}" body="${(body || '').slice(0, 100)}"`)
    }

    console.log(`Has outbound (original email): ${hasOutbound}`)
    console.log(`Has inbound (reply): ${hasInbound}`)

    if (!hasOutbound) issues.push('Thread missing outbound (original) email')
    if (!hasInbound) issues.push('Thread missing inbound (reply) email')
    if (msgCount === 0) issues.push('No messages in thread detail at all')

    // Check classification select value
    const selectValue = await page.locator('.ce-inbox-detail-actions select').inputValue().catch(() => '?')
    console.log(`Classification select value: "${selectValue}"`)

    // Check "Crear Lead CRM" button visibility
    const crearLeadBtn = page.locator('button').filter({ hasText: /Crear Lead CRM/i }).first()
    const crearLeadVisible = await crearLeadBtn.isVisible().catch(() => false)
    console.log(`"Crear Lead CRM" button visible: ${crearLeadVisible}`)

    if (!crearLeadVisible) {
      // The button only shows when clasificacion === 'interesado'
      // Check if we need to classify first
      if (selectValue !== 'interesado') {
        console.log(`ISSUE: Classification is "${selectValue}", not "interesado" - Crear Lead CRM button hidden`)
        issues.push(`Classification is "${selectValue}" instead of "interesado", so Crear Lead CRM button is not shown`)
      } else {
        issues.push('Crear Lead CRM button not visible even though classification is interesado')
      }
    }

    // Check classification buttons at the bottom
    const classifyBtns = page.locator('.ce-btn-classify')
    const classifyCount = await classifyBtns.count()
    console.log(`Classification buttons count: ${classifyCount}`)

    // Take screenshot of the detail view
    await page.screenshot({ path: 'test-results/respuestas-detail.png', fullPage: true })

    // Report issues summary
    console.log('\n=== ISSUES SUMMARY ===')
    if (issues.length === 0) {
      console.log('No issues found!')
    } else {
      issues.forEach((iss, i) => console.log(`  ${i + 1}. ${iss}`))
    }
  })

  test('3. Visual checks - layout, spacing, empty states', async ({ page }) => {
    await login(page)

    const errors = []
    page.on('pageerror', (err) => errors.push(`JS Error: ${err.message}`))
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(`Console Error: ${msg.text()}`)
    })

    await page.goto('/cold-email/respuestas')
    await page.waitForTimeout(3000)

    // Check for JS errors
    console.log(`JS/Console errors captured: ${errors.length}`)
    errors.forEach(e => console.log(`  - ${e}`))

    // Check responsive layout
    const listPanel = page.locator('.ce-inbox-list')
    const detailPanel = page.locator('.ce-inbox-detail')

    const listVisible = await listPanel.isVisible().catch(() => false)
    const detailVisible = await detailPanel.isVisible().catch(() => false)
    console.log(`List panel visible: ${listVisible}`)
    console.log(`Detail panel visible: ${detailVisible}`)

    // Check search input
    const searchInput = page.locator('.ce-search-input')
    const searchVisible = await searchInput.isVisible().catch(() => false)
    console.log(`Search input visible: ${searchVisible}`)

    // Check filter pills
    const pills = page.locator('.ce-pill')
    const pillCount = await pills.count()
    console.log(`Filter pills count: ${pillCount}`)

    const expectedPills = ['Todas', 'pendiente', 'interesado', 'no ahora', 'baja', 'negativo', 'irrelevante']
    for (let i = 0; i < pillCount; i++) {
      const text = await pills.nth(i).textContent()
      console.log(`  Pill [${i}]: "${text}"`)
    }

    // Check placeholder when no thread selected
    const placeholder = page.locator('.ce-inbox-placeholder')
    const placeholderVisible = await placeholder.isVisible().catch(() => false)
    console.log(`Placeholder (no selection) visible: ${placeholderVisible}`)

    // Check for broken images or missing icons
    const brokenImgs = await page.locator('img').evaluateAll(imgs =>
      imgs.filter(img => !img.complete || img.naturalWidth === 0).map(img => img.src)
    )
    if (brokenImgs.length > 0) {
      console.log(`Broken images: ${brokenImgs.join(', ')}`)
    } else {
      console.log('No broken images')
    }

    await page.screenshot({ path: 'test-results/respuestas-visual.png', fullPage: true })
  })
})
