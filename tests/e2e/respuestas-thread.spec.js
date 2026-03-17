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

test.describe('Respuestas Thread - Outbound message shows real email content', () => {

  test('Outbound message shows actual email subject and body, NOT "Email enviado"', async ({ page }) => {
    await login(page)
    await page.goto('/cold-email/respuestas')
    await page.waitForTimeout(3000)

    // Find the thread for Juan Ramos / juanramosmktg@gmail.com
    let targetThread = page.locator('.ce-thread-item').filter({
      hasText: /juanramos|Juan Ramos/i,
    }).first()

    let targetExists = await targetThread.isVisible().catch(() => false)

    if (!targetExists) {
      targetThread = page.locator('.ce-thread-item').filter({ hasText: TARGET_EMAIL }).first()
      targetExists = await targetThread.isVisible().catch(() => false)
    }

    if (!targetExists) {
      // Try clicking "Todas" filter first
      const todasPill = page.locator('.ce-pill').filter({ hasText: 'Todas' }).first()
      if (await todasPill.isVisible()) {
        await todasPill.click()
        await page.waitForTimeout(2000)
      }
      targetThread = page.locator('.ce-thread-item').filter({
        hasText: /juanramos|Juan Ramos/i,
      }).first()
      targetExists = await targetThread.isVisible().catch(() => false)
    }

    console.log(`Target thread found: ${targetExists}`)

    if (!targetExists) {
      await page.screenshot({ path: 'test-results/respuestas-thread-not-found.png', fullPage: true })
      throw new Error('Thread for Juan Ramos / juanramosmktg@gmail.com not found in respuestas list')
    }

    // Click on the thread
    await targetThread.click()
    await page.waitForTimeout(2000)

    // Screenshot the detail panel
    await page.screenshot({ path: 'test-results/respuestas-thread-detail.png', fullPage: true })

    // --- Inspect ALL messages in the thread ---
    const allMessages = page.locator('.ce-message')
    const totalMsgCount = await allMessages.count()
    console.log(`\n=== THREAD MESSAGES (total: ${totalMsgCount}) ===`)

    for (let i = 0; i < totalMsgCount; i++) {
      const msg = allMessages.nth(i)
      const classes = await msg.getAttribute('class')
      const isOutbound = classes?.includes('outbound')
      const isInbound = classes?.includes('inbound')
      const direction = isOutbound ? 'OUTBOUND' : isInbound ? 'INBOUND' : 'UNKNOWN'

      const fromText = await msg.locator('.ce-message-from').textContent().catch(() => '[no from]')
      const subjectText = await msg.locator('.ce-message-subject').textContent().catch(() => '[no subject element]')
      const bodyText = await msg.locator('.ce-message-body').textContent().catch(() => '[no body element]')
      const fullText = await msg.textContent().catch(() => '[empty]')

      console.log(`\n--- Message [${i}] (${direction}) ---`)
      console.log(`  From:    ${fromText}`)
      console.log(`  Subject: ${subjectText}`)
      console.log(`  Body:    ${(bodyText || '').slice(0, 300)}`)
      console.log(`  Full:    ${(fullText || '').slice(0, 400)}`)
    }

    // --- Specifically check outbound messages ---
    const outboundMsgs = page.locator('.ce-message-outbound')
    const outboundCount = await outboundMsgs.count()
    console.log(`\n=== OUTBOUND MESSAGES: ${outboundCount} ===`)

    let foundEmailEnviado = false
    let foundRealContent = false

    for (let i = 0; i < outboundCount; i++) {
      const msg = outboundMsgs.nth(i)
      const fullText = await msg.textContent().catch(() => '')
      const bodyText = await msg.locator('.ce-message-body').textContent().catch(() => '')
      const subjectText = await msg.locator('.ce-message-subject').textContent().catch(() => '')

      console.log(`\nOutbound [${i}]:`)
      console.log(`  Subject element: "${subjectText}"`)
      console.log(`  Body element:    "${(bodyText || '').slice(0, 300)}"`)
      console.log(`  Full text:       "${(fullText || '').slice(0, 400)}"`)

      // Check for the old placeholder
      if (fullText.includes('Email enviado')) {
        foundEmailEnviado = true
        console.log('  >>> PROBLEM: Contains "Email enviado" placeholder!')
      }

      // Check for real email content
      if (fullText.includes('Una pregunta') || fullText.includes('pregunta rápida')) {
        foundRealContent = true
        console.log('  >>> GOOD: Contains real email subject "Una pregunta rápida"')
      }
    }

    // Also check if there are messages without the outbound class but that are outbound
    const detailPanel = page.locator('.ce-inbox-detail')
    const detailText = await detailPanel.textContent().catch(() => '')
    console.log(`\n=== FULL DETAIL PANEL TEXT (first 800 chars) ===`)
    console.log(detailText.slice(0, 800))

    const panelHasEmailEnviado = detailText.includes('Email enviado')
    const panelHasRealSubject = detailText.includes('Una pregunta') || detailText.includes('pregunta rápida')

    console.log(`\n=== VERIFICATION RESULTS ===`)
    console.log(`Panel contains "Email enviado":      ${panelHasEmailEnviado}`)
    console.log(`Panel contains real subject:         ${panelHasRealSubject}`)
    console.log(`Outbound msg has "Email enviado":    ${foundEmailEnviado}`)
    console.log(`Outbound msg has real content:       ${foundRealContent}`)

    // Take final screenshot
    await page.screenshot({ path: 'test-results/respuestas-thread-final.png', fullPage: true })

    // The test assertion: outbound should NOT say "Email enviado" and SHOULD have real content
    if (panelHasEmailEnviado) {
      console.log('\nFAIL: The outbound message still shows "Email enviado" placeholder')
    }
    if (panelHasRealSubject) {
      console.log('\nPASS: The outbound message shows the actual email subject')
    }

    // Soft assertion - report but also fail the test if "Email enviado" is present
    expect(panelHasEmailEnviado, 'Outbound message should NOT contain "Email enviado"').toBe(false)
    expect(panelHasRealSubject, 'Outbound message should contain real email subject like "Una pregunta rápida"').toBe(true)
  })
})
