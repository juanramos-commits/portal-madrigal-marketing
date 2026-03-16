import { useState, useEffect, useCallback } from 'react';

const EMPTY_FORM = {
  nombre: '',
  email: '',
  resend_api_key: '',
  notas: '',
  warmup_inicio: 5,
  warmup_incremento: 2,
  warmup_max: 50,
};

export default function CuentaFormModal({ open, onClose, onSave, cuenta }) {
  if (!open) return null;

  const [form, setForm] = useState(EMPTY_FORM);

  useEffect(() => {
    if (cuenta) {
      setForm({
        nombre: cuenta.nombre || '',
        email: cuenta.email || '',
        resend_api_key: cuenta.resend_api_key || '',
        notas: cuenta.notas || '',
        warmup_inicio: cuenta.warmup_inicio ?? 5,
        warmup_incremento: cuenta.warmup_incremento ?? 2,
        warmup_max: cuenta.warmup_max ?? 50,
      });
    } else {
      setForm(EMPTY_FORM);
    }
  }, [cuenta]);

  const handleChange = useCallback((field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  }, []);

  const handleSubmit = useCallback(
    (e) => {
      e.preventDefault();
      onSave(form);
    },
    [form, onSave]
  );

  const isEdit = Boolean(cuenta);

  return (
    <div className="ce-modal-overlay" onClick={onClose}>
      <div
        className="ce-modal ce-modal--cuenta-form"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="ce-modal-header">
          <h3 className="ce-modal-title">
            {isEdit ? 'Editar cuenta' : 'Nueva cuenta'}
          </h3>
          <button
            type="button"
            className="ce-modal-close"
            onClick={onClose}
          >
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="ce-modal-body">
            <div className="ce-form-field">
              <label className="ce-form-label">Nombre</label>
              <input
                type="text"
                className="ce-form-input"
                value={form.nombre}
                onChange={(e) => handleChange('nombre', e.target.value)}
                placeholder="Nombre identificador"
                required
              />
            </div>

            <div className="ce-form-field">
              <label className="ce-form-label">Email</label>
              <input
                type="email"
                className="ce-form-input"
                value={form.email}
                onChange={(e) => handleChange('email', e.target.value)}
                placeholder="email@dominio.com"
                required
              />
            </div>

            <div className="ce-form-field">
              <label className="ce-form-label">Resend API Key</label>
              <input
                type="password"
                className="ce-form-input"
                value={form.resend_api_key}
                onChange={(e) =>
                  handleChange('resend_api_key', e.target.value)
                }
                placeholder="re_..."
                required={!isEdit}
              />
            </div>

            <div className="ce-form-field">
              <label className="ce-form-label">Notas</label>
              <textarea
                className="ce-form-textarea"
                value={form.notas}
                onChange={(e) => handleChange('notas', e.target.value)}
                placeholder="Notas opcionales..."
                rows={3}
              />
            </div>

            <fieldset className="ce-form-fieldset">
              <legend className="ce-form-legend">Configuración Warm-up</legend>

              <div className="ce-form-row">
                <div className="ce-form-field ce-form-field--inline">
                  <label className="ce-form-label">Inicio</label>
                  <input
                    type="number"
                    className="ce-form-input ce-form-input--small"
                    value={form.warmup_inicio}
                    onChange={(e) =>
                      handleChange(
                        'warmup_inicio',
                        parseInt(e.target.value, 10) || 0
                      )
                    }
                    min={1}
                  />
                </div>

                <div className="ce-form-field ce-form-field--inline">
                  <label className="ce-form-label">Incremento</label>
                  <input
                    type="number"
                    className="ce-form-input ce-form-input--small"
                    value={form.warmup_incremento}
                    onChange={(e) =>
                      handleChange(
                        'warmup_incremento',
                        parseInt(e.target.value, 10) || 0
                      )
                    }
                    min={1}
                  />
                </div>

                <div className="ce-form-field ce-form-field--inline">
                  <label className="ce-form-label">Máximo</label>
                  <input
                    type="number"
                    className="ce-form-input ce-form-input--small"
                    value={form.warmup_max}
                    onChange={(e) =>
                      handleChange(
                        'warmup_max',
                        parseInt(e.target.value, 10) || 0
                      )
                    }
                    min={1}
                  />
                </div>
              </div>
            </fieldset>
          </div>

          <div className="ce-modal-footer">
            <button
              type="button"
              className="ce-btn ce-btn--secondary"
              onClick={onClose}
            >
              Cancelar
            </button>
            <button type="submit" className="ce-btn ce-btn--primary">
              {isEdit ? 'Guardar cambios' : 'Crear cuenta'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
