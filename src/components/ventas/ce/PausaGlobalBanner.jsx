export default function PausaGlobalBanner({ visible, onDesactivar }) {
  if (!visible) return null;

  return (
    <div className="ce-pausa-global-banner">
      <span className="ce-pausa-global-banner-icon">⚠</span>
      <span className="ce-pausa-global-banner-text">
        Envíos pausados globalmente
      </span>
      <button
        type="button"
        className="ce-pausa-global-banner-btn"
        onClick={onDesactivar}
      >
        Reanudar
      </button>
    </div>
  );
}
