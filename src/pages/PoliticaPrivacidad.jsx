import { Link } from 'react-router-dom'

export default function PoliticaPrivacidad() {
  return (
    <div className="login-page" style={{ overflow: 'auto' }}>
      <div style={{
        maxWidth: '800px', margin: '0 auto', padding: '40px 24px',
        color: 'var(--text)', lineHeight: 1.7, fontSize: '14px'
      }}>
        <Link to="/login" style={{ color: '#3b82f6', textDecoration: 'none', fontSize: '13px' }}>
          &larr; Volver al inicio
        </Link>

        <h1 style={{ fontSize: '28px', fontWeight: 700, margin: '24px 0 8px' }}>Política de Privacidad</h1>
        <p style={{ color: 'var(--text-muted)', marginBottom: '32px' }}>Última actualización: 19 de febrero de 2026</p>

        <Section title="1. Responsable del Tratamiento">
          <p><strong>Estrategias Madrigal Marketing S.L.</strong></p>
          <p>Email de contacto: [email de contacto para protección de datos]</p>
        </Section>

        <Section title="2. Datos que recogemos">
          <ul>
            <li><strong>Datos de cuenta:</strong> nombre, email, contraseña (cifrada)</li>
            <li><strong>Datos de clientes:</strong> nombre empresa, contacto, email, teléfono, datos fiscales (CIF/NIF, dirección)</li>
            <li><strong>Datos de actividad:</strong> registro de acciones realizadas en la plataforma, fechas de acceso</li>
            <li><strong>Datos técnicos:</strong> dirección IP (solo en intentos de login), tipo de navegador</li>
          </ul>
        </Section>

        <Section title="3. Finalidad del tratamiento">
          <ul>
            <li>Gestión de la relación comercial con clientes</li>
            <li>Facturación y cumplimiento de obligaciones fiscales</li>
            <li>Seguridad del sistema y detección de accesos no autorizados</li>
            <li>Gestión interna del equipo</li>
          </ul>
        </Section>

        <Section title="4. Base legal">
          <ul>
            <li><strong>Contrato:</strong> gestión de clientes y facturación</li>
            <li><strong>Obligación legal:</strong> conservación de datos fiscales (Ley del IVA, Código de Comercio)</li>
            <li><strong>Interés legítimo:</strong> seguridad del sistema, gestión del equipo</li>
          </ul>
        </Section>

        <Section title="5. Período de retención">
          <ul>
            <li>Datos de usuario: mientras la cuenta esté activa + 3 años</li>
            <li>Datos de clientes: vigencia del contrato + 5 años</li>
            <li>Datos fiscales (facturas): 5-6 años por obligación legal</li>
            <li>Registros de seguridad: 90 días - 1 año según tipo</li>
          </ul>
        </Section>

        <Section title="6. Tus derechos">
          <p>Tienes derecho a:</p>
          <ul>
            <li><strong>Acceso:</strong> solicitar una copia de tus datos personales</li>
            <li><strong>Rectificación:</strong> corregir datos inexactos</li>
            <li><strong>Supresión:</strong> solicitar la eliminación de tus datos (con las excepciones legales)</li>
            <li><strong>Portabilidad:</strong> recibir tus datos en formato estructurado</li>
            <li><strong>Oposición:</strong> oponerte a determinados tratamientos</li>
            <li><strong>Limitación:</strong> solicitar la limitación del tratamiento</li>
          </ul>
          <p>Para ejercer estos derechos, contacta con nosotros en el email indicado arriba.</p>
        </Section>

        <Section title="7. Transferencias internacionales">
          <p>Los datos se almacenan en servidores gestionados por Supabase. Verificamos que los datos
          se alojan en regiones que cumplen con la normativa europea o que existan las garantías
          adecuadas (Cláusulas Contractuales Tipo).</p>
        </Section>

        <Section title="8. Cookies">
          <p>Utilizamos cookies estrictamente necesarias para el funcionamiento de la aplicación
          (autenticación y preferencias de usuario). No utilizamos cookies de marketing ni analítica
          de terceros.</p>
        </Section>

        <Section title="9. Seguridad">
          <p>Implementamos medidas técnicas y organizativas para proteger tus datos, incluyendo
          cifrado en tránsito, control de acceso por roles, autenticación multifactor, auditoría
          de acciones y políticas de contraseñas robustas.</p>
        </Section>

        <Section title="10. Autoridad de control">
          <p>Puedes presentar una reclamación ante la Agencia Española de Protección de Datos (AEPD)
          en <a href="https://www.aepd.es" target="_blank" rel="noopener noreferrer" style={{ color: '#3b82f6' }}>www.aepd.es</a>.</p>
        </Section>

        <p style={{ color: 'var(--text-muted)', fontSize: '12px', marginTop: '40px', textAlign: 'center' }}>
          &copy; 2026 Estrategias Madrigal Marketing S.L.
        </p>
      </div>
    </div>
  )
}

function Section({ title, children }) {
  return (
    <div style={{ marginBottom: '28px' }}>
      <h2 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '8px' }}>{title}</h2>
      {children}
    </div>
  )
}
