import { supabase } from './supabase'

// Escape SQL LIKE wildcards to prevent pattern injection
function escSearch(s) { return s.replace(/[%_\\]/g, c => '\\' + c) }

// === CONTACTS ===
export async function getEmailContacts({ page = 0, pageSize = 50, search = '', status = '', sortBy = 'created_at', sortDir = 'desc' } = {}) {
  let query = supabase.from('ventas_em_contacts').select('*, lead:ventas_leads(nombre, email, telefono, nombre_negocio, fuente, tags)', { count: 'exact' })
  if (search) { const s = escSearch(search); query = query.or(`nombre.ilike.%${s}%,email.ilike.%${s}%,empresa.ilike.%${s}%`) }
  if (status) query = query.eq('status', status)
  query = query.order(sortBy, { ascending: sortDir === 'asc' }).range(page * pageSize, (page + 1) * pageSize - 1)
  return query
}

export async function getEmailContact(id) {
  return supabase.from('ventas_em_contacts').select('*, lead:ventas_leads(*)').eq('id', id).single()
}

export async function updateEmailContact(id, updates) {
  return supabase.from('ventas_em_contacts').update(updates).eq('id', id).select().single()
}

export async function deleteEmailContact(id) {
  return supabase.from('ventas_em_contacts').delete().eq('id', id)
}

export async function getContactStats() {
  const [countRes, avgRes] = await Promise.all([
    supabase.from('ventas_em_contacts').select('status', { count: 'exact', head: true }),
    supabase.rpc('em_contact_stats_agg'),
  ])

  // Fallback: if RPC doesn't exist, use simple counts
  if (avgRes.error) {
    const [totalRes, activeRes, unsubRes, bouncedRes] = await Promise.all([
      supabase.from('ventas_em_contacts').select('*', { count: 'exact', head: true }),
      supabase.from('ventas_em_contacts').select('*', { count: 'exact', head: true }).eq('status', 'active'),
      supabase.from('ventas_em_contacts').select('*', { count: 'exact', head: true }).eq('status', 'unsubscribed'),
      supabase.from('ventas_em_contacts').select('*', { count: 'exact', head: true }).eq('status', 'bounced'),
    ])
    return {
      data: {
        total: totalRes.count || 0,
        active: activeRes.count || 0,
        unsubscribed: unsubRes.count || 0,
        bounced: bouncedRes.count || 0,
        avgEngagement: 0,
        avgLeadScore: 0,
      }
    }
  }

  const agg = avgRes.data?.[0] || avgRes.data || {}
  return {
    data: {
      total: agg.total || countRes.count || 0,
      active: agg.active || 0,
      unsubscribed: agg.unsubscribed || 0,
      bounced: agg.bounced || 0,
      avgEngagement: Math.round(agg.avg_engagement || 0),
      avgLeadScore: Math.round(agg.avg_lead_score || 0),
    }
  }
}

// === CAMPAIGNS ===
export async function getEmailCampaigns({ page = 0, pageSize = 20, search = '', status = '' } = {}) {
  let query = supabase.from('ventas_em_campaigns').select('*, template:ventas_em_templates(name), segment:ventas_em_segments(name)', { count: 'exact' })
  if (search) query = query.ilike('name', `%${escSearch(search)}%`)
  if (status) query = query.eq('status', status)
  query = query.order('created_at', { ascending: false }).range(page * pageSize, (page + 1) * pageSize - 1)
  return query
}

export async function getEmailCampaign(id) {
  return supabase.from('ventas_em_campaigns').select('*, template:ventas_em_templates(*), segment:ventas_em_segments(*)').eq('id', id).single()
}

export async function createEmailCampaign(data) {
  return supabase.from('ventas_em_campaigns').insert(data).select().single()
}

export async function updateEmailCampaign(id, updates) {
  return supabase.from('ventas_em_campaigns').update(updates).eq('id', id).select().single()
}

export async function deleteEmailCampaign(id) {
  return supabase.from('ventas_em_campaigns').delete().eq('id', id)
}

export async function prepareCampaign(campaignId) {
  return supabase.functions.invoke('em-send-campaign', { body: { action: 'prepare', campaign_id: campaignId } })
}

export async function startCampaign(campaignId) {
  return supabase.from('ventas_em_campaigns').update({ status: 'sending', started_at: new Date().toISOString() }).eq('id', campaignId).select().single()
}

export async function pauseCampaign(campaignId) {
  return supabase.from('ventas_em_campaigns').update({ status: 'paused' }).eq('id', campaignId).select().single()
}

export async function resumeCampaign(campaignId) {
  return supabase.from('ventas_em_campaigns').update({ status: 'sending' }).eq('id', campaignId).select().single()
}

export async function cancelCampaign(campaignId) {
  await supabase.from('ventas_em_sends').delete().eq('campaign_id', campaignId).in('status', ['queued', 'sending'])
  return supabase.from('ventas_em_campaigns').update({ status: 'cancelled' }).eq('id', campaignId).select().single()
}

export async function getABResults(campaignId) {
  return supabase.from('ventas_em_ab_results').select('*').eq('campaign_id', campaignId).order('variant_index')
}

// === TEMPLATES ===
export async function getEmailTemplates({ search = '', category = '' } = {}) {
  let query = supabase.from('ventas_em_templates').select('*').order('created_at', { ascending: false }).limit(200)
  if (search) query = query.ilike('name', `%${escSearch(search)}%`)
  if (category) query = query.eq('category', category)
  return query
}

export async function getEmailTemplate(id) {
  return supabase.from('ventas_em_templates').select('*').eq('id', id).single()
}

export async function createEmailTemplate(data) {
  return supabase.from('ventas_em_templates').insert(data).select().single()
}

export async function updateEmailTemplate(id, updates) {
  return supabase.from('ventas_em_templates').update(updates).eq('id', id).select().single()
}

export async function deleteEmailTemplate(id) {
  return supabase.from('ventas_em_templates').delete().eq('id', id)
}

export async function duplicateEmailTemplate(id) {
  const { data: orig, error } = await getEmailTemplate(id)
  if (error) return { error }
  const { id: _, created_at, updated_at, ...rest } = orig
  return createEmailTemplate({ ...rest, name: `${rest.name} (copia)`, is_system: false })
}

export function renderBlocks(blocks = []) {
  return blocks.map(block => {
    switch (block.type) {
      case 'header': return `<div style="padding:24px;text-align:center;${styleString(block.styles)}">${block.content}</div>`
      case 'text': return `<div style="padding:16px 24px;${styleString(block.styles)}">${block.content}</div>`
      case 'cta': return `<div style="padding:16px 24px;text-align:center;${styleString(block.styles)}"><a href="${block.url || '#'}" style="display:inline-block;padding:12px 32px;background:#2ee59d;color:#000;text-decoration:none;border-radius:6px;font-weight:600;">${block.content}</a></div>`
      case 'image': return `<div style="padding:16px 24px;text-align:center;${styleString(block.styles)}"><img src="${block.url || ''}" alt="${block.content || ''}" style="max-width:100%;border-radius:8px;" /></div>`
      case 'divider': return `<hr style="border:none;border-top:1px solid #eee;margin:16px 24px;${styleString(block.styles)}" />`
      case 'footer': return `<div style="padding:16px 24px;font-size:12px;color:#999;text-align:center;${styleString(block.styles)}">${block.content}</div>`
      default: return `<div style="padding:16px 24px;">${block.content || ''}</div>`
    }
  }).join('')
}

function styleString(styles = {}) {
  return Object.entries(styles).map(([k, v]) => `${k.replace(/([A-Z])/g, '-$1').toLowerCase()}:${v}`).join(';')
}

// === TEMPLATE BLOCKS ===
export async function getTemplateBlocks({ category = '' } = {}) {
  let query = supabase.from('ventas_em_template_blocks').select('*').order('name').limit(200)
  if (category) query = query.eq('category', category)
  return query
}

// === SEGMENTS ===
export async function getEmailSegments() {
  return supabase.from('ventas_em_segments').select('*').order('is_system', { ascending: false }).order('name').limit(200)
}

export async function getEmailSegment(id) {
  return supabase.from('ventas_em_segments').select('*').eq('id', id).single()
}

export async function createEmailSegment(data) {
  return supabase.from('ventas_em_segments').insert(data).select().single()
}

export async function updateEmailSegment(id, updates) {
  return supabase.from('ventas_em_segments').update(updates).eq('id', id).select().single()
}

export async function deleteEmailSegment(id) {
  return supabase.from('ventas_em_segments').delete().eq('id', id)
}

export async function previewSegment(segmentId) {
  const { data, error } = await supabase.rpc('em_evaluate_segment', { p_segment_id: segmentId })
  if (error) return { data: { count: 0 }, error }
  return { data: { count: data?.length || 0, contacts: data } }
}

// === AUTOMATIONS ===
export async function getEmailAutomations() {
  return supabase.from('ventas_em_automations').select('*').order('created_at', { ascending: false }).limit(100)
}

export async function getEmailAutomation(id) {
  return supabase.from('ventas_em_automations').select('*, steps:ventas_em_automation_steps(*)').eq('id', id).single()
}

export async function createEmailAutomation(data) {
  return supabase.from('ventas_em_automations').insert(data).select().single()
}

export async function updateEmailAutomation(id, updates) {
  return supabase.from('ventas_em_automations').update(updates).eq('id', id).select().single()
}

export async function deleteEmailAutomation(id) {
  return supabase.from('ventas_em_automations').delete().eq('id', id)
}

export async function activateAutomation(id) {
  return updateEmailAutomation(id, { status: 'active' })
}

export async function deactivateAutomation(id) {
  return updateEmailAutomation(id, { status: 'paused' })
}

// === ANALYTICS ===
export async function getDashboardStats() {
  const [totalContactsRes, activeContactsRes, activeCampaignsRes, campaignTotalsRes] = await Promise.all([
    supabase.from('ventas_em_contacts').select('*', { count: 'exact', head: true }),
    supabase.from('ventas_em_contacts').select('*', { count: 'exact', head: true }).eq('status', 'active'),
    supabase.from('ventas_em_campaigns').select('*', { count: 'exact', head: true }).eq('status', 'sending'),
    supabase.from('ventas_em_campaigns').select('total_sent, total_opened, total_clicked, total_converted').limit(500),
  ])

  const campaigns = campaignTotalsRes.data || []
  const totalSent = campaigns.reduce((s, c) => s + (c.total_sent || 0), 0)
  const totalOpened = campaigns.reduce((s, c) => s + (c.total_opened || 0), 0)
  const totalClicked = campaigns.reduce((s, c) => s + (c.total_clicked || 0), 0)
  const totalConverted = campaigns.reduce((s, c) => s + (c.total_converted || 0), 0)

  return {
    data: {
      totalContacts: totalContactsRes.count || 0,
      activeContacts: activeContactsRes.count || 0,
      activeCampaigns: activeCampaignsRes.count || 0,
      totalSent,
      openRate: totalSent ? ((totalOpened / totalSent) * 100).toFixed(1) : '0.0',
      clickRate: totalSent ? ((totalClicked / totalSent) * 100).toFixed(1) : '0.0',
      totalConverted,
    }
  }
}

export async function getFunnelData(campaignId) {
  return supabase.rpc('em_get_funnel_data', { p_campaign_id: campaignId })
}

export async function getCohortData(days = 90) {
  return supabase.rpc('em_get_cohort_data', { p_days: days })
}

export async function getOpenHeatmap() {
  return supabase.rpc('em_get_open_heatmap')
}

export async function getReputationLogs(days = 30) {
  const since = new Date(Date.now() - days * 86400000).toISOString().split('T')[0]
  return supabase.from('ventas_em_reputation_log').select('*').gte('date', since).order('date', { ascending: false })
}

export async function getAnalyticsDaily(campaignId, days = 30) {
  const since = new Date(Date.now() - days * 86400000).toISOString().split('T')[0]
  let query = supabase.from('ventas_em_analytics_daily').select('*').gte('date', since).order('date')
  if (campaignId) query = query.eq('campaign_id', campaignId)
  return query
}

// === SETTINGS ===
export async function getEmailSettings() {
  return supabase.from('ventas_em_settings').select('*')
}

export async function updateEmailSetting(key, value) {
  return supabase.from('ventas_em_settings').update({ value }).eq('key', key)
}

// === AI ===
export async function generateSubjects(campaignId) {
  return supabase.functions.invoke('em-ai-scoring', { body: { action: 'generate_subjects', campaign_id: campaignId } })
}

// === WARMUP ===
export async function getWarmupSchedule() {
  return supabase.from('ventas_em_warmup_schedule').select('*').order('day')
}
