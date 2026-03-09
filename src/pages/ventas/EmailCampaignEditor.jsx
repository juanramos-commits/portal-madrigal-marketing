import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { useToast } from '../../contexts/ToastContext'
import { useEmailCampaigns } from '../../hooks/useEmailCampaigns'
import { useEmailTemplates } from '../../hooks/useEmailTemplates'
import { useEmailSegments } from '../../hooks/useEmailSegments'
import { getEmailCampaign } from '../../lib/emailMarketing'
import ABTestPanel from '../../components/ventas/email/ABTestPanel'
import TemplatePreview from '../../components/ventas/email/TemplatePreview'
import CampaignStatsCard from '../../components/ventas/email/CampaignStatsCard'
import FunnelChart from '../../components/ventas/email/FunnelChart'
import '../../styles/ventas-email.css'

export default function EmailCampaignEditor() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { tienePermiso } = useAuth()
  const { showToast } = useToast()
  const {
    crear,
    actualizar,
    preparar,
    iniciar,
    pausar,
    cancelar,
    obtenerResultadosAB,
  } = useEmailCampaigns()
  const { templates, cargar: cargarTemplates } = useEmailTemplates()
  const { segments, cargar: cargarSegments } = useEmailSegments()

  const isNew = id === 'nuevo'

  const [campaign, setCampaign] = useState(null)
  const [loading, setLoading] = useState(!isNew)
  const [form, setForm] = useState({
    name: '',
    subject: '',
    template_id: '',
    segment_id: '',
    ab_testing: false,
    ab_variants: [],
    ab_test_size: 20,
    ab_duration_hours: 4,
  })

  const loadCampaign = useCallback(async (campaignId) => {
    setLoading(true)
    const { data, error } = await getEmailCampaign(campaignId)
    if (!error && data) setCampaign(data)
    setLoading(false)
  }, [])

  useEffect(() => {
    cargarTemplates()
    cargarSegments()
    if (!isNew) loadCampaign(id)
  }, [id, isNew, loadCampaign, cargarTemplates, cargarSegments])

  useEffect(() => {
    if (campaign && !isNew) {
      setForm({
        name: campaign.name || '',
        subject: campaign.subject || '',
        template_id: campaign.template_id || '',
        segment_id: campaign.segment_id || '',
        ab_testing: campaign.ab_testing || false,
        ab_variants: campaign.ab_variants || [],
        ab_test_size: campaign.ab_test_size ?? 20,
        ab_duration_hours: campaign.ab_duration_hours ?? 4,
      })
    }
  }, [campaign, isNew])

  const handleChange = useCallback((field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }))
  }, [])

  if (!tienePermiso('ventas.email.campanas.crear')) {
    return (
      <div className="ve-page">
        <div className="ve-error" role="alert">No tienes permiso para editar campañas.</div>
      </div>
    )
  }

  const handleSave = async () => {
    try {
      if (isNew) {
        await crear(form)
      } else {
        await actualizar(id, form)
      }
      showToast('Campaña guardada correctamente', 'success')
      if (isNew) navigate('/ventas/email/campanas')
    } catch (err) {
      showToast(err.message || 'Error al guardar la campaña', 'error')
    }
  }

  const handlePrepare = async () => {
    try {
      await preparar(id)
      showToast('Campaña preparada', 'success')
      loadCampaign(id)
    } catch (err) {
      showToast(err.message || 'Error al preparar', 'error')
    }
  }

  const handleSend = async () => {
    try {
      await iniciar(id)
      showToast('Campaña iniciada', 'success')
      loadCampaign(id)
    } catch (err) {
      showToast(err.message || 'Error al enviar', 'error')
    }
  }

  const handlePause = async () => {
    try {
      await pausar(id)
      showToast('Campaña pausada', 'success')
      loadCampaign(id)
    } catch (err) {
      showToast(err.message || 'Error al pausar', 'error')
    }
  }

  const handleCancel = async () => {
    try {
      await cancelar(id)
      showToast('Campaña cancelada', 'success')
      loadCampaign(id)
    } catch (err) {
      showToast(err.message || 'Error al cancelar', 'error')
    }
  }

  const selectedTemplate = templates.find((t) => t.id === form.template_id)

  if (loading) {
    return (
      <div className="ve-page">
        <div className="ve-loading" role="status">
          <div className="ve-spinner" aria-hidden="true" />
          <span>Cargando campaña...</span>
        </div>
      </div>
    )
  }

  return (
    <div className="ve-page">
      <div className="ve-header">
        <h1>{isNew ? 'Nueva Campaña' : `Editar: ${form.name}`}</h1>
        <button className="ve-btn" onClick={() => navigate('/ventas/email/campanas')}>
          Volver
        </button>
      </div>

      <div className="ve-editor-layout">
        {/* Form Section */}
        <div className="ve-editor-form">
          <div className="ve-form-group">
            <label className="ve-label">Nombre</label>
            <input
              type="text"
              className="ve-input"
              value={form.name}
              onChange={(e) => handleChange('name', e.target.value)}
              placeholder="Nombre de la campaña"
            />
          </div>

          <div className="ve-form-group">
            <label className="ve-label">Asunto</label>
            <input
              type="text"
              className="ve-input"
              value={form.subject}
              onChange={(e) => handleChange('subject', e.target.value)}
              placeholder="Asunto del email"
            />
          </div>

          <div className="ve-form-group">
            <label className="ve-label">Plantilla</label>
            <select
              className="ve-select"
              value={form.template_id}
              onChange={(e) => handleChange('template_id', e.target.value)}
            >
              <option value="">Seleccionar plantilla...</option>
              {templates.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </div>

          <div className="ve-form-group">
            <label className="ve-label">Segmento</label>
            <select
              className="ve-select"
              value={form.segment_id}
              onChange={(e) => handleChange('segment_id', e.target.value)}
            >
              <option value="">Seleccionar segmento...</option>
              {segments.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>

          {/* A/B Testing */}
          <ABTestPanel
            campaign={{
              ab_enabled: form.ab_testing,
              ab_test_size: form.ab_test_size,
              ab_duration: `${form.ab_duration_hours}h`,
            }}
            variants={form.ab_variants}
          />

          {/* Action Buttons */}
          <div className="ve-actions-bar">
            <button className="ve-btn ve-btn--primary" onClick={handleSave}>Guardar</button>
            {!isNew && campaign?.status === 'draft' && (
              <>
                <button className="ve-btn" onClick={handlePrepare}>Preparar</button>
                <button className="ve-btn ve-btn--primary" onClick={handleSend}>Enviar</button>
              </>
            )}
            {!isNew && campaign?.status === 'sending' && (
              <button className="ve-btn ve-btn--warning" onClick={handlePause}>Pausar</button>
            )}
            {!isNew && (campaign?.status === 'draft' || campaign?.status === 'sending' || campaign?.status === 'paused') && (
              <button className="ve-btn ve-btn--danger" onClick={handleCancel}>Cancelar</button>
            )}
          </div>
        </div>

        {/* Preview Section */}
        <div className="ve-editor-preview">
          {selectedTemplate && (
            <div className="ve-section">
              <h2 className="ve-section-title">Vista previa</h2>
              <TemplatePreview blocks={selectedTemplate.blocks} subject={selectedTemplate.subject} />
            </div>
          )}

          {/* Stats Section (only for existing campaigns with sends) */}
          {!isNew && campaign?.sent_count > 0 && (
            <div className="ve-section">
              <h2 className="ve-section-title">Estadísticas</h2>
              <CampaignStatsCard campaign={campaign} />
              <FunnelChart data={campaign.funnel_data} />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
