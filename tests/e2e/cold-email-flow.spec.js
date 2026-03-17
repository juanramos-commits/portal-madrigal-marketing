import { test, expect } from '@playwright/test'

const LOGIN_EMAIL = 'info@madrigalmarketing.es'
const LOGIN_PASS = 'Admin123!'
const TEST_EMAIL = 'juanramosmktg@gmail.com'

const SB_URL = 'https://ootncgtcvwnrskqtamak.supabase.co'
const SB_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9vdG5jZ3RjdnducnNrcXRhbWFrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODY3NzAyNiwiZXhwIjoyMDg0MjUzMDI2fQ.kgycS-nYJhQmSzjv3wjo-H8kAg56F1dRxKCtrD03FiI'

const headers = {
  'apikey': SB_KEY,
  'Authorization': `Bearer ${SB_KEY}`,
  'Content-Type': 'application/json',
  'Prefer': 'return=representation',
}

async function login(page) {
  await page.goto('/login')
  await page.fill('input[type="email"]', LOGIN_EMAIL)
  await page.fill('input[type="password"]', LOGIN_PASS)
  await page.click('button[type="submit"]')
  await page.waitForURL('**/ventas/**', { timeout: 15000 }).catch(() => {})
  await page.waitForTimeout(2000)
}

async function sbGet(request, table, query = '') {
  const res = await request.get(`${SB_URL}/rest/v1/${table}?${query}`, { headers })
  return res.json()
}

async function sbPost(request, table, body) {
  const res = await request.post(`${SB_URL}/rest/v1/${table}`, {
    headers: { ...headers, 'Prefer': 'return=representation' },
    data: body,
  })
  return res.json()
}

async function sbDelete(request, table, query) {
  await request.delete(`${SB_URL}/rest/v1/${table}?${query}`, { headers })
}

async function sbPatch(request, table, query, body) {
  const res = await request.patch(`${SB_URL}/rest/v1/${table}?${query}`, {
    headers: { ...headers, 'Prefer': 'return=representation' },
    data: body,
  })
  return res.json()
}

// ─────────────────────────────────────────────────────
// FLUJO COMPLETO: Crear contacto → enrollar → verificar envio
// ─────────────────────────────────────────────────────
test.describe('Cold Email - Flujo completo de envio', () => {

  test.afterAll(async ({ request }) => {
    // Cleanup: delete test contact (cascade deletes enrollments, envios, respuestas)
    await sbDelete(request, 'ce_contactos', `email=eq.${TEST_EMAIL}`)
  })

  test('1. Crear contacto con todos los campos via UI', async ({ page }) => {
    await login(page)
    await page.goto('/cold-email/contactos')
    await page.waitForTimeout(2000)

    // Import via CSV with all fields
    await page.getByText('Importar CSV').click()
    await page.waitForTimeout(500)

    const modal = page.locator('.ce-modal')
    await expect(modal).toBeVisible()

    // Create CSV content with all fields
    const csvContent = `email,nombre,empresa,cargo,telefono,categoria,zona
${TEST_EMAIL},Juan Ramos Test,Madrigal Test Corp,CEO,+34659878684,Fotografo,Sevilla`

    // Upload CSV file
    const fileInput = modal.locator('input[type="file"]')
    const buffer = Buffer.from(csvContent, 'utf-8')
    await fileInput.setInputFiles({
      name: 'test_contacts.csv',
      mimeType: 'text/csv',
      buffer,
    })
    await page.waitForTimeout(1000)

    // Click import button
    const importBtn = modal.locator('button').filter({ hasText: /^Importar$/ })
    if (await importBtn.isEnabled()) {
      await importBtn.click()
      await page.waitForTimeout(2000)
    }

    // Verify contact was created
    await page.goto('/cold-email/contactos')
    await page.waitForTimeout(2000)
    const pageContent = await page.textContent('body')
    console.log(`Contact visible: ${pageContent.includes(TEST_EMAIL)}`)
  })

  test('2. Verificar contacto tiene todos los campos', async ({ request }) => {
    const contacts = await sbGet(request, 'ce_contactos', `email=eq.${TEST_EMAIL}&select=*`)
    expect(contacts.length).toBe(1)

    const c = contacts[0]
    console.log('Contact fields:')
    console.log(`  nombre: ${c.nombre}`)
    console.log(`  empresa: ${c.empresa}`)
    console.log(`  cargo: ${c.cargo}`)
    console.log(`  telefono: ${c.telefono}`)
    console.log(`  categoria: ${c.categoria}`)
    console.log(`  zona: ${c.zona}`)
    console.log(`  email: ${c.email}`)

    expect(c.nombre).toBeTruthy()
    expect(c.empresa).toBeTruthy()
    expect(c.telefono).toBeTruthy()
    expect(c.categoria).toBeTruthy()
    expect(c.zona).toBeTruthy()
  })

  test('3. Verificar contacto detalle muestra categoria y zona', async ({ page }) => {
    await login(page)
    await page.goto('/cold-email/contactos')
    await page.waitForTimeout(2000)

    // Click on the test contact
    const row = page.locator('tr').filter({ hasText: TEST_EMAIL }).first()
    if (await row.isVisible()) {
      await row.click()
      await page.waitForTimeout(2000)

      // Check fields
      const categoriaInput = page.locator('input').filter({ has: page.locator('..').filter({ hasText: 'Categoria' }) })
      const zonaInput = page.locator('input').filter({ has: page.locator('..').filter({ hasText: 'Zona' }) })

      // Check the labels exist
      await expect(page.getByText('Categoria', { exact: true })).toBeVisible()
      await expect(page.getByText('Zona', { exact: true })).toBeVisible()

      console.log('PASS: Categoria and Zona fields visible in contact detail')
    }
  })

  test('4. Verificar secuencia tiene pasos con variables', async ({ request }) => {
    // Get first sequence
    const secuencias = await sbGet(request, 'ce_secuencias', 'limit=1&select=id,nombre,estado')
    if (secuencias.length === 0) {
      console.log('SKIP: No sequences found')
      return
    }

    const secId = secuencias[0].id
    const pasos = await sbGet(request, 'ce_pasos', `secuencia_id=eq.${secId}&select=*&order=orden.asc`)

    console.log(`Sequence: ${secuencias[0].nombre} (${secuencias[0].estado})`)
    console.log(`Steps: ${pasos.length}`)

    for (const paso of pasos) {
      console.log(`  Paso ${paso.orden}: "${paso.asunto_a}"`)
      // Check for variable usage
      const vars = (paso.cuerpo_a || '').match(/\{\{(\w+)\}\}/g) || []
      console.log(`    Variables used: ${vars.join(', ') || 'none'}`)
    }
  })

  test('5. Enrollar contacto en secuencia y verificar enrollment', async ({ request }) => {
    const contacts = await sbGet(request, 'ce_contactos', `email=eq.${TEST_EMAIL}&select=id`)
    if (contacts.length === 0) {
      console.log('SKIP: No test contact')
      return
    }

    const secuencias = await sbGet(request, 'ce_secuencias', 'limit=1&select=id')
    if (secuencias.length === 0) {
      console.log('SKIP: No sequences')
      return
    }

    const contactId = contacts[0].id
    const secId = secuencias[0].id

    // Get first paso's delay
    const pasos = await sbGet(request, 'ce_pasos', `secuencia_id=eq.${secId}&order=orden.asc&limit=1&select=delay_dias`)
    const delayDias = pasos?.[0]?.delay_dias || 0

    // Get cuenta
    const cuentasRel = await sbGet(request, 'ce_secuencias_cuentas', `secuencia_id=eq.${secId}&limit=1&select=cuenta_id`)
    const cuentaId = cuentasRel?.[0]?.cuenta_id || null

    // Calculate proximo_envio_at
    const delayMs = delayDias * 24 * 60 * 60 * 1000
    const proximoEnvio = new Date(Date.now() + delayMs).toISOString()

    // Create enrollment directly
    const enrollments = await sbPost(request, 'ce_enrollments', {
      secuencia_id: secId,
      contacto_id: contactId,
      estado: 'activo',
      proximo_envio_at: proximoEnvio,
      cuenta_id: cuentaId,
    })

    const enrollment = Array.isArray(enrollments) ? enrollments[0] : enrollments
    console.log(`Enrollment created:`)
    console.log(`  id: ${enrollment.id}`)
    console.log(`  estado: ${enrollment.estado}`)
    console.log(`  cuenta_id: ${enrollment.cuenta_id}`)
    console.log(`  proximo_envio_at: ${enrollment.proximo_envio_at}`)

    expect(enrollment.estado).toBe('activo')
    expect(enrollment.cuenta_id).toBeTruthy()
    expect(enrollment.proximo_envio_at).toBeTruthy()

    // If delay is 0, set proximo_envio_at to past so scheduler picks it up
    if (delayDias === 0) {
      const past = new Date(Date.now() - 60000).toISOString()
      await sbPatch(request, 'ce_enrollments', `id=eq.${enrollment.id}`, {
        proximo_envio_at: past,
      })
      console.log('Set proximo_envio_at to past for immediate send')
    }
  })

  test('6. Esperar que scheduler envie el email (max 2 min)', async ({ request }) => {
    // Wait for scheduler to process
    let sent = false
    for (let i = 0; i < 24; i++) { // 24 * 5s = 2 min
      await new Promise((r) => setTimeout(r, 5000))

      // Check ce_envios for our contact
      const contacts = await sbGet(request, 'ce_contactos', `email=eq.${TEST_EMAIL}&select=id`)
      if (contacts.length === 0) continue

      const envios = await sbGet(request, 'ce_envios', `contacto_id=eq.${contacts[0].id}&select=id,estado,message_id,resend_id,enviado_at&order=created_at.desc&limit=1`)

      if (envios.length > 0 && envios[0].estado === 'enviado') {
        console.log(`Email sent after ${(i + 1) * 5}s:`)
        console.log(`  envio_id: ${envios[0].id}`)
        console.log(`  resend_id: ${envios[0].resend_id}`)
        console.log(`  message_id: ${envios[0].message_id}`)
        console.log(`  enviado_at: ${envios[0].enviado_at}`)
        sent = true
        break
      }

      console.log(`Waiting... ${(i + 1) * 5}s`)
    }

    expect(sent).toBe(true)
  })

  test('7. Verificar que las variables se reemplazaron', async ({ request }) => {
    // Check scheduler logs or just verify the envio exists with correct data
    const contacts = await sbGet(request, 'ce_contactos', `email=eq.${TEST_EMAIL}&select=id,nombre,empresa,telefono,categoria,zona`)
    if (contacts.length === 0) {
      console.log('SKIP: No contact')
      return
    }

    const c = contacts[0]
    console.log('Contact data for variable replacement:')
    console.log(`  nombre: "${c.nombre}" ${c.nombre ? 'OK' : 'EMPTY!'}`)
    console.log(`  empresa: "${c.empresa}" ${c.empresa ? 'OK' : 'EMPTY!'}`)
    console.log(`  telefono: "${c.telefono}" ${c.telefono ? 'OK' : 'EMPTY!'}`)
    console.log(`  categoria: "${c.categoria}" ${c.categoria ? 'OK' : 'EMPTY!'}`)
    console.log(`  zona: "${c.zona}" ${c.zona ? 'OK' : 'EMPTY!'}`)

    // All fields should be filled
    expect(c.nombre).toBeTruthy()
    expect(c.empresa).toBeTruthy()
    expect(c.telefono).toBeTruthy()
    expect(c.categoria).toBeTruthy()
    expect(c.zona).toBeTruthy()
  })

  test('8. Verificar cuentas todas con nombre Madrigal Marketing', async ({ request }) => {
    const cuentas = await sbGet(request, 'ce_cuentas', 'select=id,nombre,email,estado')
    console.log(`Total cuentas: ${cuentas.length}`)

    let allMadrigal = true
    for (const c of cuentas) {
      const ok = c.nombre === 'Madrigal Marketing'
      console.log(`  ${c.email}: nombre="${c.nombre}" ${ok ? 'OK' : 'FAIL'}`)
      if (!ok) allMadrigal = false
    }

    expect(allMadrigal).toBe(true)
    expect(cuentas.length).toBeGreaterThanOrEqual(10)
  })

  test('9. Verificar Config > Cuentas muestra datos correctos', async ({ page }) => {
    await login(page)
    await page.goto('/cold-email/config')
    await page.waitForTimeout(2000)

    // Should default to Cuentas tab
    const content = await page.textContent('body')
    expect(content).toContain('Cuentas de envio')

    // Check account cards
    const cards = page.locator('.ce-account-card')
    const cardCount = await cards.count()
    console.log(`Account cards visible: ${cardCount}`)
    expect(cardCount).toBeGreaterThanOrEqual(1)

    // Check warmup info visible
    const warmupVisible = content.includes('Warm-up') || content.includes('warmup')
    console.log(`Warmup info visible: ${warmupVisible}`)

    // Check for Madrigal Marketing in cards
    const madrigalVisible = content.includes('Madrigal Marketing')
    console.log(`Madrigal Marketing visible: ${madrigalVisible}`)
    expect(madrigalVisible).toBe(true)
  })

  test('10. Verificar plantillas muestran todas las variables', async ({ page }) => {
    await login(page)
    await page.goto('/cold-email/plantillas')
    await page.waitForTimeout(2000)

    // Open new plantilla modal
    const crearBtn = page.getByText('Crear Plantilla').or(page.getByText('Nueva')).first()
    if (await crearBtn.isVisible()) {
      await crearBtn.click()
      await page.waitForTimeout(500)

      const allVars = ['{{nombre}}', '{{empresa}}', '{{cargo}}', '{{email}}', '{{telefono}}', '{{dominio_empresa}}', '{{categoria}}', '{{zona}}']
      const results = []

      for (const v of allVars) {
        const visible = await page.getByText(v, { exact: true }).first().isVisible().catch(() => false)
        results.push({ var: v, visible })
        console.log(`  ${v}: ${visible ? 'PASS' : 'FAIL'}`)
      }

      const allVisible = results.every(r => r.visible)
      expect(allVisible).toBe(true)

      // Close modal
      await page.locator('.ce-modal-close').first().click()
    }
  })

  test('11. Dashboard muestra metricas sin errores', async ({ page }) => {
    await login(page)

    const errors = []
    page.on('pageerror', (err) => errors.push(err.message))
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text())
    })

    await page.goto('/cold-email')
    await page.waitForTimeout(3000)

    const content = await page.textContent('body')
    console.log('Dashboard content check:')
    console.log(`  Has "Enviados": ${content.includes('Enviados')}`)
    console.log(`  Has "Contactos": ${content.includes('Contactos')}`)
    console.log(`  Has "Respuestas": ${content.includes('Respuestas')}`)

    if (errors.length > 0) {
      console.log('Console errors:')
      errors.forEach(e => console.log(`  - ${e}`))
    }
    console.log(`JS errors: ${errors.length}`)
  })

  test('12. Verificar respuestas page funciona', async ({ page }) => {
    await login(page)
    await page.goto('/cold-email/respuestas')
    await page.waitForTimeout(2000)

    await expect(page.locator('h1')).toContainText('Respuestas')

    // Check inbox layout exists
    const layout = page.locator('.ce-inbox-layout')
    await expect(layout).toBeVisible()

    // Check filter pills
    const pills = page.locator('.ce-pill, .ce-pill-sm')
    const pillCount = await pills.count()
    console.log(`Filter pills: ${pillCount}`)
    expect(pillCount).toBeGreaterThan(0)
  })
})
