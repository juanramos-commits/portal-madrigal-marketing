import { test, expect } from '@playwright/test'

const EMAIL = 'info@madrigalmarketing.es'
const PASS = 'Admin123!'

async function login(page) {
  await page.goto('/')
  await page.fill('input[type="email"]', EMAIL)
  await page.fill('input[type="password"]', PASS)
  await page.click('button[type="submit"]')
  await page.waitForURL(/.*(?:dashboard|ventas|crm).*/, { timeout: 15000 })
}

test.describe('CRM Pipeline persistence on back navigation', () => {
  test('should stay on closer pipeline after viewing a lead and going back', async ({ page }) => {
    await login(page)

    // Navigate to CRM
    await page.goto('/ventas/crm')
    await page.waitForSelector('.crm-kanban, .crm-loading', { timeout: 15000 })
    await page.waitForSelector('.crm-kanban', { timeout: 15000 })

    // Check if there are pipeline tabs
    const tabs = page.locator('.crm-pipeline-tab')
    const tabCount = await tabs.count()

    if (tabCount < 2) {
      test.skip('Only one pipeline — cannot test pipeline switching')
      return
    }

    // Find and click the closer pipeline tab
    let closerTab = null
    for (let i = 0; i < tabCount; i++) {
      const text = await tabs.nth(i).textContent()
      if (text.toLowerCase().includes('closer')) {
        closerTab = tabs.nth(i)
        break
      }
    }

    if (!closerTab) {
      test.skip('No closer pipeline found')
      return
    }

    await closerTab.click()
    await page.waitForTimeout(1500) // wait for leads to load

    // Verify closer tab is active
    await expect(closerTab).toHaveClass(/active/)

    // Click on the first lead card
    const firstCard = page.locator('.crm-card').first()
    const cardExists = await firstCard.count()
    if (cardExists === 0) {
      test.skip('No leads in closer pipeline')
      return
    }

    await firstCard.click()
    await page.waitForURL(/.*lead\/.*/, { timeout: 10000 })

    // Go back
    await page.goBack()
    await page.waitForSelector('.crm-kanban', { timeout: 15000 })

    // Verify we're still on the closer pipeline
    const activeTab = page.locator('.crm-pipeline-tab.active')
    const activeText = await activeTab.textContent()
    expect(activeText.toLowerCase()).toContain('closer')
  })

  test('avatar should show correct initials (2 letters for single names)', async ({ page }) => {
    await login(page)
    await page.goto('/ventas/crm')
    await page.waitForSelector('.crm-kanban', { timeout: 15000 })

    // Find any avatar that's visible
    const avatars = page.locator('.crm-card-avatar')
    const avatarCount = await avatars.count()

    if (avatarCount === 0) {
      test.skip('No assignee avatars visible')
      return
    }

    // Verify all avatars have at least 2 characters
    for (let i = 0; i < Math.min(avatarCount, 10); i++) {
      const text = await avatars.nth(i).textContent()
      expect(text.trim().length).toBeGreaterThanOrEqual(2)
    }
  })
})
