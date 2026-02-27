-- ==========================================================================
-- MADRIGAL CRM - MÓDULO DE VENTAS COMPLETO
-- Ejecutar en Supabase SQL Editor
-- Fecha: 2026-02-26
-- ==========================================================================
-- Este archivo crea TODAS las tablas, funciones RPC, triggers, políticas RLS,
-- permisos y datos semilla del módulo de ventas.
-- NO modifica ninguna tabla existente. Solo usa CREATE.
-- ==========================================================================

BEGIN;

-- ==========================================================================
-- PARTE 1: FUNCIÓN AUXILIAR — updated_at automático
-- ==========================================================================
-- Reutilizamos la función update_updated_at_column() existente en 002.
-- Si no existiera, la creamos aquí de forma segura.

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ==========================================================================
-- PARTE 1b: FUNCIÓN AUXILIAR — verificar rol comercial del usuario actual
-- ==========================================================================
-- Devuelve TRUE si el usuario autenticado tiene un rol comercial específico
-- (o cualquier rol comercial si se pasa NULL).

CREATE OR REPLACE FUNCTION ventas_tiene_rol(p_rol TEXT DEFAULT NULL)
RETURNS BOOLEAN AS $$
BEGIN
    IF p_rol IS NULL THEN
        RETURN EXISTS (
            SELECT 1 FROM ventas_roles_comerciales
            WHERE usuario_id = auth.uid()::uuid
            AND activo = true
        );
    END IF;
    RETURN EXISTS (
        SELECT 1 FROM ventas_roles_comerciales
        WHERE usuario_id = auth.uid()::uuid
        AND rol = p_rol
        AND activo = true
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Función auxiliar: ¿es super_admin o director_ventas?
CREATE OR REPLACE FUNCTION ventas_es_admin_o_director()
RETURNS BOOLEAN AS $$
DECLARE
    v_tipo VARCHAR;
BEGIN
    SELECT tipo INTO v_tipo FROM usuarios WHERE id = auth.uid()::uuid;
    IF v_tipo = 'super_admin' THEN RETURN TRUE; END IF;
    RETURN EXISTS (
        SELECT 1 FROM ventas_roles_comerciales
        WHERE usuario_id = auth.uid()::uuid
        AND rol IN ('super_admin', 'director_ventas')
        AND activo = true
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Función auxiliar: ¿es super_admin del sistema?
CREATE OR REPLACE FUNCTION ventas_es_super_admin()
RETURNS BOOLEAN AS $$
DECLARE
    v_tipo VARCHAR;
BEGIN
    SELECT tipo INTO v_tipo FROM usuarios WHERE id = auth.uid()::uuid;
    IF v_tipo = 'super_admin' THEN RETURN TRUE; END IF;
    RETURN EXISTS (
        SELECT 1 FROM ventas_roles_comerciales
        WHERE usuario_id = auth.uid()::uuid
        AND rol = 'super_admin'
        AND activo = true
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- ==========================================================================
-- PARTE 2: TABLAS
-- ==========================================================================

-- --------------------------------------------------------------------------
-- 2.1 ventas_roles_comerciales
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ventas_roles_comerciales (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    usuario_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    rol VARCHAR(20) NOT NULL CHECK (rol IN ('setter', 'closer', 'director_ventas', 'super_admin')),
    activo BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(usuario_id, rol)
);

CREATE INDEX IF NOT EXISTS idx_vrc_usuario ON ventas_roles_comerciales(usuario_id);
CREATE INDEX IF NOT EXISTS idx_vrc_rol ON ventas_roles_comerciales(rol);

-- --------------------------------------------------------------------------
-- 2.2 ventas_pipelines
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ventas_pipelines (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre VARCHAR(100) NOT NULL,
    descripcion TEXT,
    orden INTEGER DEFAULT 0,
    activo BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TRIGGER trg_ventas_pipelines_updated_at
    BEFORE UPDATE ON ventas_pipelines
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- --------------------------------------------------------------------------
-- 2.3 ventas_etapas
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ventas_etapas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pipeline_id UUID NOT NULL REFERENCES ventas_pipelines(id) ON DELETE CASCADE,
    nombre VARCHAR(100) NOT NULL,
    color VARCHAR(7) DEFAULT '#6B7280',
    icono VARCHAR(50),
    orden INTEGER DEFAULT 0,
    es_final BOOLEAN DEFAULT false,
    tipo VARCHAR(30) DEFAULT 'normal' CHECK (tipo IN ('normal', 'ghosting', 'seguimiento', 'venta', 'lost', 'devolucion', 'cita_realizada')),
    max_intentos INTEGER,
    activo BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ve_pipeline ON ventas_etapas(pipeline_id);
CREATE INDEX IF NOT EXISTS idx_ve_tipo ON ventas_etapas(tipo);

CREATE TRIGGER trg_ventas_etapas_updated_at
    BEFORE UPDATE ON ventas_etapas
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- --------------------------------------------------------------------------
-- 2.4 ventas_etiquetas
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ventas_etiquetas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre VARCHAR(100) NOT NULL,
    color VARCHAR(7) DEFAULT '#6B7280',
    activo BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TRIGGER trg_ventas_etiquetas_updated_at
    BEFORE UPDATE ON ventas_etiquetas
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- --------------------------------------------------------------------------
-- 2.5 ventas_categorias
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ventas_categorias (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre VARCHAR(100) NOT NULL UNIQUE,
    activo BOOLEAN DEFAULT true,
    orden INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TRIGGER trg_ventas_categorias_updated_at
    BEFORE UPDATE ON ventas_categorias
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- --------------------------------------------------------------------------
-- 2.6 ventas_paquetes
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ventas_paquetes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre VARCHAR(150) NOT NULL,
    descripcion TEXT,
    precio DECIMAL(10,2) NOT NULL,
    activo BOOLEAN DEFAULT true,
    orden INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TRIGGER trg_ventas_paquetes_updated_at
    BEFORE UPDATE ON ventas_paquetes
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- --------------------------------------------------------------------------
-- 2.7 ventas_webhooks (antes de leads por FK)
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ventas_webhooks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre VARCHAR(150) NOT NULL,
    endpoint_token VARCHAR(64) NOT NULL UNIQUE,
    fuente VARCHAR(100),
    mapeo_campos JSONB NOT NULL DEFAULT '{}',
    activo BOOLEAN DEFAULT true,
    creado_por_id UUID REFERENCES usuarios(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TRIGGER trg_ventas_webhooks_updated_at
    BEFORE UPDATE ON ventas_webhooks
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- --------------------------------------------------------------------------
-- 2.8 ventas_leads
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ventas_leads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre VARCHAR(255) NOT NULL,
    email VARCHAR(255),
    telefono VARCHAR(50),
    contactos_adicionales TEXT,
    nombre_negocio VARCHAR(255),
    categoria_id UUID REFERENCES ventas_categorias(id) ON DELETE SET NULL,
    fuente VARCHAR(100),
    fuente_detalle VARCHAR(255),
    setter_asignado_id UUID REFERENCES usuarios(id) ON DELETE SET NULL,
    closer_asignado_id UUID REFERENCES usuarios(id) ON DELETE SET NULL,
    notas TEXT,
    resumen_setter TEXT,
    resumen_closer TEXT,
    enlace_grabacion VARCHAR(500),
    valor DECIMAL(10,2) DEFAULT 0,
    tags TEXT[],
    datos_extra JSONB DEFAULT '{}',
    creado_por VARCHAR(50),
    webhook_id UUID REFERENCES ventas_webhooks(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_vl_setter ON ventas_leads(setter_asignado_id);
CREATE INDEX IF NOT EXISTS idx_vl_closer ON ventas_leads(closer_asignado_id);
CREATE INDEX IF NOT EXISTS idx_vl_categoria ON ventas_leads(categoria_id);
CREATE INDEX IF NOT EXISTS idx_vl_email ON ventas_leads(email);
CREATE INDEX IF NOT EXISTS idx_vl_telefono ON ventas_leads(telefono);
CREATE INDEX IF NOT EXISTS idx_vl_created ON ventas_leads(created_at);

CREATE TRIGGER trg_ventas_leads_updated_at
    BEFORE UPDATE ON ventas_leads
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- --------------------------------------------------------------------------
-- 2.9 ventas_lead_etiquetas
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ventas_lead_etiquetas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lead_id UUID NOT NULL REFERENCES ventas_leads(id) ON DELETE CASCADE,
    etiqueta_id UUID NOT NULL REFERENCES ventas_etiquetas(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(lead_id, etiqueta_id)
);

CREATE INDEX IF NOT EXISTS idx_vle_lead ON ventas_lead_etiquetas(lead_id);

-- --------------------------------------------------------------------------
-- 2.10 ventas_lead_pipeline
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ventas_lead_pipeline (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lead_id UUID NOT NULL REFERENCES ventas_leads(id) ON DELETE CASCADE,
    pipeline_id UUID NOT NULL REFERENCES ventas_pipelines(id) ON DELETE CASCADE,
    etapa_id UUID REFERENCES ventas_etapas(id) ON DELETE SET NULL,
    contador_intentos INTEGER DEFAULT 0,
    fecha_entrada TIMESTAMPTZ DEFAULT now(),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(lead_id, pipeline_id)
);

CREATE INDEX IF NOT EXISTS idx_vlp_lead ON ventas_lead_pipeline(lead_id);
CREATE INDEX IF NOT EXISTS idx_vlp_pipeline ON ventas_lead_pipeline(pipeline_id);
CREATE INDEX IF NOT EXISTS idx_vlp_etapa ON ventas_lead_pipeline(etapa_id);

CREATE TRIGGER trg_ventas_lead_pipeline_updated_at
    BEFORE UPDATE ON ventas_lead_pipeline
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- --------------------------------------------------------------------------
-- 2.11 ventas_actividad
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ventas_actividad (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lead_id UUID NOT NULL REFERENCES ventas_leads(id) ON DELETE CASCADE,
    usuario_id UUID REFERENCES usuarios(id) ON DELETE SET NULL,
    tipo VARCHAR(50) NOT NULL,
    descripcion TEXT NOT NULL,
    datos JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_va_lead ON ventas_actividad(lead_id);
CREATE INDEX IF NOT EXISTS idx_va_usuario ON ventas_actividad(usuario_id);
CREATE INDEX IF NOT EXISTS idx_va_tipo ON ventas_actividad(tipo);
CREATE INDEX IF NOT EXISTS idx_va_created ON ventas_actividad(created_at);

-- --------------------------------------------------------------------------
-- 2.12 ventas_reunion_estados (antes de citas por FK)
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ventas_reunion_estados (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre VARCHAR(100) NOT NULL,
    color VARCHAR(7) DEFAULT '#6B7280',
    es_obligatorio_grabacion BOOLEAN DEFAULT false,
    orden INTEGER DEFAULT 0,
    activo BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TRIGGER trg_ventas_reunion_estados_updated_at
    BEFORE UPDATE ON ventas_reunion_estados
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- --------------------------------------------------------------------------
-- 2.13 ventas_enlaces_agenda (antes de citas por FK)
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ventas_enlaces_agenda (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre VARCHAR(150) NOT NULL,
    slug VARCHAR(100) NOT NULL UNIQUE,
    setter_id UUID REFERENCES usuarios(id) ON DELETE SET NULL,
    fuente VARCHAR(100),
    activo BOOLEAN DEFAULT true,
    creado_por_id UUID REFERENCES usuarios(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TRIGGER trg_ventas_enlaces_agenda_updated_at
    BEFORE UPDATE ON ventas_enlaces_agenda
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- --------------------------------------------------------------------------
-- 2.14 ventas_citas
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ventas_citas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lead_id UUID NOT NULL REFERENCES ventas_leads(id) ON DELETE CASCADE,
    closer_id UUID REFERENCES usuarios(id) ON DELETE SET NULL,
    setter_origen_id UUID REFERENCES usuarios(id) ON DELETE SET NULL,
    enlace_agenda_id UUID REFERENCES ventas_enlaces_agenda(id) ON DELETE SET NULL,
    fecha_hora TIMESTAMPTZ NOT NULL,
    duracion_minutos INTEGER DEFAULT 60,
    google_meet_url VARCHAR(500),
    google_event_id VARCHAR(255),
    estado VARCHAR(30) DEFAULT 'agendada',
    estado_reunion_id UUID REFERENCES ventas_reunion_estados(id) ON DELETE SET NULL,
    notas_closer TEXT,
    cancelada_por VARCHAR(20),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_vc_lead ON ventas_citas(lead_id);
CREATE INDEX IF NOT EXISTS idx_vc_closer ON ventas_citas(closer_id);
CREATE INDEX IF NOT EXISTS idx_vc_setter ON ventas_citas(setter_origen_id);
CREATE INDEX IF NOT EXISTS idx_vc_fecha ON ventas_citas(fecha_hora);
CREATE INDEX IF NOT EXISTS idx_vc_estado ON ventas_citas(estado);

CREATE TRIGGER trg_ventas_citas_updated_at
    BEFORE UPDATE ON ventas_citas
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- --------------------------------------------------------------------------
-- 2.15 ventas_calendario_disponibilidad
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ventas_calendario_disponibilidad (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    usuario_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    dia_semana INTEGER NOT NULL CHECK (dia_semana >= 0 AND dia_semana <= 6),
    hora_inicio TIME NOT NULL,
    hora_fin TIME NOT NULL,
    activo BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_vcd_usuario ON ventas_calendario_disponibilidad(usuario_id);

CREATE TRIGGER trg_ventas_calendario_disponibilidad_updated_at
    BEFORE UPDATE ON ventas_calendario_disponibilidad
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- --------------------------------------------------------------------------
-- 2.16 ventas_calendario_bloqueos
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ventas_calendario_bloqueos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    usuario_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    fecha_inicio TIMESTAMPTZ NOT NULL,
    fecha_fin TIMESTAMPTZ NOT NULL,
    motivo VARCHAR(255),
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_vcb_usuario ON ventas_calendario_bloqueos(usuario_id);

-- --------------------------------------------------------------------------
-- 2.17 ventas_calendario_config
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ventas_calendario_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    usuario_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE UNIQUE,
    duracion_slot_minutos INTEGER DEFAULT 60,
    descanso_entre_citas_minutos INTEGER DEFAULT 15,
    minimo_horas_semana INTEGER,
    google_calendar_token JSONB,
    google_calendar_id VARCHAR(255),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TRIGGER trg_ventas_calendario_config_updated_at
    BEFORE UPDATE ON ventas_calendario_config
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- --------------------------------------------------------------------------
-- 2.18 ventas_ventas
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ventas_ventas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lead_id UUID REFERENCES ventas_leads(id) ON DELETE SET NULL,
    closer_id UUID REFERENCES usuarios(id) ON DELETE SET NULL,
    setter_id UUID REFERENCES usuarios(id) ON DELETE SET NULL,
    paquete_id UUID REFERENCES ventas_paquetes(id) ON DELETE SET NULL,
    fecha_venta DATE NOT NULL,
    importe DECIMAL(10,2) NOT NULL,
    metodo_pago VARCHAR(50) CHECK (metodo_pago IN ('stripe', 'sequra', 'transferencia')),
    estado VARCHAR(20) DEFAULT 'pendiente' CHECK (estado IN ('pendiente', 'aprobada', 'rechazada')),
    es_pago_unico BOOLEAN DEFAULT false,
    aprobada_por_id UUID REFERENCES usuarios(id) ON DELETE SET NULL,
    fecha_aprobacion TIMESTAMPTZ,
    fecha_rechazo TIMESTAMPTZ,
    es_devolucion BOOLEAN DEFAULT false,
    fecha_devolucion TIMESTAMPTZ,
    notas TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_vv_lead ON ventas_ventas(lead_id);
CREATE INDEX IF NOT EXISTS idx_vv_closer ON ventas_ventas(closer_id);
CREATE INDEX IF NOT EXISTS idx_vv_setter ON ventas_ventas(setter_id);
CREATE INDEX IF NOT EXISTS idx_vv_estado ON ventas_ventas(estado);
CREATE INDEX IF NOT EXISTS idx_vv_fecha ON ventas_ventas(fecha_venta);

CREATE TRIGGER trg_ventas_ventas_updated_at
    BEFORE UPDATE ON ventas_ventas
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- --------------------------------------------------------------------------
-- 2.19 ventas_comisiones_config
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ventas_comisiones_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rol VARCHAR(20) NOT NULL CHECK (rol IN ('setter', 'closer', 'director_ventas')),
    comision_fija DECIMAL(10,2) NOT NULL DEFAULT 0,
    bonus_pago_unico DECIMAL(10,2) NOT NULL DEFAULT 0,
    activo BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TRIGGER trg_ventas_comisiones_config_updated_at
    BEFORE UPDATE ON ventas_comisiones_config
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- --------------------------------------------------------------------------
-- 2.20 ventas_comisiones
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ventas_comisiones (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    venta_id UUID NOT NULL REFERENCES ventas_ventas(id) ON DELETE CASCADE,
    usuario_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    rol VARCHAR(20) NOT NULL,
    monto DECIMAL(10,2) NOT NULL,
    concepto VARCHAR(255) NOT NULL,
    es_bonus BOOLEAN DEFAULT false,
    es_bonus_manual BOOLEAN DEFAULT false,
    disponible_desde TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_vcom_venta ON ventas_comisiones(venta_id);
CREATE INDEX IF NOT EXISTS idx_vcom_usuario ON ventas_comisiones(usuario_id);
CREATE INDEX IF NOT EXISTS idx_vcom_disponible ON ventas_comisiones(disponible_desde);

-- --------------------------------------------------------------------------
-- 2.21 ventas_wallet
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ventas_wallet (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    usuario_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE UNIQUE,
    saldo DECIMAL(10,2) DEFAULT 0,
    total_ganado DECIMAL(10,2) DEFAULT 0,
    total_retirado DECIMAL(10,2) DEFAULT 0,
    total_descontado DECIMAL(10,2) DEFAULT 0,
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- --------------------------------------------------------------------------
-- 2.22 ventas_datos_fiscales
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ventas_datos_fiscales (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    usuario_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE UNIQUE,
    nombre_fiscal VARCHAR(255),
    nif_cif VARCHAR(50),
    direccion TEXT,
    ciudad VARCHAR(100),
    codigo_postal VARCHAR(20),
    pais VARCHAR(100),
    serie_factura VARCHAR(20) DEFAULT 'F',
    siguiente_numero_factura INTEGER DEFAULT 1,
    iva_porcentaje DECIMAL(5,2) DEFAULT 0,
    iva_incluido BOOLEAN DEFAULT false,
    cuenta_bancaria_iban VARCHAR(34),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TRIGGER trg_ventas_datos_fiscales_updated_at
    BEFORE UPDATE ON ventas_datos_fiscales
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- --------------------------------------------------------------------------
-- 2.23 ventas_empresa_fiscal
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ventas_empresa_fiscal (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre_fiscal VARCHAR(255) NOT NULL,
    cif VARCHAR(20) NOT NULL,
    direccion TEXT,
    ciudad VARCHAR(100),
    codigo_postal VARCHAR(20),
    pais VARCHAR(100) DEFAULT 'España',
    concepto_factura VARCHAR(255) DEFAULT 'Servicios de intermediación comercial',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TRIGGER trg_ventas_empresa_fiscal_updated_at
    BEFORE UPDATE ON ventas_empresa_fiscal
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- --------------------------------------------------------------------------
-- 2.24 ventas_facturas
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ventas_facturas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    retiro_id UUID,
    usuario_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    numero_factura VARCHAR(50) NOT NULL,
    fecha_emision DATE NOT NULL,
    emisor_nombre VARCHAR(255),
    emisor_nif VARCHAR(50),
    emisor_direccion TEXT,
    emisor_ciudad VARCHAR(100),
    emisor_cp VARCHAR(20),
    emisor_pais VARCHAR(100),
    receptor_nombre VARCHAR(255),
    receptor_cif VARCHAR(20),
    receptor_direccion TEXT,
    receptor_ciudad VARCHAR(100),
    receptor_cp VARCHAR(20),
    receptor_pais VARCHAR(100),
    concepto VARCHAR(255) DEFAULT 'Servicios de intermediación comercial',
    base_imponible DECIMAL(10,2) NOT NULL,
    iva_porcentaje DECIMAL(5,2) DEFAULT 0,
    iva_monto DECIMAL(10,2) DEFAULT 0,
    total DECIMAL(10,2) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_vf_usuario ON ventas_facturas(usuario_id);
CREATE INDEX IF NOT EXISTS idx_vf_retiro ON ventas_facturas(retiro_id);

-- --------------------------------------------------------------------------
-- 2.25 ventas_retiros (después de facturas para poder referenciar)
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ventas_retiros (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    usuario_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    monto DECIMAL(10,2) NOT NULL,
    estado VARCHAR(20) DEFAULT 'pendiente' CHECK (estado IN ('pendiente', 'aprobado', 'rechazado')),
    factura_id UUID REFERENCES ventas_facturas(id) ON DELETE SET NULL,
    cuenta_bancaria_iban VARCHAR(34),
    aprobado_por_id UUID REFERENCES usuarios(id) ON DELETE SET NULL,
    fecha_aprobacion TIMESTAMPTZ,
    fecha_rechazo TIMESTAMPTZ,
    motivo_rechazo TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_vr_usuario ON ventas_retiros(usuario_id);
CREATE INDEX IF NOT EXISTS idx_vr_estado ON ventas_retiros(estado);

CREATE TRIGGER trg_ventas_retiros_updated_at
    BEFORE UPDATE ON ventas_retiros
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Ahora agregar FK de facturas a retiros
ALTER TABLE ventas_facturas
    ADD CONSTRAINT fk_ventas_facturas_retiro
    FOREIGN KEY (retiro_id) REFERENCES ventas_retiros(id) ON DELETE SET NULL;

-- --------------------------------------------------------------------------
-- 2.26 ventas_biblioteca_secciones
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ventas_biblioteca_secciones (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre VARCHAR(150) NOT NULL,
    descripcion TEXT,
    orden INTEGER DEFAULT 0,
    activo BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TRIGGER trg_ventas_biblioteca_secciones_updated_at
    BEFORE UPDATE ON ventas_biblioteca_secciones
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- --------------------------------------------------------------------------
-- 2.27 ventas_biblioteca_recursos
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ventas_biblioteca_recursos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    seccion_id UUID NOT NULL REFERENCES ventas_biblioteca_secciones(id) ON DELETE CASCADE,
    nombre VARCHAR(200) NOT NULL,
    descripcion TEXT,
    url VARCHAR(500) NOT NULL,
    tipo VARCHAR(50),
    orden INTEGER DEFAULT 0,
    visible_para TEXT[] DEFAULT '{setter,closer,director_ventas,super_admin}',
    activo BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_vbr_seccion ON ventas_biblioteca_recursos(seccion_id);

CREATE TRIGGER trg_ventas_biblioteca_recursos_updated_at
    BEFORE UPDATE ON ventas_biblioteca_recursos
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- --------------------------------------------------------------------------
-- 2.28 ventas_notificaciones
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ventas_notificaciones (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    usuario_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    tipo VARCHAR(50) NOT NULL,
    titulo VARCHAR(255) NOT NULL,
    mensaje TEXT,
    datos JSONB DEFAULT '{}',
    leida BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_vn_usuario ON ventas_notificaciones(usuario_id);
CREATE INDEX IF NOT EXISTS idx_vn_leida ON ventas_notificaciones(leida);
CREATE INDEX IF NOT EXISTS idx_vn_created ON ventas_notificaciones(created_at);

-- --------------------------------------------------------------------------
-- 2.29 ventas_webhook_logs
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ventas_webhook_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    webhook_id UUID NOT NULL REFERENCES ventas_webhooks(id) ON DELETE CASCADE,
    payload JSONB NOT NULL,
    resultado VARCHAR(20) CHECK (resultado IN ('exito', 'error')),
    mensaje_error TEXT,
    lead_creado_id UUID REFERENCES ventas_leads(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_vwl_webhook ON ventas_webhook_logs(webhook_id);

-- --------------------------------------------------------------------------
-- 2.30 ventas_reparto_config
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ventas_reparto_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    setter_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE UNIQUE,
    porcentaje INTEGER NOT NULL CHECK (porcentaje >= 0 AND porcentaje <= 100),
    activo BOOLEAN DEFAULT true,
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- --------------------------------------------------------------------------
-- 2.31 ventas_campos_obligatorios
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ventas_campos_obligatorios (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campo VARCHAR(100) NOT NULL UNIQUE,
    es_obligatorio BOOLEAN DEFAULT false,
    aplica_a VARCHAR(20) DEFAULT 'closer',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TRIGGER trg_ventas_campos_obligatorios_updated_at
    BEFORE UPDATE ON ventas_campos_obligatorios
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


-- ==========================================================================
-- PARTE 3: TRIGGERS
-- ==========================================================================

-- --------------------------------------------------------------------------
-- 3.1 trigger_wallet_crear
-- Al insertar en ventas_roles_comerciales → crear wallet si no existe.
-- --------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION trg_fn_wallet_crear()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO ventas_wallet (usuario_id)
    VALUES (NEW.usuario_id)
    ON CONFLICT (usuario_id) DO NOTHING;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_ventas_wallet_crear
    AFTER INSERT ON ventas_roles_comerciales
    FOR EACH ROW EXECUTE FUNCTION trg_fn_wallet_crear();

-- --------------------------------------------------------------------------
-- 3.2 trigger_actividad_cambio_etapa
-- Al actualizar ventas_lead_pipeline.etapa_id → registrar actividad.
-- --------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION trg_fn_actividad_cambio_etapa()
RETURNS TRIGGER AS $$
DECLARE
    v_etapa_anterior_nombre VARCHAR;
    v_etapa_nueva_nombre VARCHAR;
BEGIN
    IF OLD.etapa_id IS DISTINCT FROM NEW.etapa_id THEN
        SELECT nombre INTO v_etapa_anterior_nombre FROM ventas_etapas WHERE id = OLD.etapa_id;
        SELECT nombre INTO v_etapa_nueva_nombre FROM ventas_etapas WHERE id = NEW.etapa_id;

        INSERT INTO ventas_actividad (lead_id, usuario_id, tipo, descripcion, datos)
        VALUES (
            NEW.lead_id,
            auth.uid()::uuid,
            'cambio_etapa',
            'Cambio de etapa: ' || COALESCE(v_etapa_anterior_nombre, 'Sin etapa') || ' → ' || COALESCE(v_etapa_nueva_nombre, 'Sin etapa'),
            jsonb_build_object(
                'etapa_anterior_id', OLD.etapa_id,
                'etapa_anterior_nombre', v_etapa_anterior_nombre,
                'etapa_nueva_id', NEW.etapa_id,
                'etapa_nueva_nombre', v_etapa_nueva_nombre,
                'pipeline_id', NEW.pipeline_id
            )
        );

        -- Actualizar fecha_entrada al cambiar de etapa
        NEW.fecha_entrada = now();
        -- Resetear contador si cambia de etapa
        NEW.contador_intentos = 0;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_ventas_actividad_cambio_etapa
    BEFORE UPDATE ON ventas_lead_pipeline
    FOR EACH ROW EXECUTE FUNCTION trg_fn_actividad_cambio_etapa();

-- --------------------------------------------------------------------------
-- 3.3 trigger_notificacion_cita_agendada
-- Al insertar en ventas_citas → notificar al closer y registrar actividad.
-- --------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION trg_fn_notificacion_cita_agendada()
RETURNS TRIGGER AS $$
DECLARE
    v_lead_nombre VARCHAR;
BEGIN
    SELECT nombre INTO v_lead_nombre FROM ventas_leads WHERE id = NEW.lead_id;

    -- Notificación al closer
    IF NEW.closer_id IS NOT NULL THEN
        INSERT INTO ventas_notificaciones (usuario_id, tipo, titulo, mensaje, datos)
        VALUES (
            NEW.closer_id,
            'cita_agendada',
            'Nueva cita agendada',
            'Cita con ' || COALESCE(v_lead_nombre, 'Lead') || ' el ' || to_char(NEW.fecha_hora, 'DD/MM/YYYY HH24:MI'),
            jsonb_build_object('lead_id', NEW.lead_id, 'cita_id', NEW.id)
        );
    END IF;

    -- Registrar actividad en el lead
    INSERT INTO ventas_actividad (lead_id, usuario_id, tipo, descripcion, datos)
    VALUES (
        NEW.lead_id,
        COALESCE(NEW.setter_origen_id, auth.uid()::uuid),
        'cita_agendada',
        'Cita agendada para ' || to_char(NEW.fecha_hora, 'DD/MM/YYYY HH24:MI'),
        jsonb_build_object('cita_id', NEW.id, 'closer_id', NEW.closer_id)
    );

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_ventas_notificacion_cita_agendada
    AFTER INSERT ON ventas_citas
    FOR EACH ROW EXECUTE FUNCTION trg_fn_notificacion_cita_agendada();

-- --------------------------------------------------------------------------
-- 3.4 trigger_notificacion_cita_cancelada
-- Al cancelar una cita → notificar setter y closer.
-- --------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION trg_fn_notificacion_cita_cancelada()
RETURNS TRIGGER AS $$
DECLARE
    v_lead_nombre VARCHAR;
BEGIN
    IF NEW.estado = 'cancelada' AND OLD.estado <> 'cancelada' THEN
        SELECT nombre INTO v_lead_nombre FROM ventas_leads WHERE id = NEW.lead_id;

        -- Notificar al closer
        IF NEW.closer_id IS NOT NULL THEN
            INSERT INTO ventas_notificaciones (usuario_id, tipo, titulo, mensaje, datos)
            VALUES (
                NEW.closer_id,
                'cita_cancelada',
                'Cita cancelada',
                'La cita con ' || COALESCE(v_lead_nombre, 'Lead') || ' ha sido cancelada',
                jsonb_build_object('lead_id', NEW.lead_id, 'cita_id', NEW.id)
            );
        END IF;

        -- Notificar al setter
        IF NEW.setter_origen_id IS NOT NULL THEN
            INSERT INTO ventas_notificaciones (usuario_id, tipo, titulo, mensaje, datos)
            VALUES (
                NEW.setter_origen_id,
                'cita_cancelada',
                'Cita cancelada',
                'La cita con ' || COALESCE(v_lead_nombre, 'Lead') || ' ha sido cancelada',
                jsonb_build_object('lead_id', NEW.lead_id, 'cita_id', NEW.id)
            );
        END IF;

        -- Registrar actividad
        INSERT INTO ventas_actividad (lead_id, usuario_id, tipo, descripcion, datos)
        VALUES (
            NEW.lead_id,
            auth.uid()::uuid,
            'cita_cancelada',
            'Cita cancelada. Cancelada por: ' || COALESCE(NEW.cancelada_por, 'desconocido'),
            jsonb_build_object('cita_id', NEW.id, 'cancelada_por', NEW.cancelada_por)
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_ventas_notificacion_cita_cancelada
    AFTER UPDATE ON ventas_citas
    FOR EACH ROW EXECUTE FUNCTION trg_fn_notificacion_cita_cancelada();

-- --------------------------------------------------------------------------
-- 3.5 trigger_mover_lead_al_agendar
-- Al insertar cita → mover lead a "Agendado" en setters y "Llamada Agendada" en closers.
-- --------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION trg_fn_mover_lead_al_agendar()
RETURNS TRIGGER AS $$
DECLARE
    v_pipeline_setters_id UUID;
    v_pipeline_closers_id UUID;
    v_etapa_agendado_id UUID;
    v_etapa_llamada_agendada_id UUID;
BEGIN
    -- Obtener IDs de pipelines
    SELECT id INTO v_pipeline_setters_id FROM ventas_pipelines WHERE nombre = 'Setters (Cualificación)' LIMIT 1;
    SELECT id INTO v_pipeline_closers_id FROM ventas_pipelines WHERE nombre = 'Closers (Cierre)' LIMIT 1;

    -- Obtener etapa "Agendado" del pipeline setters
    IF v_pipeline_setters_id IS NOT NULL THEN
        SELECT id INTO v_etapa_agendado_id FROM ventas_etapas
        WHERE pipeline_id = v_pipeline_setters_id AND nombre = 'Agendado' LIMIT 1;

        -- Mover lead en pipeline setters
        INSERT INTO ventas_lead_pipeline (lead_id, pipeline_id, etapa_id)
        VALUES (NEW.lead_id, v_pipeline_setters_id, v_etapa_agendado_id)
        ON CONFLICT (lead_id, pipeline_id)
        DO UPDATE SET etapa_id = v_etapa_agendado_id;
    END IF;

    -- Obtener etapa "Llamada Agendada" del pipeline closers
    IF v_pipeline_closers_id IS NOT NULL THEN
        SELECT id INTO v_etapa_llamada_agendada_id FROM ventas_etapas
        WHERE pipeline_id = v_pipeline_closers_id AND nombre = 'Llamada Agendada' LIMIT 1;

        -- Crear/mover lead en pipeline closers
        INSERT INTO ventas_lead_pipeline (lead_id, pipeline_id, etapa_id)
        VALUES (NEW.lead_id, v_pipeline_closers_id, v_etapa_llamada_agendada_id)
        ON CONFLICT (lead_id, pipeline_id)
        DO UPDATE SET etapa_id = v_etapa_llamada_agendada_id;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_ventas_mover_lead_al_agendar
    AFTER INSERT ON ventas_citas
    FOR EACH ROW EXECUTE FUNCTION trg_fn_mover_lead_al_agendar();

-- --------------------------------------------------------------------------
-- 3.6 trigger_mover_lead_cancelacion
-- Al cancelar cita → mover lead a "Contactado" en setters y "Cancelado" en closers.
-- --------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION trg_fn_mover_lead_cancelacion()
RETURNS TRIGGER AS $$
DECLARE
    v_pipeline_setters_id UUID;
    v_pipeline_closers_id UUID;
    v_etapa_contactado_id UUID;
    v_etapa_cancelado_id UUID;
BEGIN
    IF NEW.estado = 'cancelada' AND OLD.estado <> 'cancelada' THEN
        SELECT id INTO v_pipeline_setters_id FROM ventas_pipelines WHERE nombre = 'Setters (Cualificación)' LIMIT 1;
        SELECT id INTO v_pipeline_closers_id FROM ventas_pipelines WHERE nombre = 'Closers (Cierre)' LIMIT 1;

        -- Mover a "Contactado" en setters
        IF v_pipeline_setters_id IS NOT NULL THEN
            SELECT id INTO v_etapa_contactado_id FROM ventas_etapas
            WHERE pipeline_id = v_pipeline_setters_id AND nombre = 'Contactado' LIMIT 1;

            UPDATE ventas_lead_pipeline
            SET etapa_id = v_etapa_contactado_id
            WHERE lead_id = NEW.lead_id AND pipeline_id = v_pipeline_setters_id;
        END IF;

        -- Mover a "Cancelado" en closers
        IF v_pipeline_closers_id IS NOT NULL THEN
            SELECT id INTO v_etapa_cancelado_id FROM ventas_etapas
            WHERE pipeline_id = v_pipeline_closers_id AND nombre = 'Cancelado' LIMIT 1;

            UPDATE ventas_lead_pipeline
            SET etapa_id = v_etapa_cancelado_id
            WHERE lead_id = NEW.lead_id AND pipeline_id = v_pipeline_closers_id;
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_ventas_mover_lead_cancelacion
    AFTER UPDATE ON ventas_citas
    FOR EACH ROW EXECUTE FUNCTION trg_fn_mover_lead_cancelacion();


-- ==========================================================================
-- PARTE 4: FUNCIONES RPC
-- ==========================================================================

-- --------------------------------------------------------------------------
-- 4.1 ventas_obtener_saldo_disponible
-- --------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION ventas_obtener_saldo_disponible(p_usuario_id UUID)
RETURNS DECIMAL AS $$
DECLARE
    v_total_comisiones DECIMAL;
    v_total_retirado DECIMAL;
    v_retiros_pendientes DECIMAL;
BEGIN
    -- Suma de comisiones ya disponibles
    SELECT COALESCE(SUM(monto), 0) INTO v_total_comisiones
    FROM ventas_comisiones
    WHERE usuario_id = p_usuario_id
    AND disponible_desde <= now();

    -- Total ya retirado
    SELECT COALESCE(total_retirado, 0) INTO v_total_retirado
    FROM ventas_wallet
    WHERE usuario_id = p_usuario_id;

    -- Retiros pendientes (aún no aprobados ni rechazados)
    SELECT COALESCE(SUM(monto), 0) INTO v_retiros_pendientes
    FROM ventas_retiros
    WHERE usuario_id = p_usuario_id
    AND estado = 'pendiente';

    RETURN v_total_comisiones - v_total_retirado - v_retiros_pendientes;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- --------------------------------------------------------------------------
-- 4.2 ventas_verificar_closer_al_dia
-- --------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION ventas_verificar_closer_al_dia(p_usuario_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN NOT EXISTS (
        SELECT 1 FROM ventas_citas
        WHERE closer_id = p_usuario_id
        AND fecha_hora < now()
        AND estado_reunion_id IS NULL
        AND estado NOT IN ('cancelada')
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- --------------------------------------------------------------------------
-- 4.3 ventas_aprobar_venta
-- --------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION ventas_aprobar_venta(p_venta_id UUID)
RETURNS JSONB AS $$
DECLARE
    v_venta RECORD;
    v_lead_nombre VARCHAR;
    v_config RECORD;
    v_comision DECIMAL;
    v_disponible_desde TIMESTAMPTZ;
    v_director RECORD;
BEGIN
    -- Verificar que el usuario es super_admin
    IF NOT ventas_es_super_admin() THEN
        RETURN jsonb_build_object('ok', false, 'error', 'Solo super_admin puede aprobar ventas');
    END IF;

    -- Obtener datos de la venta
    SELECT * INTO v_venta FROM ventas_ventas WHERE id = p_venta_id;
    IF v_venta IS NULL THEN
        RETURN jsonb_build_object('ok', false, 'error', 'Venta no encontrada');
    END IF;
    IF v_venta.estado = 'aprobada' THEN
        RETURN jsonb_build_object('ok', false, 'error', 'La venta ya está aprobada');
    END IF;

    -- Nombre del lead para concepto
    SELECT nombre INTO v_lead_nombre FROM ventas_leads WHERE id = v_venta.lead_id;
    v_disponible_desde := v_venta.fecha_venta::timestamptz + interval '48 hours';

    -- Actualizar estado
    UPDATE ventas_ventas
    SET estado = 'aprobada',
        aprobada_por_id = auth.uid()::uuid,
        fecha_aprobacion = now()
    WHERE id = p_venta_id;

    -- Comisión al closer
    IF v_venta.closer_id IS NOT NULL THEN
        SELECT * INTO v_config FROM ventas_comisiones_config WHERE rol = 'closer' AND activo = true LIMIT 1;
        IF v_config IS NOT NULL AND v_config.comision_fija > 0 THEN
            INSERT INTO ventas_comisiones (venta_id, usuario_id, rol, monto, concepto, disponible_desde)
            VALUES (p_venta_id, v_venta.closer_id, 'closer', v_config.comision_fija,
                    'Comisión cierre - ' || COALESCE(v_lead_nombre, 'Lead'), v_disponible_desde);

            UPDATE ventas_wallet SET saldo = saldo + v_config.comision_fija, total_ganado = total_ganado + v_config.comision_fija
            WHERE usuario_id = v_venta.closer_id;

            -- Bonus pago único
            IF v_venta.es_pago_unico AND v_config.bonus_pago_unico > 0 THEN
                INSERT INTO ventas_comisiones (venta_id, usuario_id, rol, monto, concepto, es_bonus, disponible_desde)
                VALUES (p_venta_id, v_venta.closer_id, 'closer', v_config.bonus_pago_unico,
                        'Bonus pago único - ' || COALESCE(v_lead_nombre, 'Lead'), true, v_disponible_desde);

                UPDATE ventas_wallet SET saldo = saldo + v_config.bonus_pago_unico, total_ganado = total_ganado + v_config.bonus_pago_unico
                WHERE usuario_id = v_venta.closer_id;
            END IF;

            -- Notificación al closer
            INSERT INTO ventas_notificaciones (usuario_id, tipo, titulo, mensaje, datos)
            VALUES (v_venta.closer_id, 'venta_aprobada', 'Venta aprobada',
                    'Tu venta de ' || COALESCE(v_lead_nombre, 'Lead') || ' ha sido aprobada',
                    jsonb_build_object('venta_id', p_venta_id, 'lead_id', v_venta.lead_id));
        END IF;
    END IF;

    -- Comisión al setter
    IF v_venta.setter_id IS NOT NULL THEN
        SELECT * INTO v_config FROM ventas_comisiones_config WHERE rol = 'setter' AND activo = true LIMIT 1;
        IF v_config IS NOT NULL AND v_config.comision_fija > 0 THEN
            INSERT INTO ventas_comisiones (venta_id, usuario_id, rol, monto, concepto, disponible_desde)
            VALUES (p_venta_id, v_venta.setter_id, 'setter', v_config.comision_fija,
                    'Comisión setter - ' || COALESCE(v_lead_nombre, 'Lead'), v_disponible_desde);

            UPDATE ventas_wallet SET saldo = saldo + v_config.comision_fija, total_ganado = total_ganado + v_config.comision_fija
            WHERE usuario_id = v_venta.setter_id;

            -- Bonus pago único para setter
            IF v_venta.es_pago_unico AND v_config.bonus_pago_unico > 0 THEN
                INSERT INTO ventas_comisiones (venta_id, usuario_id, rol, monto, concepto, es_bonus, disponible_desde)
                VALUES (p_venta_id, v_venta.setter_id, 'setter', v_config.bonus_pago_unico,
                        'Bonus pago único - ' || COALESCE(v_lead_nombre, 'Lead'), true, v_disponible_desde);

                UPDATE ventas_wallet SET saldo = saldo + v_config.bonus_pago_unico, total_ganado = total_ganado + v_config.bonus_pago_unico
                WHERE usuario_id = v_venta.setter_id;
            END IF;

            -- Notificación al setter
            INSERT INTO ventas_notificaciones (usuario_id, tipo, titulo, mensaje, datos)
            VALUES (v_venta.setter_id, 'venta_aprobada', 'Venta aprobada',
                    'Tu lead ' || COALESCE(v_lead_nombre, 'Lead') || ' ha cerrado venta',
                    jsonb_build_object('venta_id', p_venta_id, 'lead_id', v_venta.lead_id));
        END IF;
    END IF;

    -- Comisión al director de ventas (todos los activos)
    SELECT * INTO v_config FROM ventas_comisiones_config WHERE rol = 'director_ventas' AND activo = true LIMIT 1;
    IF v_config IS NOT NULL AND v_config.comision_fija > 0 THEN
        FOR v_director IN
            SELECT usuario_id FROM ventas_roles_comerciales
            WHERE rol = 'director_ventas' AND activo = true
        LOOP
            INSERT INTO ventas_comisiones (venta_id, usuario_id, rol, monto, concepto, disponible_desde)
            VALUES (p_venta_id, v_director.usuario_id, 'director_ventas', v_config.comision_fija,
                    'Comisión dirección - ' || COALESCE(v_lead_nombre, 'Lead'), v_disponible_desde);

            UPDATE ventas_wallet SET saldo = saldo + v_config.comision_fija, total_ganado = total_ganado + v_config.comision_fija
            WHERE usuario_id = v_director.usuario_id;

            -- Bonus pago único para director
            IF v_venta.es_pago_unico AND v_config.bonus_pago_unico > 0 THEN
                INSERT INTO ventas_comisiones (venta_id, usuario_id, rol, monto, concepto, es_bonus, disponible_desde)
                VALUES (p_venta_id, v_director.usuario_id, 'director_ventas', v_config.bonus_pago_unico,
                        'Bonus pago único dirección - ' || COALESCE(v_lead_nombre, 'Lead'), true, v_disponible_desde);

                UPDATE ventas_wallet SET saldo = saldo + v_config.bonus_pago_unico, total_ganado = total_ganado + v_config.bonus_pago_unico
                WHERE usuario_id = v_director.usuario_id;
            END IF;
        END LOOP;
    END IF;

    -- Registrar actividad
    INSERT INTO ventas_actividad (lead_id, usuario_id, tipo, descripcion, datos)
    VALUES (v_venta.lead_id, auth.uid()::uuid, 'venta',
            'Venta aprobada por ' || v_venta.importe || '€',
            jsonb_build_object('venta_id', p_venta_id, 'importe', v_venta.importe));

    RETURN jsonb_build_object('ok', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- --------------------------------------------------------------------------
-- 4.4 ventas_rechazar_venta
-- --------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION ventas_rechazar_venta(p_venta_id UUID)
RETURNS JSONB AS $$
DECLARE
    v_venta RECORD;
    v_lead_nombre VARCHAR;
    v_comision RECORD;
BEGIN
    IF NOT ventas_es_super_admin() THEN
        RETURN jsonb_build_object('ok', false, 'error', 'Solo super_admin puede rechazar ventas');
    END IF;

    SELECT * INTO v_venta FROM ventas_ventas WHERE id = p_venta_id;
    IF v_venta IS NULL THEN
        RETURN jsonb_build_object('ok', false, 'error', 'Venta no encontrada');
    END IF;

    SELECT nombre INTO v_lead_nombre FROM ventas_leads WHERE id = v_venta.lead_id;

    -- Si estaba aprobada → revertir comisiones
    IF v_venta.estado = 'aprobada' THEN
        FOR v_comision IN
            SELECT * FROM ventas_comisiones WHERE venta_id = p_venta_id AND monto > 0
        LOOP
            -- Crear comisión negativa
            INSERT INTO ventas_comisiones (venta_id, usuario_id, rol, monto, concepto, disponible_desde)
            VALUES (p_venta_id, v_comision.usuario_id, v_comision.rol, -v_comision.monto,
                    'Rechazo - ' || COALESCE(v_lead_nombre, 'Lead'), now());

            -- Actualizar wallet
            UPDATE ventas_wallet
            SET saldo = saldo - v_comision.monto,
                total_descontado = total_descontado + v_comision.monto
            WHERE usuario_id = v_comision.usuario_id;
        END LOOP;
    END IF;

    -- Actualizar estado
    UPDATE ventas_ventas
    SET estado = 'rechazada', fecha_rechazo = now()
    WHERE id = p_venta_id;

    -- Notificaciones
    IF v_venta.closer_id IS NOT NULL THEN
        INSERT INTO ventas_notificaciones (usuario_id, tipo, titulo, mensaje, datos)
        VALUES (v_venta.closer_id, 'venta_rechazada', 'Venta rechazada',
                'La venta de ' || COALESCE(v_lead_nombre, 'Lead') || ' ha sido rechazada',
                jsonb_build_object('venta_id', p_venta_id));
    END IF;
    IF v_venta.setter_id IS NOT NULL THEN
        INSERT INTO ventas_notificaciones (usuario_id, tipo, titulo, mensaje, datos)
        VALUES (v_venta.setter_id, 'venta_rechazada', 'Venta rechazada',
                'La venta de ' || COALESCE(v_lead_nombre, 'Lead') || ' ha sido rechazada',
                jsonb_build_object('venta_id', p_venta_id));
    END IF;

    -- Actividad
    INSERT INTO ventas_actividad (lead_id, usuario_id, tipo, descripcion, datos)
    VALUES (v_venta.lead_id, auth.uid()::uuid, 'venta_rechazada',
            'Venta rechazada', jsonb_build_object('venta_id', p_venta_id));

    RETURN jsonb_build_object('ok', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- --------------------------------------------------------------------------
-- 4.5 ventas_marcar_devolucion
-- --------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION ventas_marcar_devolucion(p_venta_id UUID)
RETURNS JSONB AS $$
DECLARE
    v_venta RECORD;
    v_lead_nombre VARCHAR;
    v_comision RECORD;
    v_pipeline RECORD;
    v_etapa_devolucion_id UUID;
BEGIN
    IF NOT ventas_es_super_admin() THEN
        RETURN jsonb_build_object('ok', false, 'error', 'Solo super_admin puede marcar devoluciones');
    END IF;

    SELECT * INTO v_venta FROM ventas_ventas WHERE id = p_venta_id;
    IF v_venta IS NULL THEN
        RETURN jsonb_build_object('ok', false, 'error', 'Venta no encontrada');
    END IF;
    IF v_venta.es_devolucion THEN
        RETURN jsonb_build_object('ok', false, 'error', 'La venta ya está marcada como devolución');
    END IF;

    SELECT nombre INTO v_lead_nombre FROM ventas_leads WHERE id = v_venta.lead_id;

    -- Marcar devolución
    UPDATE ventas_ventas
    SET es_devolucion = true, fecha_devolucion = now()
    WHERE id = p_venta_id;

    -- Revertir comisiones si estaba aprobada
    IF v_venta.estado = 'aprobada' THEN
        FOR v_comision IN
            SELECT * FROM ventas_comisiones WHERE venta_id = p_venta_id AND monto > 0
        LOOP
            INSERT INTO ventas_comisiones (venta_id, usuario_id, rol, monto, concepto, disponible_desde)
            VALUES (p_venta_id, v_comision.usuario_id, v_comision.rol, -v_comision.monto,
                    'Devolución - ' || COALESCE(v_lead_nombre, 'Lead'), now());

            UPDATE ventas_wallet
            SET saldo = saldo - v_comision.monto,
                total_descontado = total_descontado + v_comision.monto
            WHERE usuario_id = v_comision.usuario_id;
        END LOOP;
    END IF;

    -- Mover lead a etapa "Devolución" en ambos pipelines
    IF v_venta.lead_id IS NOT NULL THEN
        FOR v_pipeline IN SELECT id FROM ventas_pipelines LOOP
            SELECT id INTO v_etapa_devolucion_id FROM ventas_etapas
            WHERE pipeline_id = v_pipeline.id AND tipo = 'devolucion' LIMIT 1;

            IF v_etapa_devolucion_id IS NOT NULL THEN
                UPDATE ventas_lead_pipeline
                SET etapa_id = v_etapa_devolucion_id
                WHERE lead_id = v_venta.lead_id AND pipeline_id = v_pipeline.id;
            END IF;
        END LOOP;
    END IF;

    -- Notificaciones
    IF v_venta.closer_id IS NOT NULL THEN
        INSERT INTO ventas_notificaciones (usuario_id, tipo, titulo, mensaje, datos)
        VALUES (v_venta.closer_id, 'venta_rechazada', 'Devolución registrada',
                'Se ha registrado devolución en ' || COALESCE(v_lead_nombre, 'Lead'),
                jsonb_build_object('venta_id', p_venta_id));
    END IF;

    -- Actividad
    INSERT INTO ventas_actividad (lead_id, usuario_id, tipo, descripcion, datos)
    VALUES (v_venta.lead_id, auth.uid()::uuid, 'devolucion',
            'Devolución registrada', jsonb_build_object('venta_id', p_venta_id));

    RETURN jsonb_build_object('ok', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- --------------------------------------------------------------------------
-- 4.6 ventas_solicitar_retiro
-- --------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION ventas_solicitar_retiro(p_usuario_id UUID, p_monto DECIMAL)
RETURNS JSONB AS $$
DECLARE
    v_saldo_disponible DECIMAL;
    v_al_dia BOOLEAN;
    v_iban VARCHAR;
    v_retiro_id UUID;
BEGIN
    -- Verificar que es el propio usuario o super_admin
    IF auth.uid()::uuid <> p_usuario_id AND NOT ventas_es_super_admin() THEN
        RETURN jsonb_build_object('ok', false, 'error', 'No autorizado');
    END IF;

    IF p_monto <= 0 THEN
        RETURN jsonb_build_object('ok', false, 'error', 'El monto debe ser mayor a 0');
    END IF;

    -- Verificar que el closer tiene al día sus reuniones
    v_al_dia := ventas_verificar_closer_al_dia(p_usuario_id);
    IF NOT v_al_dia THEN
        RETURN jsonb_build_object('ok', false, 'error', 'Debes marcar el estado de todas tus reuniones pasadas antes de solicitar un retiro');
    END IF;

    -- Verificar saldo disponible
    v_saldo_disponible := ventas_obtener_saldo_disponible(p_usuario_id);
    IF v_saldo_disponible < p_monto THEN
        RETURN jsonb_build_object('ok', false, 'error', 'Saldo insuficiente. Disponible: ' || v_saldo_disponible || '€');
    END IF;

    -- Obtener IBAN
    SELECT cuenta_bancaria_iban INTO v_iban FROM ventas_datos_fiscales WHERE usuario_id = p_usuario_id;

    -- Crear retiro
    INSERT INTO ventas_retiros (usuario_id, monto, cuenta_bancaria_iban)
    VALUES (p_usuario_id, p_monto, v_iban)
    RETURNING id INTO v_retiro_id;

    -- Notificar a super_admins
    INSERT INTO ventas_notificaciones (usuario_id, tipo, titulo, mensaje, datos)
    SELECT vrc.usuario_id, 'retiro_pendiente', 'Nuevo retiro solicitado',
           'Se ha solicitado un retiro de ' || p_monto || '€',
           jsonb_build_object('retiro_id', v_retiro_id, 'usuario_id', p_usuario_id)
    FROM ventas_roles_comerciales vrc
    WHERE vrc.rol = 'super_admin' AND vrc.activo = true
    UNION
    SELECT u.id, 'retiro_pendiente', 'Nuevo retiro solicitado',
           'Se ha solicitado un retiro de ' || p_monto || '€',
           jsonb_build_object('retiro_id', v_retiro_id, 'usuario_id', p_usuario_id)
    FROM usuarios u WHERE u.tipo = 'super_admin';

    RETURN jsonb_build_object('ok', true, 'retiro_id', v_retiro_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- --------------------------------------------------------------------------
-- 4.7 ventas_aprobar_retiro
-- --------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION ventas_aprobar_retiro(p_retiro_id UUID)
RETURNS JSONB AS $$
DECLARE
    v_retiro RECORD;
    v_datos_fiscales RECORD;
    v_empresa RECORD;
    v_numero_factura VARCHAR;
    v_base DECIMAL;
    v_iva_monto DECIMAL;
    v_total DECIMAL;
    v_factura_id UUID;
BEGIN
    IF NOT ventas_es_super_admin() THEN
        RETURN jsonb_build_object('ok', false, 'error', 'Solo super_admin puede aprobar retiros');
    END IF;

    SELECT * INTO v_retiro FROM ventas_retiros WHERE id = p_retiro_id;
    IF v_retiro IS NULL THEN
        RETURN jsonb_build_object('ok', false, 'error', 'Retiro no encontrado');
    END IF;
    IF v_retiro.estado <> 'pendiente' THEN
        RETURN jsonb_build_object('ok', false, 'error', 'El retiro no está pendiente');
    END IF;

    -- Obtener datos fiscales del usuario
    SELECT * INTO v_datos_fiscales FROM ventas_datos_fiscales WHERE usuario_id = v_retiro.usuario_id;
    SELECT * INTO v_empresa FROM ventas_empresa_fiscal LIMIT 1;

    -- Calcular factura
    IF v_datos_fiscales IS NOT NULL AND v_datos_fiscales.iva_incluido THEN
        -- Si IVA incluido, el monto del retiro es el total
        v_total := v_retiro.monto;
        v_iva_monto := ROUND(v_retiro.monto * COALESCE(v_datos_fiscales.iva_porcentaje, 0) / (100 + COALESCE(v_datos_fiscales.iva_porcentaje, 0)), 2);
        v_base := v_total - v_iva_monto;
    ELSE
        v_base := v_retiro.monto;
        v_iva_monto := ROUND(v_retiro.monto * COALESCE(v_datos_fiscales.iva_porcentaje, 0) / 100, 2);
        v_total := v_base + v_iva_monto;
    END IF;

    -- Generar número de factura
    v_numero_factura := COALESCE(v_datos_fiscales.serie_factura, 'F') || '-' ||
                        LPAD(COALESCE(v_datos_fiscales.siguiente_numero_factura, 1)::text, 3, '0');

    -- Crear factura
    INSERT INTO ventas_facturas (
        retiro_id, usuario_id, numero_factura, fecha_emision,
        emisor_nombre, emisor_nif, emisor_direccion, emisor_ciudad, emisor_cp, emisor_pais,
        receptor_nombre, receptor_cif, receptor_direccion, receptor_ciudad, receptor_cp, receptor_pais,
        concepto, base_imponible, iva_porcentaje, iva_monto, total
    )
    VALUES (
        p_retiro_id, v_retiro.usuario_id, v_numero_factura, CURRENT_DATE,
        v_datos_fiscales.nombre_fiscal, v_datos_fiscales.nif_cif, v_datos_fiscales.direccion,
        v_datos_fiscales.ciudad, v_datos_fiscales.codigo_postal, v_datos_fiscales.pais,
        COALESCE(v_empresa.nombre_fiscal, 'Madrigal Marketing'), COALESCE(v_empresa.cif, ''),
        v_empresa.direccion, v_empresa.ciudad, v_empresa.codigo_postal, v_empresa.pais,
        COALESCE(v_empresa.concepto_factura, 'Servicios de intermediación comercial'),
        v_base, COALESCE(v_datos_fiscales.iva_porcentaje, 0), v_iva_monto, v_total
    )
    RETURNING id INTO v_factura_id;

    -- Incrementar número de factura
    UPDATE ventas_datos_fiscales
    SET siguiente_numero_factura = COALESCE(siguiente_numero_factura, 1) + 1
    WHERE usuario_id = v_retiro.usuario_id;

    -- Actualizar retiro
    UPDATE ventas_retiros
    SET estado = 'aprobado',
        factura_id = v_factura_id,
        aprobado_por_id = auth.uid()::uuid,
        fecha_aprobacion = now()
    WHERE id = p_retiro_id;

    -- Actualizar wallet
    UPDATE ventas_wallet
    SET total_retirado = total_retirado + v_retiro.monto
    WHERE usuario_id = v_retiro.usuario_id;

    -- Notificación al usuario
    INSERT INTO ventas_notificaciones (usuario_id, tipo, titulo, mensaje, datos)
    VALUES (v_retiro.usuario_id, 'retiro_aprobado', 'Retiro aprobado',
            'Tu retiro de ' || v_retiro.monto || '€ ha sido aprobado. Factura: ' || v_numero_factura,
            jsonb_build_object('retiro_id', p_retiro_id, 'factura_id', v_factura_id));

    RETURN jsonb_build_object('ok', true, 'factura_id', v_factura_id, 'numero_factura', v_numero_factura);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- --------------------------------------------------------------------------
-- 4.8 ventas_rechazar_retiro
-- --------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION ventas_rechazar_retiro(p_retiro_id UUID, p_motivo TEXT DEFAULT NULL)
RETURNS JSONB AS $$
DECLARE
    v_retiro RECORD;
BEGIN
    IF NOT ventas_es_super_admin() THEN
        RETURN jsonb_build_object('ok', false, 'error', 'Solo super_admin puede rechazar retiros');
    END IF;

    SELECT * INTO v_retiro FROM ventas_retiros WHERE id = p_retiro_id;
    IF v_retiro IS NULL THEN
        RETURN jsonb_build_object('ok', false, 'error', 'Retiro no encontrado');
    END IF;
    IF v_retiro.estado <> 'pendiente' THEN
        RETURN jsonb_build_object('ok', false, 'error', 'El retiro no está pendiente');
    END IF;

    -- Rechazar (NO descuenta del wallet)
    UPDATE ventas_retiros
    SET estado = 'rechazado',
        fecha_rechazo = now(),
        motivo_rechazo = p_motivo
    WHERE id = p_retiro_id;

    -- Notificación al usuario
    INSERT INTO ventas_notificaciones (usuario_id, tipo, titulo, mensaje, datos)
    VALUES (v_retiro.usuario_id, 'retiro_rechazado', 'Retiro rechazado',
            'Tu retiro de ' || v_retiro.monto || '€ ha sido rechazado.' ||
            CASE WHEN p_motivo IS NOT NULL THEN ' Motivo: ' || p_motivo ELSE '' END,
            jsonb_build_object('retiro_id', p_retiro_id, 'motivo', p_motivo));

    RETURN jsonb_build_object('ok', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- --------------------------------------------------------------------------
-- 4.9 ventas_asignar_lead_automatico
-- --------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION ventas_asignar_lead_automatico(p_lead_id UUID)
RETURNS JSONB AS $$
DECLARE
    v_total_porcentaje INTEGER;
    v_random INTEGER;
    v_acumulado INTEGER := 0;
    v_setter RECORD;
    v_setter_asignado_id UUID;
    v_setter_nombre VARCHAR;
BEGIN
    -- Obtener porcentaje total de setters activos
    SELECT COALESCE(SUM(porcentaje), 0) INTO v_total_porcentaje
    FROM ventas_reparto_config WHERE activo = true;

    IF v_total_porcentaje = 0 THEN
        RETURN jsonb_build_object('ok', false, 'error', 'No hay setters activos configurados en el reparto');
    END IF;

    -- Generar número aleatorio
    v_random := floor(random() * v_total_porcentaje)::integer;

    -- Selección ponderada
    FOR v_setter IN
        SELECT rc.setter_id, rc.porcentaje
        FROM ventas_reparto_config rc
        WHERE rc.activo = true
        ORDER BY rc.setter_id
    LOOP
        v_acumulado := v_acumulado + v_setter.porcentaje;
        IF v_random < v_acumulado THEN
            v_setter_asignado_id := v_setter.setter_id;
            EXIT;
        END IF;
    END LOOP;

    -- Fallback
    IF v_setter_asignado_id IS NULL THEN
        SELECT setter_id INTO v_setter_asignado_id
        FROM ventas_reparto_config WHERE activo = true LIMIT 1;
    END IF;

    -- Asignar
    UPDATE ventas_leads SET setter_asignado_id = v_setter_asignado_id WHERE id = p_lead_id;

    SELECT nombre INTO v_setter_nombre FROM usuarios WHERE id = v_setter_asignado_id;

    -- Actividad
    INSERT INTO ventas_actividad (lead_id, usuario_id, tipo, descripcion, datos)
    VALUES (p_lead_id, v_setter_asignado_id, 'asignacion',
            'Lead asignado automáticamente a ' || COALESCE(v_setter_nombre, 'Setter'),
            jsonb_build_object('setter_id', v_setter_asignado_id));

    -- Notificación
    INSERT INTO ventas_notificaciones (usuario_id, tipo, titulo, mensaje, datos)
    VALUES (v_setter_asignado_id, 'lead_asignado', 'Nuevo lead asignado',
            'Se te ha asignado un nuevo lead',
            jsonb_build_object('lead_id', p_lead_id));

    RETURN jsonb_build_object('ok', true, 'setter_id', v_setter_asignado_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ==========================================================================
-- PARTE 5: HABILITAR RLS EN TODAS LAS TABLAS
-- ==========================================================================

ALTER TABLE ventas_roles_comerciales ENABLE ROW LEVEL SECURITY;
ALTER TABLE ventas_pipelines ENABLE ROW LEVEL SECURITY;
ALTER TABLE ventas_etapas ENABLE ROW LEVEL SECURITY;
ALTER TABLE ventas_etiquetas ENABLE ROW LEVEL SECURITY;
ALTER TABLE ventas_categorias ENABLE ROW LEVEL SECURITY;
ALTER TABLE ventas_paquetes ENABLE ROW LEVEL SECURITY;
ALTER TABLE ventas_webhooks ENABLE ROW LEVEL SECURITY;
ALTER TABLE ventas_leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE ventas_lead_etiquetas ENABLE ROW LEVEL SECURITY;
ALTER TABLE ventas_lead_pipeline ENABLE ROW LEVEL SECURITY;
ALTER TABLE ventas_actividad ENABLE ROW LEVEL SECURITY;
ALTER TABLE ventas_reunion_estados ENABLE ROW LEVEL SECURITY;
ALTER TABLE ventas_enlaces_agenda ENABLE ROW LEVEL SECURITY;
ALTER TABLE ventas_citas ENABLE ROW LEVEL SECURITY;
ALTER TABLE ventas_calendario_disponibilidad ENABLE ROW LEVEL SECURITY;
ALTER TABLE ventas_calendario_bloqueos ENABLE ROW LEVEL SECURITY;
ALTER TABLE ventas_calendario_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE ventas_ventas ENABLE ROW LEVEL SECURITY;
ALTER TABLE ventas_comisiones_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE ventas_comisiones ENABLE ROW LEVEL SECURITY;
ALTER TABLE ventas_wallet ENABLE ROW LEVEL SECURITY;
ALTER TABLE ventas_datos_fiscales ENABLE ROW LEVEL SECURITY;
ALTER TABLE ventas_empresa_fiscal ENABLE ROW LEVEL SECURITY;
ALTER TABLE ventas_facturas ENABLE ROW LEVEL SECURITY;
ALTER TABLE ventas_retiros ENABLE ROW LEVEL SECURITY;
ALTER TABLE ventas_biblioteca_secciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE ventas_biblioteca_recursos ENABLE ROW LEVEL SECURITY;
ALTER TABLE ventas_notificaciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE ventas_webhook_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE ventas_reparto_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE ventas_campos_obligatorios ENABLE ROW LEVEL SECURITY;


-- ==========================================================================
-- PARTE 6: POLÍTICAS RLS
-- ==========================================================================

-- --------------------------------------------------------------------------
-- 6.1 ventas_roles_comerciales
-- --------------------------------------------------------------------------
CREATE POLICY vrc_select ON ventas_roles_comerciales FOR SELECT USING (
    ventas_es_admin_o_director()
    OR usuario_id = auth.uid()::uuid
);
CREATE POLICY vrc_insert ON ventas_roles_comerciales FOR INSERT WITH CHECK (
    ventas_es_super_admin()
);
CREATE POLICY vrc_update ON ventas_roles_comerciales FOR UPDATE
    USING (ventas_es_super_admin())
    WITH CHECK (ventas_es_super_admin());
CREATE POLICY vrc_delete ON ventas_roles_comerciales FOR DELETE USING (
    ventas_es_super_admin()
);

-- --------------------------------------------------------------------------
-- 6.2 ventas_pipelines — lectura para todos con rol comercial, escritura admin/director
-- --------------------------------------------------------------------------
CREATE POLICY vp_select ON ventas_pipelines FOR SELECT USING (
    ventas_tiene_rol()
);
CREATE POLICY vp_insert ON ventas_pipelines FOR INSERT WITH CHECK (
    ventas_es_admin_o_director()
);
CREATE POLICY vp_update ON ventas_pipelines FOR UPDATE
    USING (ventas_es_admin_o_director())
    WITH CHECK (ventas_es_admin_o_director());
CREATE POLICY vp_delete ON ventas_pipelines FOR DELETE USING (
    ventas_es_super_admin()
);

-- --------------------------------------------------------------------------
-- 6.3 ventas_etapas — lectura para todos con rol comercial, escritura admin/director
-- --------------------------------------------------------------------------
CREATE POLICY vet_select ON ventas_etapas FOR SELECT USING (
    ventas_tiene_rol()
);
CREATE POLICY vet_insert ON ventas_etapas FOR INSERT WITH CHECK (
    ventas_es_admin_o_director()
);
CREATE POLICY vet_update ON ventas_etapas FOR UPDATE
    USING (ventas_es_admin_o_director())
    WITH CHECK (ventas_es_admin_o_director());
CREATE POLICY vet_delete ON ventas_etapas FOR DELETE USING (
    ventas_es_super_admin()
);

-- --------------------------------------------------------------------------
-- 6.4 ventas_etiquetas — lectura todos, escritura super_admin
-- --------------------------------------------------------------------------
CREATE POLICY vetq_select ON ventas_etiquetas FOR SELECT USING (
    ventas_tiene_rol()
);
CREATE POLICY vetq_insert ON ventas_etiquetas FOR INSERT WITH CHECK (
    ventas_es_super_admin()
);
CREATE POLICY vetq_update ON ventas_etiquetas FOR UPDATE
    USING (ventas_es_super_admin())
    WITH CHECK (ventas_es_super_admin());
CREATE POLICY vetq_delete ON ventas_etiquetas FOR DELETE USING (
    ventas_es_super_admin()
);

-- --------------------------------------------------------------------------
-- 6.5 ventas_categorias — lectura todos, escritura super_admin
-- --------------------------------------------------------------------------
CREATE POLICY vcat_select ON ventas_categorias FOR SELECT USING (
    ventas_tiene_rol()
);
CREATE POLICY vcat_insert ON ventas_categorias FOR INSERT WITH CHECK (
    ventas_es_super_admin()
);
CREATE POLICY vcat_update ON ventas_categorias FOR UPDATE
    USING (ventas_es_super_admin())
    WITH CHECK (ventas_es_super_admin());
CREATE POLICY vcat_delete ON ventas_categorias FOR DELETE USING (
    ventas_es_super_admin()
);

-- --------------------------------------------------------------------------
-- 6.6 ventas_paquetes — lectura todos, escritura super_admin
-- --------------------------------------------------------------------------
CREATE POLICY vpaq_select ON ventas_paquetes FOR SELECT USING (
    ventas_tiene_rol()
);
CREATE POLICY vpaq_insert ON ventas_paquetes FOR INSERT WITH CHECK (
    ventas_es_super_admin()
);
CREATE POLICY vpaq_update ON ventas_paquetes FOR UPDATE
    USING (ventas_es_super_admin())
    WITH CHECK (ventas_es_super_admin());
CREATE POLICY vpaq_delete ON ventas_paquetes FOR DELETE USING (
    ventas_es_super_admin()
);

-- --------------------------------------------------------------------------
-- 6.7 ventas_leads
-- --------------------------------------------------------------------------
CREATE POLICY vl_select ON ventas_leads FOR SELECT USING (
    ventas_es_admin_o_director()
    OR (ventas_tiene_rol('setter') AND setter_asignado_id = auth.uid()::uuid)
    OR (ventas_tiene_rol('closer') AND closer_asignado_id = auth.uid()::uuid)
);
CREATE POLICY vl_insert ON ventas_leads FOR INSERT WITH CHECK (
    ventas_es_admin_o_director()
    OR ventas_tiene_rol('setter')
);
CREATE POLICY vl_update ON ventas_leads FOR UPDATE
    USING (
        ventas_es_admin_o_director()
        OR (ventas_tiene_rol('setter') AND setter_asignado_id = auth.uid()::uuid)
        OR (ventas_tiene_rol('closer') AND closer_asignado_id = auth.uid()::uuid)
    )
    WITH CHECK (
        ventas_es_admin_o_director()
        OR (ventas_tiene_rol('setter') AND setter_asignado_id = auth.uid()::uuid)
        OR (ventas_tiene_rol('closer') AND closer_asignado_id = auth.uid()::uuid)
    );
CREATE POLICY vl_delete ON ventas_leads FOR DELETE USING (
    ventas_es_admin_o_director()
);

-- --------------------------------------------------------------------------
-- 6.8 ventas_lead_etiquetas — hereda de leads
-- --------------------------------------------------------------------------
CREATE POLICY vle_select ON ventas_lead_etiquetas FOR SELECT USING (
    EXISTS (SELECT 1 FROM ventas_leads WHERE ventas_leads.id = lead_id)
);
CREATE POLICY vle_insert ON ventas_lead_etiquetas FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM ventas_leads WHERE ventas_leads.id = lead_id)
);
CREATE POLICY vle_delete ON ventas_lead_etiquetas FOR DELETE USING (
    EXISTS (SELECT 1 FROM ventas_leads WHERE ventas_leads.id = lead_id)
);

-- --------------------------------------------------------------------------
-- 6.9 ventas_lead_pipeline — hereda de leads
-- --------------------------------------------------------------------------
CREATE POLICY vlp_select ON ventas_lead_pipeline FOR SELECT USING (
    EXISTS (SELECT 1 FROM ventas_leads WHERE ventas_leads.id = lead_id)
);
CREATE POLICY vlp_insert ON ventas_lead_pipeline FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM ventas_leads WHERE ventas_leads.id = lead_id)
);
CREATE POLICY vlp_update ON ventas_lead_pipeline FOR UPDATE
    USING (EXISTS (SELECT 1 FROM ventas_leads WHERE ventas_leads.id = lead_id))
    WITH CHECK (EXISTS (SELECT 1 FROM ventas_leads WHERE ventas_leads.id = lead_id));
CREATE POLICY vlp_delete ON ventas_lead_pipeline FOR DELETE USING (
    ventas_es_admin_o_director()
);

-- --------------------------------------------------------------------------
-- 6.10 ventas_actividad — hereda de leads (lectura)
-- --------------------------------------------------------------------------
CREATE POLICY vact_select ON ventas_actividad FOR SELECT USING (
    EXISTS (SELECT 1 FROM ventas_leads WHERE ventas_leads.id = lead_id)
);
CREATE POLICY vact_insert ON ventas_actividad FOR INSERT WITH CHECK (
    ventas_tiene_rol()
);

-- --------------------------------------------------------------------------
-- 6.11 ventas_reunion_estados — lectura todos, escritura super_admin
-- --------------------------------------------------------------------------
CREATE POLICY vre_select ON ventas_reunion_estados FOR SELECT USING (
    ventas_tiene_rol()
);
CREATE POLICY vre_insert ON ventas_reunion_estados FOR INSERT WITH CHECK (
    ventas_es_super_admin()
);
CREATE POLICY vre_update ON ventas_reunion_estados FOR UPDATE
    USING (ventas_es_super_admin())
    WITH CHECK (ventas_es_super_admin());
CREATE POLICY vre_delete ON ventas_reunion_estados FOR DELETE USING (
    ventas_es_super_admin()
);

-- --------------------------------------------------------------------------
-- 6.12 ventas_enlaces_agenda
-- --------------------------------------------------------------------------
CREATE POLICY vea_select ON ventas_enlaces_agenda FOR SELECT USING (
    ventas_tiene_rol()
);
CREATE POLICY vea_insert ON ventas_enlaces_agenda FOR INSERT WITH CHECK (
    ventas_es_admin_o_director()
);
CREATE POLICY vea_update ON ventas_enlaces_agenda FOR UPDATE
    USING (ventas_es_admin_o_director())
    WITH CHECK (ventas_es_admin_o_director());
CREATE POLICY vea_delete ON ventas_enlaces_agenda FOR DELETE USING (
    ventas_es_super_admin()
);

-- --------------------------------------------------------------------------
-- 6.13 ventas_citas
-- --------------------------------------------------------------------------
CREATE POLICY vcit_select ON ventas_citas FOR SELECT USING (
    ventas_es_admin_o_director()
    OR (ventas_tiene_rol('closer') AND closer_id = auth.uid()::uuid)
    OR (ventas_tiene_rol('setter') AND EXISTS (
        SELECT 1 FROM ventas_leads WHERE ventas_leads.id = lead_id AND setter_asignado_id = auth.uid()::uuid
    ))
);
CREATE POLICY vcit_insert ON ventas_citas FOR INSERT WITH CHECK (
    ventas_tiene_rol()
);
CREATE POLICY vcit_update ON ventas_citas FOR UPDATE
    USING (
        ventas_es_admin_o_director()
        OR (ventas_tiene_rol('closer') AND closer_id = auth.uid()::uuid)
    )
    WITH CHECK (
        ventas_es_admin_o_director()
        OR (ventas_tiene_rol('closer') AND closer_id = auth.uid()::uuid)
    );
CREATE POLICY vcit_delete ON ventas_citas FOR DELETE USING (
    ventas_es_admin_o_director()
);

-- --------------------------------------------------------------------------
-- 6.14 ventas_calendario_disponibilidad
-- --------------------------------------------------------------------------
CREATE POLICY vcdisp_select ON ventas_calendario_disponibilidad FOR SELECT USING (
    ventas_es_admin_o_director()
    OR usuario_id = auth.uid()::uuid
);
CREATE POLICY vcdisp_insert ON ventas_calendario_disponibilidad FOR INSERT WITH CHECK (
    ventas_es_admin_o_director()
    OR usuario_id = auth.uid()::uuid
);
CREATE POLICY vcdisp_update ON ventas_calendario_disponibilidad FOR UPDATE
    USING (ventas_es_admin_o_director() OR usuario_id = auth.uid()::uuid)
    WITH CHECK (ventas_es_admin_o_director() OR usuario_id = auth.uid()::uuid);
CREATE POLICY vcdisp_delete ON ventas_calendario_disponibilidad FOR DELETE USING (
    ventas_es_admin_o_director() OR usuario_id = auth.uid()::uuid
);

-- --------------------------------------------------------------------------
-- 6.15 ventas_calendario_bloqueos
-- --------------------------------------------------------------------------
CREATE POLICY vcbloq_select ON ventas_calendario_bloqueos FOR SELECT USING (
    ventas_es_admin_o_director()
    OR usuario_id = auth.uid()::uuid
);
CREATE POLICY vcbloq_insert ON ventas_calendario_bloqueos FOR INSERT WITH CHECK (
    ventas_es_admin_o_director()
    OR usuario_id = auth.uid()::uuid
);
CREATE POLICY vcbloq_update ON ventas_calendario_bloqueos FOR UPDATE
    USING (ventas_es_admin_o_director() OR usuario_id = auth.uid()::uuid)
    WITH CHECK (ventas_es_admin_o_director() OR usuario_id = auth.uid()::uuid);
CREATE POLICY vcbloq_delete ON ventas_calendario_bloqueos FOR DELETE USING (
    ventas_es_admin_o_director() OR usuario_id = auth.uid()::uuid
);

-- --------------------------------------------------------------------------
-- 6.16 ventas_calendario_config
-- --------------------------------------------------------------------------
CREATE POLICY vcconf_select ON ventas_calendario_config FOR SELECT USING (
    ventas_es_admin_o_director()
    OR usuario_id = auth.uid()::uuid
);
CREATE POLICY vcconf_insert ON ventas_calendario_config FOR INSERT WITH CHECK (
    ventas_es_admin_o_director()
    OR usuario_id = auth.uid()::uuid
);
CREATE POLICY vcconf_update ON ventas_calendario_config FOR UPDATE
    USING (ventas_es_admin_o_director() OR usuario_id = auth.uid()::uuid)
    WITH CHECK (ventas_es_admin_o_director() OR usuario_id = auth.uid()::uuid);

-- --------------------------------------------------------------------------
-- 6.17 ventas_ventas
-- --------------------------------------------------------------------------
CREATE POLICY vvt_select ON ventas_ventas FOR SELECT USING (
    ventas_es_admin_o_director()
    OR closer_id = auth.uid()::uuid
    OR setter_id = auth.uid()::uuid
);
CREATE POLICY vvt_insert ON ventas_ventas FOR INSERT WITH CHECK (
    ventas_tiene_rol()
);
CREATE POLICY vvt_update ON ventas_ventas FOR UPDATE
    USING (ventas_es_super_admin())
    WITH CHECK (ventas_es_super_admin());

-- --------------------------------------------------------------------------
-- 6.18 ventas_comisiones_config — lectura todos, escritura super_admin
-- --------------------------------------------------------------------------
CREATE POLICY vcc_select ON ventas_comisiones_config FOR SELECT USING (
    ventas_tiene_rol()
);
CREATE POLICY vcc_insert ON ventas_comisiones_config FOR INSERT WITH CHECK (
    ventas_es_super_admin()
);
CREATE POLICY vcc_update ON ventas_comisiones_config FOR UPDATE
    USING (ventas_es_super_admin())
    WITH CHECK (ventas_es_super_admin());

-- --------------------------------------------------------------------------
-- 6.19 ventas_comisiones — cada uno ve las suyas, super_admin todas
-- --------------------------------------------------------------------------
CREATE POLICY vcom_select ON ventas_comisiones FOR SELECT USING (
    ventas_es_super_admin()
    OR usuario_id = auth.uid()::uuid
);

-- --------------------------------------------------------------------------
-- 6.20 ventas_wallet — cada uno ve la suya, super_admin todas
-- --------------------------------------------------------------------------
CREATE POLICY vwal_select ON ventas_wallet FOR SELECT USING (
    ventas_es_super_admin()
    OR usuario_id = auth.uid()::uuid
);

-- --------------------------------------------------------------------------
-- 6.21 ventas_retiros — cada uno ve los suyos, super_admin todos
-- --------------------------------------------------------------------------
CREATE POLICY vret_select ON ventas_retiros FOR SELECT USING (
    ventas_es_super_admin()
    OR usuario_id = auth.uid()::uuid
);
CREATE POLICY vret_insert ON ventas_retiros FOR INSERT WITH CHECK (
    usuario_id = auth.uid()::uuid
);
-- UPDATE solo por funciones RPC (SECURITY DEFINER)

-- --------------------------------------------------------------------------
-- 6.22 ventas_datos_fiscales — cada uno ve los suyos, super_admin todos
-- --------------------------------------------------------------------------
CREATE POLICY vdf_select ON ventas_datos_fiscales FOR SELECT USING (
    ventas_es_super_admin()
    OR usuario_id = auth.uid()::uuid
);
CREATE POLICY vdf_insert ON ventas_datos_fiscales FOR INSERT WITH CHECK (
    usuario_id = auth.uid()::uuid
);
CREATE POLICY vdf_update ON ventas_datos_fiscales FOR UPDATE
    USING (ventas_es_super_admin() OR usuario_id = auth.uid()::uuid)
    WITH CHECK (ventas_es_super_admin() OR usuario_id = auth.uid()::uuid);

-- --------------------------------------------------------------------------
-- 6.23 ventas_empresa_fiscal — lectura todos, escritura super_admin
-- --------------------------------------------------------------------------
CREATE POLICY vef_select ON ventas_empresa_fiscal FOR SELECT USING (
    ventas_tiene_rol()
);
CREATE POLICY vef_insert ON ventas_empresa_fiscal FOR INSERT WITH CHECK (
    ventas_es_super_admin()
);
CREATE POLICY vef_update ON ventas_empresa_fiscal FOR UPDATE
    USING (ventas_es_super_admin())
    WITH CHECK (ventas_es_super_admin());

-- --------------------------------------------------------------------------
-- 6.24 ventas_facturas — cada uno ve las suyas, super_admin todas
-- --------------------------------------------------------------------------
CREATE POLICY vfac_select ON ventas_facturas FOR SELECT USING (
    ventas_es_super_admin()
    OR usuario_id = auth.uid()::uuid
);

-- --------------------------------------------------------------------------
-- 6.25 ventas_biblioteca_secciones — lectura todos, escritura super_admin
-- --------------------------------------------------------------------------
CREATE POLICY vbs_select ON ventas_biblioteca_secciones FOR SELECT USING (
    ventas_tiene_rol()
);
CREATE POLICY vbs_insert ON ventas_biblioteca_secciones FOR INSERT WITH CHECK (
    ventas_es_super_admin()
);
CREATE POLICY vbs_update ON ventas_biblioteca_secciones FOR UPDATE
    USING (ventas_es_super_admin())
    WITH CHECK (ventas_es_super_admin());
CREATE POLICY vbs_delete ON ventas_biblioteca_secciones FOR DELETE USING (
    ventas_es_super_admin()
);

-- --------------------------------------------------------------------------
-- 6.26 ventas_biblioteca_recursos — filtrado por visible_para
-- --------------------------------------------------------------------------
CREATE POLICY vbr_select ON ventas_biblioteca_recursos FOR SELECT USING (
    ventas_es_super_admin()
    OR EXISTS (
        SELECT 1 FROM ventas_roles_comerciales
        WHERE usuario_id = auth.uid()::uuid
        AND activo = true
        AND rol = ANY(ventas_biblioteca_recursos.visible_para)
    )
);
CREATE POLICY vbr_insert ON ventas_biblioteca_recursos FOR INSERT WITH CHECK (
    ventas_es_admin_o_director()
);
CREATE POLICY vbr_update ON ventas_biblioteca_recursos FOR UPDATE
    USING (ventas_es_admin_o_director())
    WITH CHECK (ventas_es_admin_o_director());
CREATE POLICY vbr_delete ON ventas_biblioteca_recursos FOR DELETE USING (
    ventas_es_super_admin()
);

-- --------------------------------------------------------------------------
-- 6.27 ventas_notificaciones — cada uno solo las suyas
-- --------------------------------------------------------------------------
CREATE POLICY vnot_select ON ventas_notificaciones FOR SELECT USING (
    usuario_id = auth.uid()::uuid
);
CREATE POLICY vnot_update ON ventas_notificaciones FOR UPDATE
    USING (usuario_id = auth.uid()::uuid)
    WITH CHECK (usuario_id = auth.uid()::uuid);
-- INSERT se hace desde funciones SECURITY DEFINER (triggers/RPCs)
CREATE POLICY vnot_insert ON ventas_notificaciones FOR INSERT WITH CHECK (
    ventas_tiene_rol() OR ventas_es_super_admin()
);

-- --------------------------------------------------------------------------
-- 6.28 ventas_webhooks — solo super_admin
-- --------------------------------------------------------------------------
CREATE POLICY vwh_select ON ventas_webhooks FOR SELECT USING (
    ventas_es_super_admin()
);
CREATE POLICY vwh_insert ON ventas_webhooks FOR INSERT WITH CHECK (
    ventas_es_super_admin()
);
CREATE POLICY vwh_update ON ventas_webhooks FOR UPDATE
    USING (ventas_es_super_admin())
    WITH CHECK (ventas_es_super_admin());
CREATE POLICY vwh_delete ON ventas_webhooks FOR DELETE USING (
    ventas_es_super_admin()
);

-- --------------------------------------------------------------------------
-- 6.29 ventas_webhook_logs — solo super_admin
-- --------------------------------------------------------------------------
CREATE POLICY vwhl_select ON ventas_webhook_logs FOR SELECT USING (
    ventas_es_super_admin()
);
CREATE POLICY vwhl_insert ON ventas_webhook_logs FOR INSERT WITH CHECK (
    ventas_es_super_admin()
);

-- --------------------------------------------------------------------------
-- 6.30 ventas_reparto_config — super_admin y director
-- --------------------------------------------------------------------------
CREATE POLICY vrep_select ON ventas_reparto_config FOR SELECT USING (
    ventas_es_admin_o_director()
);
CREATE POLICY vrep_insert ON ventas_reparto_config FOR INSERT WITH CHECK (
    ventas_es_admin_o_director()
);
CREATE POLICY vrep_update ON ventas_reparto_config FOR UPDATE
    USING (ventas_es_admin_o_director())
    WITH CHECK (ventas_es_admin_o_director());
CREATE POLICY vrep_delete ON ventas_reparto_config FOR DELETE USING (
    ventas_es_admin_o_director()
);

-- --------------------------------------------------------------------------
-- 6.31 ventas_campos_obligatorios — lectura todos, escritura super_admin
-- --------------------------------------------------------------------------
CREATE POLICY vcob_select ON ventas_campos_obligatorios FOR SELECT USING (
    ventas_tiene_rol()
);
CREATE POLICY vcob_update ON ventas_campos_obligatorios FOR UPDATE
    USING (ventas_es_super_admin())
    WITH CHECK (ventas_es_super_admin());


-- ==========================================================================
-- PARTE 7: PERMISOS DEL MÓDULO VENTAS
-- ==========================================================================

INSERT INTO permisos (codigo, modulo, nombre, descripcion, orden) VALUES
('ventas.ver_crm', 'ventas', 'Ver CRM de ventas', 'Acceso al CRM del equipo comercial', 200),
('ventas.editar_leads', 'ventas', 'Editar leads de ventas', 'Editar leads del módulo de ventas', 201),
('ventas.eliminar_leads', 'ventas', 'Eliminar leads de ventas', 'Eliminar leads del módulo de ventas', 202),
('ventas.ver_ventas', 'ventas', 'Ver ventas', 'Ver listado de ventas cerradas', 203),
('ventas.aprobar_ventas', 'ventas', 'Aprobar ventas', 'Aprobar o rechazar ventas', 204),
('ventas.ver_wallet', 'ventas', 'Ver wallet', 'Ver wallet y comisiones', 205),
('ventas.solicitar_retiro', 'ventas', 'Solicitar retiro', 'Solicitar retiro de comisiones', 206),
('ventas.aprobar_retiros', 'ventas', 'Aprobar retiros', 'Aprobar o rechazar retiros de comisiones', 207),
('ventas.ver_biblioteca', 'ventas', 'Ver biblioteca', 'Acceso a la biblioteca de recursos', 208),
('ventas.gestionar_biblioteca', 'ventas', 'Gestionar biblioteca', 'Crear/editar recursos de la biblioteca', 209),
('ventas.ver_calendario', 'ventas', 'Ver calendario', 'Ver calendario de citas', 210),
('ventas.gestionar_calendario', 'ventas', 'Gestionar calendario', 'Gestionar disponibilidad y citas', 211),
('ventas.ver_ajustes', 'ventas', 'Ver ajustes ventas', 'Ver configuración del módulo de ventas', 212),
('ventas.gestionar_ajustes', 'ventas', 'Gestionar ajustes ventas', 'Modificar configuración del módulo de ventas', 213),
('ventas.ver_notificaciones', 'ventas', 'Ver notificaciones ventas', 'Ver notificaciones del módulo de ventas', 214),
('ventas.gestionar_webhooks', 'ventas', 'Gestionar webhooks', 'Configurar webhooks de recepción de leads', 215),
('ventas.ver_dashboard', 'ventas', 'Ver dashboard ventas', 'Ver dashboard del módulo de ventas', 216),
('ventas.gestionar_pipelines', 'ventas', 'Gestionar pipelines', 'Crear/editar pipelines y etapas', 217),
('ventas.gestionar_equipo', 'ventas', 'Gestionar equipo comercial', 'Gestionar roles y configuración del equipo', 218),
('ventas.importar_exportar', 'ventas', 'Importar/exportar leads', 'Importar y exportar leads del módulo de ventas', 219)
ON CONFLICT (codigo) DO UPDATE SET
    nombre = EXCLUDED.nombre,
    descripcion = EXCLUDED.descripcion,
    modulo = EXCLUDED.modulo,
    orden = EXCLUDED.orden;


-- ==========================================================================
-- PARTE 8: ASIGNAR PERMISOS DE VENTAS A ROLES EXISTENTES
-- ==========================================================================

-- Super Admin: todos los permisos de ventas (ya tiene todos por ser super_admin en tiene_permiso)
-- Pero asignamos explícitamente para consistencia con la tabla roles_permisos

DO $$
DECLARE
    v_permiso RECORD;
    v_rol_super UUID;
    v_rol_directivo UUID;
    v_rol_comercial UUID;
BEGIN
    -- Obtener IDs de roles
    SELECT id INTO v_rol_super FROM roles WHERE nombre = 'Super Admin';
    SELECT id INTO v_rol_directivo FROM roles WHERE nombre = 'Directivo Comercial';
    SELECT id INTO v_rol_comercial FROM roles WHERE nombre = 'Comercial';

    -- Super Admin: TODOS los permisos de ventas
    IF v_rol_super IS NOT NULL THEN
        FOR v_permiso IN SELECT id FROM permisos WHERE modulo = 'ventas' LOOP
            INSERT INTO roles_permisos (rol_id, permiso_id)
            VALUES (v_rol_super, v_permiso.id)
            ON CONFLICT DO NOTHING;
        END LOOP;
    END IF;

    -- Directivo Comercial: casi todos menos aprobar_ventas y aprobar_retiros
    IF v_rol_directivo IS NOT NULL THEN
        FOR v_permiso IN
            SELECT id FROM permisos
            WHERE modulo = 'ventas'
            AND codigo NOT IN ('ventas.aprobar_ventas', 'ventas.aprobar_retiros', 'ventas.gestionar_webhooks')
        LOOP
            INSERT INTO roles_permisos (rol_id, permiso_id)
            VALUES (v_rol_directivo, v_permiso.id)
            ON CONFLICT DO NOTHING;
        END LOOP;
    END IF;

    -- Comercial: permisos básicos
    IF v_rol_comercial IS NOT NULL THEN
        FOR v_permiso IN
            SELECT id FROM permisos
            WHERE codigo IN (
                'ventas.ver_crm',
                'ventas.editar_leads',
                'ventas.ver_ventas',
                'ventas.ver_wallet',
                'ventas.solicitar_retiro',
                'ventas.ver_biblioteca',
                'ventas.ver_calendario',
                'ventas.gestionar_calendario',
                'ventas.ver_notificaciones',
                'ventas.ver_dashboard'
            )
        LOOP
            INSERT INTO roles_permisos (rol_id, permiso_id)
            VALUES (v_rol_comercial, v_permiso.id)
            ON CONFLICT DO NOTHING;
        END LOOP;
    END IF;
END $$;


-- ==========================================================================
-- PARTE 9: DATOS SEMILLA (SEED)
-- ==========================================================================

-- --------------------------------------------------------------------------
-- 9.1 Pipelines
-- --------------------------------------------------------------------------
INSERT INTO ventas_pipelines (id, nombre, descripcion, orden) VALUES
    ('a0000000-0000-0000-0000-000000000001', 'Setters (Cualificación)', 'Pipeline de cualificación de leads por setters', 1),
    ('a0000000-0000-0000-0000-000000000002', 'Closers (Cierre)', 'Pipeline de cierre de ventas por closers', 2)
ON CONFLICT DO NOTHING;

-- --------------------------------------------------------------------------
-- 9.2 Etapas — Pipeline Setters
-- --------------------------------------------------------------------------
INSERT INTO ventas_etapas (pipeline_id, nombre, color, orden, tipo, max_intentos, es_final) VALUES
    ('a0000000-0000-0000-0000-000000000001', 'Por Contactar', '#9CA3AF', 1, 'normal', NULL, false),
    ('a0000000-0000-0000-0000-000000000001', 'Contactado', '#3B82F6', 2, 'normal', NULL, false),
    ('a0000000-0000-0000-0000-000000000001', 'Ghosting', '#F59E0B', 3, 'ghosting', 3, false),
    ('a0000000-0000-0000-0000-000000000001', 'Seguimiento', '#8B5CF6', 4, 'seguimiento', NULL, false),
    ('a0000000-0000-0000-0000-000000000001', 'Nurturing', '#EC4899', 5, 'normal', NULL, false),
    ('a0000000-0000-0000-0000-000000000001', 'Agendado', '#10B981', 6, 'normal', NULL, false),
    ('a0000000-0000-0000-0000-000000000001', 'Cita Realizada', '#06B6D4', 7, 'cita_realizada', NULL, false),
    ('a0000000-0000-0000-0000-000000000001', 'Venta', '#22C55E', 8, 'venta', NULL, true),
    ('a0000000-0000-0000-0000-000000000001', 'Devolución', '#F97316', 9, 'devolucion', NULL, true),
    ('a0000000-0000-0000-0000-000000000001', 'Lost', '#EF4444', 10, 'lost', NULL, true)
ON CONFLICT DO NOTHING;

-- --------------------------------------------------------------------------
-- 9.3 Etapas — Pipeline Closers
-- --------------------------------------------------------------------------
INSERT INTO ventas_etapas (pipeline_id, nombre, color, orden, tipo, max_intentos, es_final) VALUES
    ('a0000000-0000-0000-0000-000000000002', 'Llamada Agendada', '#3B82F6', 1, 'normal', NULL, false),
    ('a0000000-0000-0000-0000-000000000002', 'Contactado', '#6366F1', 2, 'normal', NULL, false),
    ('a0000000-0000-0000-0000-000000000002', 'Por Agendar', '#9CA3AF', 3, 'normal', NULL, false),
    ('a0000000-0000-0000-0000-000000000002', 'Cancelado', '#F87171', 4, 'normal', NULL, false),
    ('a0000000-0000-0000-0000-000000000002', 'Reagendado', '#FBBF24', 5, 'normal', NULL, false),
    ('a0000000-0000-0000-0000-000000000002', 'No Show', '#F59E0B', 6, 'ghosting', NULL, false),
    ('a0000000-0000-0000-0000-000000000002', 'Seguimiento', '#8B5CF6', 7, 'seguimiento', NULL, false),
    ('a0000000-0000-0000-0000-000000000002', 'Nurturing', '#EC4899', 8, 'normal', NULL, false),
    ('a0000000-0000-0000-0000-000000000002', 'Reserva', '#14B8A6', 9, 'normal', NULL, false),
    ('a0000000-0000-0000-0000-000000000002', 'Venta', '#22C55E', 10, 'venta', NULL, true),
    ('a0000000-0000-0000-0000-000000000002', 'Devolución', '#F97316', 11, 'devolucion', NULL, true),
    ('a0000000-0000-0000-0000-000000000002', 'Lost', '#EF4444', 12, 'lost', NULL, true)
ON CONFLICT DO NOTHING;

-- --------------------------------------------------------------------------
-- 9.4 Etiquetas iniciales
-- --------------------------------------------------------------------------
INSERT INTO ventas_etiquetas (nombre, color) VALUES
    ('Teléfono Erróneo', '#EF4444'),
    ('No Lead', '#F59E0B')
ON CONFLICT DO NOTHING;

-- --------------------------------------------------------------------------
-- 9.5 Estados de reunión iniciales
-- --------------------------------------------------------------------------
INSERT INTO ventas_reunion_estados (nombre, color, es_obligatorio_grabacion, orden) VALUES
    ('Realizada', '#22C55E', false, 1),
    ('No Show', '#F59E0B', false, 2),
    ('Cancelada', '#EF4444', false, 3)
ON CONFLICT DO NOTHING;

-- --------------------------------------------------------------------------
-- 9.6 Empresa fiscal (registro vacío para completar después)
-- --------------------------------------------------------------------------
INSERT INTO ventas_empresa_fiscal (nombre_fiscal, cif, pais, concepto_factura)
VALUES ('Madrigal Marketing S.L.', 'BXXXXXXXX', 'España', 'Servicios de intermediación comercial')
ON CONFLICT DO NOTHING;

-- --------------------------------------------------------------------------
-- 9.7 Configuración de comisiones por defecto (valores a 0)
-- --------------------------------------------------------------------------
INSERT INTO ventas_comisiones_config (rol, comision_fija, bonus_pago_unico) VALUES
    ('setter', 0, 0),
    ('closer', 0, 0),
    ('director_ventas', 0, 0)
ON CONFLICT DO NOTHING;

-- --------------------------------------------------------------------------
-- 9.8 Campos obligatorios por defecto
-- --------------------------------------------------------------------------
INSERT INTO ventas_campos_obligatorios (campo, es_obligatorio, aplica_a) VALUES
    ('estado_reunion', true, 'closer'),
    ('enlace_grabacion', false, 'closer'),
    ('notas_closer', false, 'closer')
ON CONFLICT (campo) DO NOTHING;


-- ==========================================================================
-- FIN DEL SCRIPT
-- ==========================================================================

COMMIT;
