import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'content-type, authorization',
}

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405)
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  )

  const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') ?? ''

  try {
    // Find all active automations with their steps
    const { data: automations, error: autoErr } = await supabase
      .from('ventas_em_automations')
      .select('*, steps:ventas_em_automation_steps(*, template:ventas_em_templates(*))')
      .eq('status', 'active')
      .order('step_order', { referencedTable: 'ventas_em_automation_steps' })

    if (autoErr || !automations || automations.length === 0) {
      return jsonResponse({ processed: 0, message: 'No active automations' })
    }

    let totalProcessed = 0

    for (const automation of automations) {
      const steps = automation.steps as Record<string, unknown>[] || []
      const stepsCount = steps.length

      // Find active enrollments for this automation
      const { data: enrollments, error: enrErr } = await supabase
        .from('ventas_em_automation_enrollments')
        .select('*, contact:ventas_em_contacts(*)')
        .eq('automation_id', automation.id)
        .eq('status', 'active')

      if (enrErr || !enrollments || enrollments.length === 0) continue

      for (const enrollment of enrollments) {
        const currentStepIndex = (enrollment.current_step as number) || 0

        // If current_step exceeds steps_count, mark as completed
        if (currentStepIndex >= stepsCount) {
          await supabase
            .from('ventas_em_automation_enrollments')
            .update({ status: 'completed', completed_at: new Date().toISOString() })
            .eq('id', enrollment.id)
          totalProcessed++
          continue
        }

        const step = steps[currentStepIndex] as Record<string, unknown>
        if (!step) {
          await supabase
            .from('ventas_em_automation_enrollments')
            .update({ status: 'completed', completed_at: new Date().toISOString() })
            .eq('id', enrollment.id)
          totalProcessed++
          continue
        }

        const stepType = step.type as string
        const stepConfig = (step.config || {}) as Record<string, unknown>
        const lastStepAt = enrollment.last_step_at
          ? new Date(enrollment.last_step_at as string)
          : new Date(enrollment.enrolled_at as string)
        const now = new Date()

        // ── WAIT step ────────────────────────────────────────────────
        if (stepType === 'wait') {
          const waitDays = (stepConfig.wait_days as number) || 1
          const waitMs = waitDays * 24 * 60 * 60 * 1000
          if (now.getTime() - lastStepAt.getTime() < waitMs) {
            continue // Still waiting
          }
          // Wait is over, advance to next step
          await supabase
            .from('ventas_em_automation_enrollments')
            .update({
              current_step: currentStepIndex + 1,
              last_step_at: now.toISOString(),
            })
            .eq('id', enrollment.id)
          totalProcessed++
        }

        // ── SEND_EMAIL step ──────────────────────────────────────────
        else if (stepType === 'send_email') {
          const contact = enrollment.contact as Record<string, unknown>
          if (!contact || !contact.email) {
            await supabase
              .from('ventas_em_automation_enrollments')
              .update({
                current_step: currentStepIndex + 1,
                last_step_at: now.toISOString(),
              })
              .eq('id', enrollment.id)
            continue
          }

          const template = step.template as Record<string, unknown> | null
          const subject = (stepConfig.subject as string) || (template?.subject as string) || 'No subject'
          let html = (template?.html_body as string) || (stepConfig.html as string) || ''
          const fromAddress = (stepConfig.from_email as string) || Deno.env.get('RESEND_FROM_EMAIL') || 'noreply@example.com'

          // Personalize
          html = html
            .replace(/\{\{nombre\}\}/g, (contact.nombre as string) || '')
            .replace(/\{\{empresa\}\}/g, (contact.empresa as string) || '')
            .replace(/\{\{email\}\}/g, (contact.email as string) || '')

          // Create send record
          const { data: sendRecord } = await supabase
            .from('ventas_em_sends')
            .insert({
              campaign_id: null,
              contact_id: contact.id,
              status: 'queued',
              scheduled_for: now.toISOString(),
            })
            .select()
            .single()

          // Send via Resend
          try {
            const resendRes = await fetch('https://api.resend.com/emails', {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${RESEND_API_KEY}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                from: fromAddress,
                to: contact.email,
                subject,
                html,
              }),
            })

            const resendData = await resendRes.json()

            if (!resendRes.ok) {
              throw new Error(resendData.message || `Resend API error: ${resendRes.status}`)
            }

            if (sendRecord) {
              await supabase
                .from('ventas_em_sends')
                .update({
                  status: 'delivered',
                  sent_at: now.toISOString(),
                  resend_message_id: resendData.id,
                })
                .eq('id', sendRecord.id)
            }
          } catch (err) {
            if (sendRecord) {
              await supabase
                .from('ventas_em_sends')
                .update({
                  status: 'failed',
                  error_message: err instanceof Error ? err.message : 'Send failed',
                })
                .eq('id', sendRecord.id)
            }
          }

          // Advance to next step regardless of send outcome
          await supabase
            .from('ventas_em_automation_enrollments')
            .update({
              current_step: currentStepIndex + 1,
              last_step_at: now.toISOString(),
            })
            .eq('id', enrollment.id)
          totalProcessed++
        }

        // ── CONDITION step ───────────────────────────────────────────
        else if (stepType === 'condition') {
          const contact = enrollment.contact as Record<string, unknown>
          const field = stepConfig.field as string
          const operator = stepConfig.operator as string
          const value = stepConfig.value

          let conditionMet = false
          if (contact && field) {
            const contactValue = contact[field]
            switch (operator) {
              case 'equals':
                conditionMet = contactValue === value
                break
              case 'not_equals':
                conditionMet = contactValue !== value
                break
              case 'greater_than':
                conditionMet = (contactValue as number) > (value as number)
                break
              case 'less_than':
                conditionMet = (contactValue as number) < (value as number)
                break
              case 'contains':
                conditionMet = String(contactValue || '').includes(String(value))
                break
              case 'exists':
                conditionMet = contactValue !== null && contactValue !== undefined
                break
              default:
                conditionMet = false
            }
          }

          if (conditionMet) {
            // Advance to next step
            await supabase
              .from('ventas_em_automation_enrollments')
              .update({
                current_step: currentStepIndex + 1,
                last_step_at: now.toISOString(),
              })
              .eq('id', enrollment.id)
          } else {
            // Go to exit step or skip (jump to end)
            const exitStep = stepConfig.else_step as number | undefined
            await supabase
              .from('ventas_em_automation_enrollments')
              .update({
                current_step: exitStep !== undefined ? exitStep : stepsCount,
                last_step_at: now.toISOString(),
              })
              .eq('id', enrollment.id)
          }
          totalProcessed++
        }

        // ── EXIT step ────────────────────────────────────────────────
        else if (stepType === 'exit') {
          await supabase
            .from('ventas_em_automation_enrollments')
            .update({ status: 'completed', completed_at: now.toISOString() })
            .eq('id', enrollment.id)
          totalProcessed++
        }

        // ── UPDATE_CONTACT step ──────────────────────────────────────
        else if (stepType === 'update_contact') {
          const updates = (stepConfig.fields || {}) as Record<string, unknown>
          if (Object.keys(updates).length > 0) {
            await supabase
              .from('ventas_em_contacts')
              .update(updates)
              .eq('id', enrollment.contact_id)
          }

          await supabase
            .from('ventas_em_automation_enrollments')
            .update({
              current_step: currentStepIndex + 1,
              last_step_at: now.toISOString(),
            })
            .eq('id', enrollment.id)
          totalProcessed++
        }

        // ── Unknown step type — skip ─────────────────────────────────
        else {
          await supabase
            .from('ventas_em_automation_enrollments')
            .update({
              current_step: currentStepIndex + 1,
              last_step_at: now.toISOString(),
            })
            .eq('id', enrollment.id)
          totalProcessed++
        }
      }
    }

    return jsonResponse({ processed: totalProcessed })

  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal error'
    return jsonResponse({ error: message }, 500)
  }
})
