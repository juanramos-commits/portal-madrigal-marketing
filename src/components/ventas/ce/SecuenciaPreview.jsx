import { useMemo } from 'react';

function replaceVariables(text, contacto) {
  if (!text || !contacto) return text || '';

  let result = text;
  result = result.replace(/\{\{nombre\}\}/g, contacto.nombre || '');
  result = result.replace(/\{\{empresa\}\}/g, contacto.empresa || '');
  result = result.replace(/\{\{cargo\}\}/g, contacto.cargo || '');
  result = result.replace(/\{\{email\}\}/g, contacto.email || '');

  const dominio = contacto.email
    ? contacto.email.split('@')[1] || ''
    : contacto.dominio_empresa || '';
  result = result.replace(/\{\{dominio_empresa\}\}/g, dominio);

  return result;
}

export default function SecuenciaPreview({ paso, contacto, variante = 'a' }) {
  const asunto = useMemo(() => {
    const raw = variante === 'b' ? paso?.asunto_b : paso?.asunto;
    return replaceVariables(raw || '', contacto);
  }, [paso, contacto, variante]);

  const cuerpo = useMemo(() => {
    const raw = variante === 'b' ? paso?.cuerpo_b : paso?.cuerpo;
    return replaceVariables(raw || '', contacto);
  }, [paso, contacto, variante]);

  if (!paso) {
    return (
      <div className="ce-preview ce-preview--empty">
        Selecciona un paso para ver la vista previa.
      </div>
    );
  }

  return (
    <div className="ce-preview">
      <div className="ce-preview-header">
        <div className="ce-preview-field">
          <span className="ce-preview-label">De:</span>
          <span className="ce-preview-value">
            {paso.cuenta_email || 'cuenta@ejemplo.com'}
          </span>
        </div>
        <div className="ce-preview-field">
          <span className="ce-preview-label">Para:</span>
          <span className="ce-preview-value">
            {contacto?.email || 'contacto@ejemplo.com'}
          </span>
        </div>
        <div className="ce-preview-field">
          <span className="ce-preview-label">Asunto:</span>
          <span className="ce-preview-value ce-preview-value--subject">
            {asunto || '(sin asunto)'}
          </span>
        </div>
      </div>
      <div className="ce-preview-body">
        {cuerpo ? (
          <pre className="ce-preview-body-text">{cuerpo}</pre>
        ) : (
          <span className="ce-preview-body-empty">(sin contenido)</span>
        )}
      </div>
    </div>
  );
}
