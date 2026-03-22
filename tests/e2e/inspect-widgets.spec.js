import { test } from '@playwright/test'

const EMAIL = 'info@madrigalmarketing.es'
const PASS = 'Admin123!'

test('inspect all dashboard widgets', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 })
  await page.goto('https://app.madrigalmarketing.es')
  await page.fill('input[type="email"]', EMAIL)
  await page.fill('input[type="password"]', PASS)
  await page.click('button[type="submit"]')
  await page.waitForURL(/.*(?:dashboard|ventas).*/, { timeout: 15000 })

  await page.goto('https://app.madrigalmarketing.es/ventas/dashboard')
  await page.waitForTimeout(4000)

  await page.screenshot({ path: 'test-results/dash-top.png' })

  // Scroll inside .page container
  await page.evaluate(() => { const p = document.querySelector('.page'); if (p) p.scrollTop = 600 })
  await page.waitForTimeout(500)
  await page.screenshot({ path: 'test-results/dash-mid1.png' })

  await page.evaluate(() => { const p = document.querySelector('.page'); if (p) p.scrollTop = 1200 })
  await page.waitForTimeout(500)
  await page.screenshot({ path: 'test-results/dash-mid2.png' })

  await page.evaluate(() => { const p = document.querySelector('.page'); if (p) p.scrollTop = 1800 })
  await page.waitForTimeout(500)
  await page.screenshot({ path: 'test-results/dash-mid3.png' })

  await page.evaluate(() => { const p = document.querySelector('.page'); if (p) p.scrollTop = 2400 })
  await page.waitForTimeout(500)
  await page.screenshot({ path: 'test-results/dash-bottom1.png' })

  await page.evaluate(() => { const p = document.querySelector('.page'); if (p) p.scrollTop = 3200 })
  await page.waitForTimeout(500)
  await page.screenshot({ path: 'test-results/dash-bottom2.png' })

  await page.evaluate(() => { const p = document.querySelector('.page'); if (p) p.scrollTop = 99999 })
  await page.waitForTimeout(500)
  await page.screenshot({ path: 'test-results/dash-bottom3.png' })

  // Inspect all widgets
  const analysis = await page.evaluate(() => {
    const results = {}

    // All grid items
    const items = document.querySelectorAll('.react-grid-item')
    results.gridItems = Array.from(items).map(item => {
      const title = item.querySelector('.db-wshell-title')?.textContent?.trim() || 'unknown'
      const rect = item.getBoundingClientRect()
      const body = item.querySelector('.db-wshell-body')
      const bodyRect = body?.getBoundingClientRect()
      return {
        title,
        width: Math.round(rect.width),
        height: Math.round(rect.height),
        bodyHeight: bodyRect ? Math.round(bodyRect.height) : 0,
      }
    })

    // Desglose specific
    const desgloseScroll = document.querySelectorAll('.db-wdesglose-scroll')
    results.desglose = Array.from(desgloseScroll).map((el, i) => {
      const table = el.querySelector('table')
      const parent = el.closest('.react-grid-item')
      const title = parent?.querySelector('.db-wshell-title')?.textContent?.trim()
      return {
        title,
        scrollWidth: el.scrollWidth,
        clientWidth: el.clientWidth,
        tableWidth: Math.round(table?.getBoundingClientRect().width || 0),
        hasHorizontalScroll: el.scrollWidth > el.clientWidth,
        parentHeight: Math.round(parent?.getBoundingClientRect().height || 0),
      }
    })

    // All table column alignment
    const tables = document.querySelectorAll('.db-wtable')
    results.tables = Array.from(tables).map((table, i) => {
      const parent = table.closest('.react-grid-item')
      const title = parent?.querySelector('.db-wshell-title')?.textContent?.trim() || `table-${i}`
      const ths = Array.from(table.querySelectorAll('thead th'))
      return {
        title,
        colCount: ths.length,
        headerAligns: ths.map(th => ({ text: th.textContent?.trim(), align: getComputedStyle(th).textAlign })),
      }
    })

    return results
  })

  console.log(JSON.stringify(analysis, null, 2))
})
