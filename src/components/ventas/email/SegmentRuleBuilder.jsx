import { useCallback } from 'react'

const FIELDS = [
  { value: 'status', label: 'Estado', type: 'text' },
  { value: 'provider', label: 'Proveedor', type: 'text' },
  { value: 'engagement_score', label: 'Engagement Score', type: 'number' },
  { value: 'lead_score', label: 'Lead Score', type: 'number' },
  { value: 'total_sent', label: 'Total enviados', type: 'number' },
  { value: 'total_opened', label: 'Total abiertos', type: 'number' },
  { value: 'total_clicked', label: 'Total clics', type: 'number' },
  { value: 'empresa', label: 'Empresa', type: 'text' },
  { value: 'fuente', label: 'Fuente', type: 'text' },
  { value: 'tags', label: 'Tags', type: 'text' },
]

const TEXT_OPS = [
  { value: 'eq', label: 'es igual a' },
  { value: 'neq', label: 'no es igual a' },
  { value: 'contains', label: 'contiene' },
  { value: 'not_contains', label: 'no contiene' },
]

const NUMBER_OPS = [
  { value: 'eq', label: '=' },
  { value: 'neq', label: '≠' },
  { value: 'gt', label: '>' },
  { value: 'lt', label: '<' },
  { value: 'gte', label: '≥' },
  { value: 'lte', label: '≤' },
]

function getFieldType(fieldValue) {
  const f = FIELDS.find(x => x.value === fieldValue)
  return f ? f.type : 'text'
}

function getOpsForField(fieldValue) {
  return getFieldType(fieldValue) === 'number' ? NUMBER_OPS : TEXT_OPS
}

function ConditionRow({ condition, onChange, onRemove }) {
  const ops = getOpsForField(condition.field)
  const fieldType = getFieldType(condition.field)

  return (
    <div className="ve-segment-condition">
      <select
        className="ve-select"
        value={condition.field || ''}
        onChange={e => onChange({ ...condition, field: e.target.value, op: '', value: '' })}
      >
        <option value="">Campo…</option>
        {FIELDS.map(f => (
          <option key={f.value} value={f.value}>{f.label}</option>
        ))}
      </select>

      <select
        className="ve-select"
        value={condition.op || ''}
        onChange={e => onChange({ ...condition, op: e.target.value })}
      >
        <option value="">Operador…</option>
        {ops.map(o => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>

      <input
        className="ve-input"
        type={fieldType === 'number' ? 'number' : 'text'}
        placeholder="Valor…"
        value={condition.value ?? ''}
        onChange={e => onChange({ ...condition, value: e.target.value })}
      />

      <button className="ve-btn ve-btn--icon ve-btn--sm" onClick={onRemove} title="Eliminar condición">
        ✕
      </button>
    </div>
  )
}

function GroupNode({ group, onChange, onRemove, depth = 0 }) {
  const isAnd = group.operator === 'AND'
  const borderClass = isAnd ? 've-segment-group--and' : 've-segment-group--or'

  const updateCondition = useCallback((idx, updated) => {
    const next = [...group.conditions]
    next[idx] = updated
    onChange({ ...group, conditions: next })
  }, [group, onChange])

  const removeCondition = useCallback((idx) => {
    const next = group.conditions.filter((_, i) => i !== idx)
    onChange({ ...group, conditions: next })
  }, [group, onChange])

  const addCondition = useCallback(() => {
    onChange({
      ...group,
      conditions: [...group.conditions, { field: '', op: '', value: '' }],
    })
  }, [group, onChange])

  const addGroup = useCallback((op) => {
    onChange({
      ...group,
      conditions: [
        ...group.conditions,
        { operator: op, conditions: [{ field: '', op: '', value: '' }] },
      ],
    })
  }, [group, onChange])

  const toggleOperator = useCallback(() => {
    onChange({ ...group, operator: isAnd ? 'OR' : 'AND' })
  }, [group, isAnd, onChange])

  return (
    <div className={`ve-segment-group ${borderClass}`}>
      {group.conditions.map((cond, idx) => {
        const isNested = !!cond.operator
        return (
          <div key={idx}>
            {idx > 0 && (
              <button
                className="ve-segment-operator"
                onClick={toggleOperator}
                title="Cambiar operador"
                style={{ cursor: 'pointer', border: 'none' }}
              >
                {group.operator}
              </button>
            )}
            {isNested ? (
              <GroupNode
                group={cond}
                onChange={updated => updateCondition(idx, updated)}
                onRemove={() => removeCondition(idx)}
                depth={depth + 1}
              />
            ) : (
              <ConditionRow
                condition={cond}
                onChange={updated => updateCondition(idx, updated)}
                onRemove={() => removeCondition(idx)}
              />
            )}
          </div>
        )
      })}

      <div style={{ display: 'flex', gap: 'var(--space-sm)', flexWrap: 'wrap' }}>
        <button className="ve-segment-add-btn" onClick={addCondition}>
          + Añadir condición
        </button>
        <button className="ve-segment-add-btn" onClick={() => addGroup('AND')}>
          + Grupo AND
        </button>
        <button className="ve-segment-add-btn" onClick={() => addGroup('OR')}>
          + Grupo OR
        </button>
        {onRemove && depth > 0 && (
          <button className="ve-btn ve-btn--sm ve-btn--danger" onClick={onRemove}>
            Eliminar grupo
          </button>
        )}
      </div>
    </div>
  )
}

export default function SegmentRuleBuilder({ rules, onChange }) {
  if (!rules || !rules.operator) {
    const defaultRules = { operator: 'AND', conditions: [{ field: '', op: '', value: '' }] }
    return <GroupNode group={defaultRules} onChange={onChange} />
  }
  return (
    <div className="ve-segment-builder">
      <GroupNode group={rules} onChange={onChange} />
    </div>
  )
}
