import { memo } from 'react';
import EstadoBadge from './EstadoBadge';

function CuentaCard({ cuenta, onEdit, onTogglePause, onDelete }) {
  if (!cuenta) return null;

  const warmupPercent =
    cuenta.warmup_max > 0
      ? Math.min(
          100,
          Math.round((cuenta.warmup_dia_actual / cuenta.warmup_max) * 100)
        )
      : 0;

  const bounceRate =
    cuenta.total_enviados > 0
      ? ((cuenta.rebotes || 0) / cuenta.total_enviados * 100).toFixed(1)
      : '0.0';

  const complaintRate =
    cuenta.total_enviados > 0
      ? ((cuenta.quejas || 0) / cuenta.total_enviados * 100).toFixed(1)
      : '0.0';

  const isPaused = cuenta.estado === 'pausado' || cuenta.estado === 'pausada';

  return (
    <div className="ce-cuenta-card">
      <div className="ce-cuenta-card-header">
        <div className="ce-cuenta-card-info">
          <span className="ce-cuenta-card-nombre">{cuenta.nombre}</span>
          <span className="ce-cuenta-card-email">{cuenta.email}</span>
        </div>
        <EstadoBadge estado={cuenta.estado} tipo="cuenta" />
      </div>

      {cuenta.dominio && (
        <div className="ce-cuenta-card-dominio">
          Dominio: {cuenta.dominio}
        </div>
      )}

      <div className="ce-cuenta-card-warmup">
        <div className="ce-cuenta-card-warmup-header">
          <span className="ce-cuenta-card-warmup-label">Warm-up</span>
          <span className="ce-cuenta-card-warmup-value">
            Día {cuenta.warmup_dia_actual || 0} / {cuenta.warmup_max || 0}
          </span>
        </div>
        <div className="ce-cuenta-card-warmup-bar">
          <div
            className="ce-cuenta-card-warmup-fill"
            style={{ width: `${warmupPercent}%` }}
          />
        </div>
      </div>

      <div className="ce-cuenta-card-stats">
        <div className="ce-cuenta-card-stat">
          <span className="ce-cuenta-card-stat-label">Enviados hoy</span>
          <span className="ce-cuenta-card-stat-value">
            {cuenta.enviados_hoy || 0} / {cuenta.limite_diario || 0}
          </span>
        </div>
        <div className="ce-cuenta-card-stat">
          <span className="ce-cuenta-card-stat-label">Bounce</span>
          <span className="ce-cuenta-card-stat-value">{bounceRate}%</span>
        </div>
        <div className="ce-cuenta-card-stat">
          <span className="ce-cuenta-card-stat-label">Quejas</span>
          <span className="ce-cuenta-card-stat-value">{complaintRate}%</span>
        </div>
      </div>

      <div className="ce-cuenta-card-actions">
        <button
          type="button"
          className="ce-btn ce-btn--small ce-btn--secondary"
          onClick={() => onEdit(cuenta)}
        >
          Editar
        </button>
        <button
          type="button"
          className={`ce-btn ce-btn--small ${isPaused ? 'ce-btn--success' : 'ce-btn--warning'}`}
          onClick={() => onTogglePause(cuenta)}
        >
          {isPaused ? 'Activar' : 'Pausar'}
        </button>
        <button
          type="button"
          className="ce-btn ce-btn--small ce-btn--danger"
          onClick={() => onDelete(cuenta)}
        >
          Eliminar
        </button>
      </div>
    </div>
  );
}

export default memo(CuentaCard);
