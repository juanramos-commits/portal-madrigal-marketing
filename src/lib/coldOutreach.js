import { supabase } from './supabase'

// Escape SQL LIKE wildcards to prevent pattern injection
function escSearch(s) { return s.replace(/[%_\\]/g, c => '\\' + c) }

// === DOMAINS ===
export async function getDomains() {
  return supabase.from('ventas_co_domains').select('*').order('created_at').limit(100)
}

export async function getDomain(id) {
  return supabase.from('ventas_co_domains').select('*').eq('id', id).single()
}

export async function createDomain(domain) {
  return supabase.from('ventas_co_domains').insert(domain).select().single()
}

export async function updateDomain(id, updates) {
  return supabase.from('ventas_co_domains').update(updates).eq('id', id).select().single()
}

export async function deleteDomain(id) {
  return supabase.from('ventas_co_domains').delete().eq('id', id)
}

export async function checkDomainHealth(id) {
  return supabase.from('ventas_co_domains').update({ last_health_check: new Date().toISOString() }).eq('id', id).select().single()
}

// === INBOXES ===
export async function getInboxes(domainId) {
  let query = supabase.from('ventas_co_inboxes').select('*, domain:ventas_co_domains(id, domain, status)')
  if (domainId) query = query.eq('domain_id', domainId)
  return query.order('created_at', { ascending: false })
}

export async function getInbox(id) {
  return supabase.from('ventas_co_inboxes').select('*, domain:ventas_co_domains(*)').eq('id', id).single()
}

export async function createInbox(inbox) {
  return supabase.from('ventas_co_inboxes').insert(inbox).select().single()
}

export async function updateInbox(id, updates) {
  return supabase.from('ventas_co_inboxes').update(updates).eq('id', id).select().single()
}

export async function deleteInbox(id) {
  return supabase.from('ventas_co_inboxes').delete().eq('id', id)
}

export async function resetInboxDailyCounts() {
  const today = new Date().toISOString().split('T')[0]
  return supabase.from('ventas_co_inboxes').update({ sent_today: 0, sent_today_reset_at: today }).lt('sent_today_reset_at', today)
}

// === LISTS ===
export async function getLists() {
  return supabase.from('ventas_co_lists').select('*').order('created_at', { ascending: false }).limit(200)
}

export async function getList(id) {
  return supabase.from('ventas_co_lists').select('*').eq('id', id).single()
}

export async function createList(list) {
  return supabase.from('ventas_co_lists').insert(list).select().single()
}

export async function updateList(id, updates) {
  return supabase.from('ventas_co_lists').update(updates).eq('id', id).select().single()
}

export async function deleteList(id) {
  return supabase.from('ventas_co_lists').delete().eq('id', id)
}

export async function getListStats(id) {
  const statuses = ['new', 'verified', 'contacted', 'replied', 'bounced', 'unsubscribed']
  const queries = [
    supabase.from('ventas_co_contacts').select('*', { count: 'exact', head: true }).eq('list_id', id),
    ...statuses.map(s =>
      supabase.from('ventas_co_contacts').select('*', { count: 'exact', head: true }).eq('list_id', id).eq('status', s)
    ),
  ]
  const results = await Promise.all(queries)
  if (results[0].error) return { error: results[0].error }
  const stats = { total: results[0].count || 0 }
  statuses.forEach((s, i) => { stats[s] = results[i + 1].count || 0 })
  return { data: stats }
}

// === CONTACTS ===
export async function getContacts({ listId, search = '', status = '', page = 0, limit = 50 } = {}) {
  let query = supabase.from('ventas_co_contacts').select('*', { count: 'exact' })
  if (listId) query = query.eq('list_id', listId)
  if (search) { const s = escSearch(search); query = query.or(`email.ilike.%${s}%,first_name.ilike.%${s}%,last_name.ilike.%${s}%,company.ilike.%${s}%`) }
  if (status) query = query.eq('status', status)
  query = query.order('created_at', { ascending: false }).range(page * limit, (page + 1) * limit - 1)
  return query
}

export async function getContact(id) {
  return supabase.from('ventas_co_contacts').select('*').eq('id', id).single()
}

export async function createContact(contact) {
  return supabase.from('ventas_co_contacts').insert(contact).select().single()
}

export async function updateContact(id, updates) {
  return supabase.from('ventas_co_contacts').update(updates).eq('id', id).select().single()
}

export async function deleteContact(id) {
  return supabase.from('ventas_co_contacts').delete().eq('id', id)
}

export async function importContacts(listId, contacts) {
  const rows = contacts.map(c => ({ ...c, list_id: listId }))
  return supabase.from('ventas_co_contacts').upsert(rows, { onConflict: 'email,list_id' }).select()
}

export async function getContactStats() {
  const statuses = ['new', 'verified', 'contacted', 'replied', 'bounced', 'unsubscribed']
  const queries = [
    supabase.from('ventas_co_contacts').select('*', { count: 'exact', head: true }),
    ...statuses.map(s =>
      supabase.from('ventas_co_contacts').select('*', { count: 'exact', head: true }).eq('status', s)
    ),
  ]
  const results = await Promise.all(queries)
  if (results[0].error) return { error: results[0].error }
  const stats = { total: results[0].count || 0 }
  statuses.forEach((s, i) => { stats[s] = results[i + 1].count || 0 })
  return { data: stats }
}

// === CAMPAIGNS ===
export async function getCampaigns({ status = '', search = '', page = 0, limit = 20 } = {}) {
  let query = supabase.from('ventas_co_campaigns').select('*', { count: 'exact' }).order('created_at', { ascending: false })
  if (status) query = query.eq('status', status)
  if (search) query = query.ilike('name', `%${escSearch(search)}%`)
  query = query.range(page * limit, (page + 1) * limit - 1)
  return query
}

export async function getCampaign(id) {
  return supabase.from('ventas_co_campaigns').select('*, steps:ventas_co_steps(*)').eq('id', id).single()
}

export async function createCampaign(campaign) {
  return supabase.from('ventas_co_campaigns').insert(campaign).select().single()
}

export async function updateCampaign(id, updates) {
  return supabase.from('ventas_co_campaigns').update(updates).eq('id', id).select().single()
}

export async function deleteCampaign(id) {
  return supabase.from('ventas_co_campaigns').delete().eq('id', id)
}

export async function activateCampaign(id) {
  return supabase.from('ventas_co_campaigns').update({ status: 'active', started_at: new Date().toISOString() }).eq('id', id).select().single()
}

export async function pauseCampaign(id) {
  return supabase.from('ventas_co_campaigns').update({ status: 'paused' }).eq('id', id).select().single()
}

export async function archiveCampaign(id) {
  return supabase.from('ventas_co_campaigns').update({ status: 'archived' }).eq('id', id).select().single()
}

// === STEPS ===
export async function getSteps(campaignId) {
  return supabase.from('ventas_co_steps').select('*').eq('campaign_id', campaignId).order('step_number')
}

export async function createStep(step) {
  return supabase.from('ventas_co_steps').insert(step).select().single()
}

export async function updateStep(id, updates) {
  return supabase.from('ventas_co_steps').update(updates).eq('id', id).select().single()
}

export async function deleteStep(id) {
  return supabase.from('ventas_co_steps').delete().eq('id', id)
}

export async function reorderSteps(campaignId, stepIds) {
  // Batch all updates in parallel (they're independent rows)
  return Promise.all(
    stepIds.map((id, index) =>
      supabase.from('ventas_co_steps').update({ step_number: index + 1 }).eq('id', id).eq('campaign_id', campaignId)
    )
  )
}

// === ENROLLMENTS ===
export async function getEnrollments(campaignId, { status = '', page = 0, limit = 50 } = {}) {
  let query = supabase.from('ventas_co_enrollments').select('*, contact:ventas_co_contacts(*)', { count: 'exact' }).eq('campaign_id', campaignId)
  if (status) query = query.eq('status', status)
  query = query.order('enrolled_at', { ascending: false }).range(page * limit, (page + 1) * limit - 1)
  return query
}

export async function enrollContacts(campaignId, contactIds) {
  return supabase.rpc('co_enroll_contacts', { p_campaign_id: campaignId, p_contact_ids: contactIds })
}

export async function unenrollContact(enrollmentId) {
  return supabase.from('ventas_co_enrollments').update({ status: 'unenrolled', unenrolled_at: new Date().toISOString() }).eq('id', enrollmentId).select().single()
}

// === SENDS ===
export async function getSends({ campaignId, contactId, status = '', page = 0, limit = 50 } = {}) {
  let query = supabase.from('ventas_co_sends').select('*, contact:ventas_co_contacts(email, first_name, last_name, company), step:ventas_co_steps(step_number, subject)', { count: 'exact' })
  if (campaignId) query = query.eq('campaign_id', campaignId)
  if (contactId) query = query.eq('contact_id', contactId)
  if (status) query = query.eq('status', status)
  query = query.order('sent_at', { ascending: false }).range(page * limit, (page + 1) * limit - 1)
  return query
}

export async function getSendDetails(id) {
  return supabase.from('ventas_co_sends').select('*, contact:ventas_co_contacts(*), step:ventas_co_steps(*)').eq('id', id).single()
}

// === REPLIES ===
export async function getReplies({ campaignId, classification = '', requiresAction, page = 0, limit = 50 } = {}) {
  let query = supabase.from('ventas_co_replies').select('*, contact:ventas_co_contacts(email, first_name, last_name, company), campaign:ventas_co_campaigns(name)', { count: 'exact' })
  if (campaignId) query = query.eq('campaign_id', campaignId)
  if (classification) query = query.eq('classification', classification)
  if (requiresAction !== undefined) query = query.eq('requires_action', requiresAction)
  query = query.order('received_at', { ascending: false }).range(page * limit, (page + 1) * limit - 1)
  return query
}

export async function classifyReply(id, { classification, sentiment }) {
  return supabase.from('ventas_co_replies').update({ classification, sentiment }).eq('id', id).select().single()
}

export async function markReplyActioned(id, userId) {
  return supabase.from('ventas_co_replies').update({ requires_action: false, actioned_by: userId, actioned: true }).eq('id', id).select().single()
}

// === SUPPRESSIONS ===
export async function getSuppressions({ search = '', reason = '', page = 0, limit = 50 } = {}) {
  let query = supabase.from('ventas_co_suppressions').select('*', { count: 'exact' })
  if (search) query = query.ilike('email', `%${escSearch(search)}%`)
  if (reason) query = query.eq('reason', reason)
  query = query.order('suppressed_at', { ascending: false }).range(page * limit, (page + 1) * limit - 1)
  return query
}

export async function addSuppression(email, reason, notes) {
  return supabase.from('ventas_co_suppressions').insert({ email, reason, notes, suppressed_at: new Date().toISOString() }).select().single()
}

export async function removeSuppression(id) {
  return supabase.from('ventas_co_suppressions').delete().eq('id', id)
}

// === ANALYTICS ===
export async function getDashboardStats() {
  return supabase.rpc('co_get_dashboard_stats')
}

export async function getReputationSummary(domainId, days = 30) {
  return supabase.rpc('co_get_reputation_summary', { p_domain_id: domainId, p_days: days })
}

export async function getCampaignAnalytics(campaignId) {
  return supabase.from('ventas_co_sends').select('step_id, status').eq('campaign_id', campaignId)
}

// === SETTINGS ===
export async function getSettings() {
  return supabase.from('ventas_co_settings').select('*')
}

export async function updateSetting(key, value) {
  return supabase.from('ventas_co_settings').update({ value }).eq('key', key)
}
