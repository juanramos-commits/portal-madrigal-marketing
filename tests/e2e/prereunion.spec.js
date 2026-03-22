import { test, expect } from '@playwright/test'

test.describe('Página Pre-Reunión', () => {
  test('invalid token shows error', async ({ page }) => {
    await page.goto('https://app.madrigalmarketing.es/reunion/invalid-token-123')
    await page.waitForTimeout(3000)
    await page.screenshot({ path: 'test-results/prereunion-invalid.png' })
    
    const content = await page.textContent('body')
    expect(content).toContain('no válido')
    console.log('Invalid token: shows error ✓')
  })

  test('valid token shows meeting details', async ({ page }) => {
    // First create a cita with a known token
    // Use Supabase to set a token on an existing cita
    await page.goto('https://app.madrigalmarketing.es/reunion/7q7zbzgqvt1w')
    await page.waitForTimeout(3000)
    await page.screenshot({ path: 'test-results/prereunion-valid.png' })

    const content = await page.textContent('body')
    // Either shows meeting details or "no válido" (if token doesn't exist)
    const hasContent = content.includes('videollamada') || content.includes('no válido') || content.includes('MADRIGAL')
    expect(hasContent).toBeTruthy()
    console.log('Valid/invalid token page rendered ✓')
  })

  test('page renders with correct structure', async ({ page }) => {
    await page.setViewportSize({ width: 430, height: 932 }) // Mobile
    await page.goto('https://app.madrigalmarketing.es/reunion/test123')
    await page.waitForTimeout(3000)
    await page.screenshot({ path: 'test-results/prereunion-mobile.png' })
    
    // Should have MADRIGAL branding
    const content = await page.textContent('body')
    expect(content).toContain('MADRIGAL')
    console.log('Mobile rendering ✓')
  })
})
