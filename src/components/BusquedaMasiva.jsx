import { useState, useEffect, useMemo, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

// Función de búsqueda fuzzy mejorada
const fuzzyMatch = (text, search) => {
  if (!text || !search) return false
  
  // Normalizar: eliminar acentos, mayúsculas, espacios extras
  const normalize = str => str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
  
  const normalizedText = normalize(String(text))
  const normalizedSearch = normalize(search)
  
  // Búsqueda exacta
  if (normalizedText.includes(normalizedSearch)) return true
  
  // Búsqueda fuzzy: permitir caracteres faltantes
  let searchIndex = 0
  for (let i = 0; i < normalizedText.length && searchIndex < normalizedSearch.length; i++) {
    if (normalizedText[i] === normalizedSearch[searchIndex]) {
      searchIndex++
    }
  }
  
  return searchIndex === normalizedSearch.length
}

// Función para buscar en objeto recursivamente
const searchInObject = (obj, searchTerm) => {
  if (!obj) return false
  
  for (const key in obj) {
    const value = obj[key]
    
    if (typeof value === 'string' || typeof value === 'number') {
      if (fuzzyMatch(value, searchTerm)) return true
    } else if (typeof value === 'object' && value !== null) {
      if (searchInObject(value, searchTerm)) return true
    }
  }
  
  return false
}

export default function BusquedaMasiva() {
  const [searchTerm, setSearchTerm] = useState('')
  const [clientes, setClientes] = useState([])
  const [resultados, setResultados] = useState([])
  const [loading, setLoading] = useState(false)
  const [isOpen, setIsOpen] = useState(false)
  const navigate = useNavigate()
  const inputRef = useRef(null)
  const dropdownRef = useRef(null)

  // Cargar todos los clientes al montar
  useEffect(() => {
    cargarClientes()
  }, [])

  const cargarClientes = async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('clientes')
        .select('*')
        .order('nombre', { ascending: true })
      
      if (error) throw error
      setClientes(data || [])
    } catch (error) {
      console.error('Error cargando clientes:', error)
    } finally {
      setLoading(false)
    }
  }

  // Buscar en tiempo real
  const resultadosBusqueda = useMemo(() => {
    if (!searchTerm.trim()) return []
    
    return clientes.filter(cliente => 
      searchInObject(cliente, searchTerm)
    ).slice(0, 20) // Limitar a 20 resultados
  }, [clientes, searchTerm])

  useEffect(() => {
    setResultados(resultadosBusqueda)
    setIsOpen(searchTerm.length > 0 && resultadosBusqueda.length > 0)
  }, [resultadosBusqueda, searchTerm])

  // Manejar click fuera
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        dropdownRef.current && 
        !dropdownRef.current.contains(event.target) &&
        !inputRef.current.contains(event.target)
      ) {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Atajos de teclado
  useEffect(() => {
    const handleKeyboard = (e) => {
      // Ctrl/Cmd + K para enfocar búsqueda
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault()
        inputRef.current?.focus()
      }
      
      // Escape para cerrar
      if (e.key === 'Escape') {
        setIsOpen(false)
        inputRef.current?.blur()
      }
    }

    document.addEventListener('keydown', handleKeyboard)
    return () => document.removeEventListener('keydown', handleKeyboard)
  }, [])

  const handleSelectCliente = (clienteId) => {
    navigate(`/clientes/${clienteId}`)
    setSearchTerm('')
    setIsOpen(false)
    inputRef.current?.blur()
  }

  const highlightMatch = (text, search) => {
    if (!text || !search) return text
    
    const normalize = str => str
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
    
    const normalizedText = normalize(String(text))
    const normalizedSearch = normalize(search)
    
    const index = normalizedText.indexOf(normalizedSearch)
    if (index === -1) return text
    
    const before = text.slice(0, index)
    const match = text.slice(index, index + search.length)
    const after = text.slice(index + search.length)
    
    return (
      <>
        {before}
        <mark className="search-highlight">{match}</mark>
        {after}
      </>
    )
  }

  return (
    <div style={{ position: 'relative', width: '100%', marginBottom: '16px' }}>
      <div style={{
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        background: 'rgba(255, 255, 255, 0.03)',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        borderRadius: '10px',
        padding: '0 12px',
        transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', color: 'rgba(255, 255, 255, 0.4)', marginRight: '10px' }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
            <circle cx="11" cy="11" r="8" stroke="currentColor" strokeWidth="2"/>
            <path d="M21 21l-4.35-4.35" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
          </svg>
        </div>
        
        <input
          ref={inputRef}
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          onFocus={() => searchTerm && setIsOpen(true)}
          placeholder="Buscar en todos los clientes..."
          style={{
            flex: 1,
            background: 'none',
            border: 'none',
            outline: 'none',
            color: 'rgba(255, 255, 255, 0.9)',
            fontSize: '14px',
            padding: '12px 0',
            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
          }}
        />
        
        {searchTerm && (
          <button
            onClick={() => {
              setSearchTerm('')
              setIsOpen(false)
            }}
            style={{
              background: 'none',
              border: 'none',
              outline: 'none',
              cursor: 'pointer',
              color: 'rgba(255, 255, 255, 0.4)',
              padding: '4px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: '4px',
              marginRight: '8px'
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
              <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            </svg>
          </button>
        )}
        
        <div style={{ display: 'flex', gap: '4px', marginLeft: '8px' }}>
          <kbd style={{
            background: 'rgba(255, 255, 255, 0.08)',
            border: '1px solid rgba(255, 255, 255, 0.12)',
            borderRadius: '4px',
            padding: '2px 6px',
            fontSize: '11px',
            fontFamily: 'ui-monospace, monospace',
            color: 'rgba(255, 255, 255, 0.5)',
            fontWeight: '500'
          }}>⌘</kbd>
          <kbd style={{
            background: 'rgba(255, 255, 255, 0.08)',
            border: '1px solid rgba(255, 255, 255, 0.12)',
            borderRadius: '4px',
            padding: '2px 6px',
            fontSize: '11px',
            fontFamily: 'ui-monospace, monospace',
            color: 'rgba(255, 255, 255, 0.5)',
            fontWeight: '500'
          }}>K</kbd>
        </div>
      </div>

      {isOpen && (
        <div ref={dropdownRef} style={{
          position: 'absolute',
          top: 'calc(100% + 8px)',
          left: 0,
          right: 0,
          background: 'rgba(20, 20, 24, 0.98)',
          backdropFilter: 'blur(20px)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          borderRadius: '12px',
          overflow: 'hidden',
          boxShadow: '0 20px 60px rgba(0, 0, 0, 0.5)',
          zIndex: 1000,
          animation: 'slideDown 0.2s cubic-bezier(0.4, 0, 0.2, 1)'
        }}>
          <div style={{
            padding: '12px 16px',
            fontSize: '11px',
            fontWeight: '600',
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
            color: 'rgba(255, 255, 255, 0.4)',
            borderBottom: '1px solid rgba(255, 255, 255, 0.06)'
          }}>
            {resultados.length} resultado{resultados.length !== 1 ? 's' : ''} encontrado{resultados.length !== 1 ? 's' : ''}
          </div>
          
          <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
            {resultados.map(cliente => (
              <button
                key={cliente.id}
                onClick={() => handleSelectCliente(cliente.id)}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '12px 16px',
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  transition: 'background 0.15s ease',
                  textAlign: 'left'
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
              >
                <div style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '8px',
                  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: '600',
                  fontSize: '14px',
                  color: 'white',
                  flexShrink: 0
                }}>
                  {cliente.nombre?.[0]?.toUpperCase() || '?'}
                </div>
                
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontSize: '14px',
                    fontWeight: '500',
                    color: 'rgba(255, 255, 255, 0.9)',
                    marginBottom: '4px',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap'
                  }}>
                    {highlightMatch(cliente.nombre, searchTerm)}
                  </div>
                  
                  <div style={{
                    fontSize: '12px',
                    color: 'rgba(255, 255, 255, 0.4)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap'
                  }}>
                    {cliente.email && <span>{highlightMatch(cliente.email, searchTerm)}</span>}
                    {cliente.telefono && (
                      <>
                        <span style={{ color: 'rgba(255, 255, 255, 0.2)' }}>•</span>
                        <span>{highlightMatch(cliente.telefono, searchTerm)}</span>
                      </>
                    )}
                  </div>
                </div>
                
                <div style={{ color: 'rgba(255, 255, 255, 0.3)', flexShrink: 0 }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                    <path d="M9 5l7 7-7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      <style>{`
        @keyframes slideDown {
          from {
            opacity: 0;
            transform: translateY(-10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .search-highlight {
          background: rgba(102, 126, 234, 0.3);
          color: rgba(255, 255, 255, 0.95);
          border-radius: 2px;
          padding: 1px 2px;
        }
      `}</style>
    </div>
  )
}
