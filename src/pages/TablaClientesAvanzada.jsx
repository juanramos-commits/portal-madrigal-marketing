import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import BusquedaMasiva from '../components/BusquedaMasiva'

export default function TablaClientesAvanzada() {
  const navigate = useNavigate()
  const { tienePermiso } = useAuth()
  
  const [clientes, setClientes] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    cargarClientes()
  }, [])

  const cargarClientes = async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('clientes')
        .select('*')
        .order('nombre_comercial', { ascending: true })
      
      if (error) throw error
      setClientes(data || [])
    } catch (error) {
      console.error('Error cargando clientes:', error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ padding: '24px', background: '#0a0a0c', minHeight: '100vh' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <h1 style={{ fontSize: '28px', fontWeight: '700', color: 'rgba(255, 255, 255, 0.95)', margin: 0 }}>
          Clientes
        </h1>
        {tienePermiso('clientes.crear') && (
          <button 
            onClick={() => navigate('/clientes/nuevo')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '10px 16px',
              background: 'rgba(102, 126, 234, 0.15)',
              border: '1px solid rgba(102, 126, 234, 0.3)',
              borderRadius: '8px',
              color: '#667eea',
              fontSize: '14px',
              fontWeight: '500',
              cursor: 'pointer'
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            </svg>
            Nuevo Cliente
          </button>
        )}
      </div>

      <BusquedaMasiva />

      <div style={{
        background: 'rgba(255, 255, 255, 0.02)',
        border: '1px solid rgba(255, 255, 255, 0.06)',
        borderRadius: '12px',
        overflow: 'auto',
        maxHeight: 'calc(100vh - 300px)'
      }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead style={{ position: 'sticky', top: 0, background: 'rgba(10, 10, 12, 0.98)', zIndex: 10 }}>
            <tr>
              <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '12px', fontWeight: '600', color: 'rgba(255, 255, 255, 0.6)', textTransform: 'uppercase', borderBottom: '1px solid rgba(255, 255, 255, 0.08)' }}>
                Nombre
              </th>
              <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '12px', fontWeight: '600', color: 'rgba(255, 255, 255, 0.6)', textTransform: 'uppercase', borderBottom: '1px solid rgba(255, 255, 255, 0.08)' }}>
                Email
              </th>
              <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '12px', fontWeight: '600', color: 'rgba(255, 255, 255, 0.6)', textTransform: 'uppercase', borderBottom: '1px solid rgba(255, 255, 255, 0.08)' }}>
                Teléfono
              </th>
              <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '12px', fontWeight: '600', color: 'rgba(255, 255, 255, 0.6)', textTransform: 'uppercase', borderBottom: '1px solid rgba(255, 255, 255, 0.08)' }}>
                Estado
              </th>
              <th style={{ width: '80px', padding: '12px 16px', textAlign: 'center', fontSize: '12px', fontWeight: '600', color: 'rgba(255, 255, 255, 0.6)', textTransform: 'uppercase', borderBottom: '1px solid rgba(255, 255, 255, 0.08)' }}>
                Acciones
              </th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={5} style={{ textAlign: 'center', padding: '60px 20px', color: 'rgba(255, 255, 255, 0.4)' }}>
                  Cargando clientes...
                </td>
              </tr>
            ) : clientes.length === 0 ? (
              <tr>
                <td colSpan={5} style={{ textAlign: 'center', padding: '60px 20px', color: 'rgba(255, 255, 255, 0.4)' }}>
                  No se encontraron clientes
                </td>
              </tr>
            ) : (
              clientes.map(cliente => (
                <tr 
                  key={cliente.id}
                  style={{ cursor: 'pointer' }}
                  onClick={() => navigate(`/clientes/${cliente.id}`)}
                  onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.03)'}
                  onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                >
                  <td style={{ padding: '12px 16px', borderBottom: '1px solid rgba(255, 255, 255, 0.04)', color: 'rgba(255, 255, 255, 0.8)', fontSize: '14px' }}>
                    {cliente.nombre_comercial || '-'}
                  </td>
                  <td style={{ padding: '12px 16px', borderBottom: '1px solid rgba(255, 255, 255, 0.04)', color: 'rgba(255, 255, 255, 0.8)', fontSize: '14px' }}>
                    {cliente.email_portal || '-'}
                  </td>
                  <td style={{ padding: '12px 16px', borderBottom: '1px solid rgba(255, 255, 255, 0.04)', color: 'rgba(255, 255, 255, 0.8)', fontSize: '14px' }}>
                    {cliente.telefono || '-'}
                  </td>
                  <td style={{ padding: '12px 16px', borderBottom: '1px solid rgba(255, 255, 255, 0.04)' }}>
                    <span style={{
                      display: 'inline-block',
                      padding: '4px 10px',
                      borderRadius: '6px',
                      fontSize: '12px',
                      fontWeight: '500',
                      background: cliente.estado === 'campañas_activas' ? 'rgba(16, 185, 129, 0.15)' : cliente.estado === 'pausado' ? 'rgba(251, 191, 36, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                      color: cliente.estado === 'campañas_activas' ? '#10b981' : cliente.estado === 'pausado' ? '#fbbf24' : '#ef4444'
                    }}>
                      {cliente.estado || '-'}
                    </span>
                  </td>
                  <td style={{ padding: '12px 16px', borderBottom: '1px solid rgba(255, 255, 255, 0.04)', textAlign: 'center' }} onClick={(e) => e.stopPropagation()}>
                    <button 
                      onClick={() => navigate(`/clientes/${cliente.id}`)}
                      style={{
                        padding: '6px',
                        background: 'rgba(255, 255, 255, 0.03)',
                        border: '1px solid rgba(255, 255, 255, 0.08)',
                        borderRadius: '6px',
                        color: 'rgba(255, 255, 255, 0.6)',
                        cursor: 'pointer'
                      }}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" stroke="currentColor" strokeWidth="2"/>
                        <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="2"/>
                      </svg>
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
