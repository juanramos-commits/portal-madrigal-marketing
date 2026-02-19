import { logger } from '../lib/logger'
import { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'

export default function ClienteDashboard() {
  const { usuario } = useAuth()
  const [loading, setLoading] = useState(true)
  const [cliente, setCliente] = useState(null)
  const [stats, setStats] = useState({ campanasActivas: 0, leadsDelMes: 0, facturasPendientes: 0 })

  useEffect(() => {
    loadClienteData()
  }, [usuario?.id])

  const loadClienteData = async () => {
    if (!usuario?.cliente_id) {
      setLoading(false)
      return
    }

    try {
      // Cargar datos del cliente
      const { data: clienteData } = await supabase
        .from('clientes')
        .select('*')
        .eq('id', usuario.cliente_id)
        .single()

      setCliente(clienteData)

      // Cargar estadísticas básicas
      const mesInicio = new Date()
      mesInicio.setDate(1)
      mesInicio.setHours(0, 0, 0, 0)

      const [campanasRes, leadsRes] = await Promise.all([
        supabase.from('campanas')
          .select('id', { count: 'exact', head: true })
          .eq('cliente_id', usuario.cliente_id)
          .eq('estado', 'activa')
          .catch(() => ({ count: 0 })),
        supabase.from('leads')
          .select('id', { count: 'exact', head: true })
          .eq('cliente_id', usuario.cliente_id)
          .gte('created_at', mesInicio.toISOString())
          .catch(() => ({ count: 0 }))
      ])

      setStats({
        campanasActivas: campanasRes?.count || 0,
        leadsDelMes: leadsRes?.count || 0,
        facturasPendientes: 0
      })
    } catch (e) {
      logger.error('Error loading client dashboard:', e)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: '60px' }}>
        <div className="spinner" />
      </div>
    )
  }

  return (
    <div style={{ maxWidth: '900px', margin: '0 auto', padding: '24px' }}>
      <div style={{ marginBottom: '32px' }}>
        <h1 className="h1" style={{ marginBottom: '4px' }}>
          Bienvenido{usuario?.nombre ? `, ${usuario.nombre.split(' ')[0]}` : ''}
        </h1>
        <p className="sub">
          {cliente?.nombre || 'Tu portal de cliente'}
        </p>
      </div>

      {/* Métricas */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: '16px',
        marginBottom: '32px'
      }}>
        <div style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border)',
          borderRadius: '12px',
          padding: '24px',
          textAlign: 'center'
        }}>
          <div style={{ fontSize: '36px', fontWeight: 700, color: '#3b82f6' }}>{stats.campanasActivas}</div>
          <div style={{ fontSize: '14px', color: 'var(--text-muted)', marginTop: '4px' }}>Campanas activas</div>
        </div>

        <div style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border)',
          borderRadius: '12px',
          padding: '24px',
          textAlign: 'center'
        }}>
          <div style={{ fontSize: '36px', fontWeight: 700, color: '#10b981' }}>{stats.leadsDelMes}</div>
          <div style={{ fontSize: '14px', color: 'var(--text-muted)', marginTop: '4px' }}>Leads este mes</div>
        </div>

        <div style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border)',
          borderRadius: '12px',
          padding: '24px',
          textAlign: 'center'
        }}>
          <div style={{ fontSize: '36px', fontWeight: 700, color: '#f59e0b' }}>{stats.facturasPendientes}</div>
          <div style={{ fontSize: '14px', color: 'var(--text-muted)', marginTop: '4px' }}>Facturas pendientes</div>
        </div>
      </div>

      {/* Info del cliente */}
      {cliente && (
        <div style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border)',
          borderRadius: '12px',
          padding: '24px',
          marginBottom: '24px'
        }}>
          <h2 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '16px' }}>Datos de tu cuenta</h2>
          <div style={{ display: 'grid', gap: '12px' }}>
            {cliente.nombre && (
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                <span style={{ color: 'var(--text-muted)', fontSize: '14px' }}>Empresa</span>
                <span style={{ fontSize: '14px' }}>{cliente.nombre}</span>
              </div>
            )}
            {cliente.email && (
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                <span style={{ color: 'var(--text-muted)', fontSize: '14px' }}>Email</span>
                <span style={{ fontSize: '14px' }}>{cliente.email}</span>
              </div>
            )}
            {cliente.telefono && (
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                <span style={{ color: 'var(--text-muted)', fontSize: '14px' }}>Teléfono</span>
                <span style={{ fontSize: '14px' }}>{cliente.telefono}</span>
              </div>
            )}
            {cliente.estado && (
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0' }}>
                <span style={{ color: 'var(--text-muted)', fontSize: '14px' }}>Estado</span>
                <span style={{
                  fontSize: '13px', padding: '2px 10px', borderRadius: '12px',
                  background: cliente.estado === 'activo' ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)',
                  color: cliente.estado === 'activo' ? '#10b981' : '#ef4444'
                }}>
                  {cliente.estado}
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Información de soporte */}
      <div style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border)',
        borderRadius: '12px',
        padding: '24px'
      }}>
        <h2 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '8px' }}>Soporte</h2>
        <p style={{ fontSize: '14px', color: 'var(--text-muted)', lineHeight: 1.6 }}>
          Si necesitas ayuda o tienes alguna consulta, no dudes en contactarnos.
          Nuestro equipo está disponible para ayudarte con cualquier duda sobre tus campañas y servicios.
        </p>
      </div>
    </div>
  )
}
