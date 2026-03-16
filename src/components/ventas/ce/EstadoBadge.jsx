import { memo } from 'react';

const ESTADO_LABELS = {
  activo: 'Activo',
  pausado: 'Pausado',
  completado: 'Completado',
  respondido: 'Respondido',
  interesado: 'Interesado',
  no_ahora: 'No ahora',
  baja: 'Baja',
  negativo: 'Negativo',
  rebotado: 'Rebotado',
  queja: 'Queja',
  borrador: 'Borrador',
  activa: 'Activa',
  pausada: 'Pausada',
  archivada: 'Archivada',
  pendiente: 'Pendiente',
  enviado: 'Enviado',
  entregado: 'Entregado',
  abierto: 'Abierto',
  error: 'Error',
};

function EstadoBadge({ estado, tipo }) {
  if (!estado) return null;

  const label = ESTADO_LABELS[estado] || estado;
  const badgeClass = `ce-badge ce-badge-${estado}`;

  return (
    <span className={badgeClass} data-tipo={tipo || undefined}>
      <span className="ce-badge-dot" />
      <span className="ce-badge-label">{label}</span>
    </span>
  );
}

export default memo(EstadoBadge);
