import { useMemo } from 'react';

function formatTimestamp(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  return d.toLocaleString('es-MX', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function RespuestaHilo({ envios = [], respuestas = [], contacto }) {
  const messages = useMemo(() => {
    const all = [];

    envios.forEach((e) => {
      all.push({
        id: e.id || `envio-${e.fecha || Math.random()}`,
        tipo: 'envio',
        sender: e.cuenta_email || 'Tú',
        body: e.cuerpo || e.body || '',
        fecha: e.fecha || e.created_at,
      });
    });

    respuestas.forEach((r) => {
      all.push({
        id: r.id || `resp-${r.fecha || Math.random()}`,
        tipo: 'respuesta',
        sender: contacto?.nombre || contacto?.email || 'Contacto',
        body: r.cuerpo || r.body || '',
        fecha: r.fecha || r.created_at,
      });
    });

    all.sort((a, b) => new Date(a.fecha) - new Date(b.fecha));
    return all;
  }, [envios, respuestas, contacto]);

  if (messages.length === 0) {
    return (
      <div className="ce-hilo ce-hilo--empty">
        No hay mensajes en este hilo.
      </div>
    );
  }

  return (
    <div className="ce-hilo">
      {messages.map((msg) => (
        <div
          key={msg.id}
          className={`ce-hilo-bubble ce-hilo-bubble--${msg.tipo}`}
        >
          <div className="ce-hilo-bubble-sender">{msg.sender}</div>
          <div className="ce-hilo-bubble-body">{msg.body}</div>
          <div className="ce-hilo-bubble-time">
            {formatTimestamp(msg.fecha)}
          </div>
        </div>
      ))}
    </div>
  );
}
