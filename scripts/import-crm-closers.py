#!/usr/bin/env python3
"""
Import opportunities (1).csv from old CRM into Supabase — Closers pipeline.
Creates ventas_leads + ventas_lead_pipeline + ventas_citas + ventas_ventas.
"""
import csv
import json
import subprocess
import uuid
import sys
import base64

CSV_PATH = "/Users/juanramosgonzalez/Downloads/opportunities (1).csv"
PROJECT_REF = "ootncgtcvwnrskqtamak"

# ── Pipeline ──
PIPELINE_CLOSERS = "a0000000-0000-0000-0000-000000000002"

# ── Closer pipeline etapas ──
ETAPA_MAP = {
    "📲 CONTACTADO":    "3ac1f9c2-77da-4f1d-b4da-6e3afc735b5c",   # Contactado
    "👀 SEGUIMIENTO":   "a02c7696-62ab-478d-8d35-46c5f3fd5a9f",   # Seguimiento
    "👻 NO SHOW":       "d013c657-9e36-48da-a78e-80624e0a5a4c",   # No Show 1
    "👻 NO SHOW 1":     "d013c657-9e36-48da-a78e-80624e0a5a4c",   # No Show 1
    "👻 NO SHOW 2":     "b7e2a1c3-4d5f-6e7a-8b9c-0d1e2f3a4b5c",   # No Show 2
    "📝 POR AGENDAR":   "49b3c510-8659-4ec0-a72a-96676de1eeb4",   # Por Agendar
    "🗓️ REAGENDADO":    "d9c80efd-8785-4051-b9c7-6201144926dd",   # Reagendado
    "♻️ NURTURING":     "f6001ab0-b8f7-4b6c-b9cc-8b9d52ec4d23",   # Nurturing
    "❌ CANCELADO":      "29adfbdc-adaf-4e8a-be2a-63eb04ccfe3e",   # Cancelado
    "😞 LOST":          "46dba9b3-8546-4882-bc28-cca16f30788a",   # Lost
    "🥇 VENTA":         "4df481ee-429f-4f0e-929a-cda5c1af40b7",   # Venta
}

# ── Closer (asignado) ──
CLOSER_MAP = {
    "Pablo Zamora":       "504f3541-90e9-4488-b5f9-807873e32937",
    "Mercedes Hernandez": "0bf00739-59e3-4b1d-bf78-f4b5bfb57ce9",
    "Mireia Garcia":      "2af74587-e3df-44f7-a4b4-48bd286824d7",
}

# ── Setter origen (lowercase field "📥 Setter Asignado") ──
SETTER_ORIGEN_MAP = {
    "mercedes":           "0bf00739-59e3-4b1d-bf78-f4b5bfb57ce9",
    "mireia":             "2af74587-e3df-44f7-a4b4-48bd286824d7",
    "mrsax":              "531e1877-e1b0-4577-b669-82847f247c92",  # Juan (owner)
    "secuenciaemails2026": None,  # automated, no person
}

# ── Seguidores (followers) ──
FOLLOWER_MAP = {
    "Mireia Garcia": "2af74587-e3df-44f7-a4b4-48bd286824d7",
    "David Casero":  "e472a852-7177-4b0b-8bcf-d2462781d8aa",
}


def get_token():
    raw = subprocess.check_output(
        ["security", "find-generic-password", "-s", "Supabase CLI", "-w"],
        stderr=subprocess.DEVNULL
    ).decode().strip()
    if raw.startswith("go-keyring-base64:"):
        raw = base64.b64decode(raw[len("go-keyring-base64:"):]).decode()
    return raw


def run_sql(token, sql):
    result = subprocess.run(
        ["curl", "-s", "-X", "POST",
         f"https://api.supabase.com/v1/projects/{PROJECT_REF}/database/query",
         "-H", f"Authorization: Bearer {token}",
         "-H", "Content-Type: application/json",
         "--data-binary", json.dumps({"query": sql})],
        capture_output=True, text=True
    )
    resp = result.stdout
    if resp and not resp.startswith("["):
        data = json.loads(resp)
        if "message" in data:
            print(f"SQL ERROR: {data['message'][:300]}")
            return None
    return resp


def escape_sql(s):
    if s is None:
        return "NULL"
    s = str(s).replace("'", "''").replace("\x00", "")
    return f"'{s}'"


def main():
    token = get_token()

    rows = []
    with open(CSV_PATH, "r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            rows.append(row)

    print(f"Loaded {len(rows)} closer rows from CSV")

    lead_values = []
    pipeline_values = []
    cita_values = []
    venta_values = []

    for row in rows:
        lead_id = str(uuid.uuid4())

        # ── Basic fields ──
        nombre = (row.get("Nombre del contacto") or row.get("Nombre del cliente potencial") or "").strip()
        telefono = (row.get("teléfono") or "").strip() or None
        email = (row.get("correo electrónico") or "").strip() or None
        fuente = (row.get("fuente") or "").strip() or None
        fuente_detalle = (row.get("Fuente del lead") or "").strip() or None

        valor = 0
        try:
            valor = float(row.get("Valor del cliente potencial", 0) or 0)
        except:
            valor = 0

        # ── Notas: combine all extra data ──
        notas_parts = []
        notas_raw = (row.get("Notas") or "").strip()
        if notas_raw:
            notas_parts.append(notas_raw)

        enlace_grabacion = (row.get("⏺️ Links Grabacion Llamadas") or "").strip() or None
        producto_vendido = (row.get("🎁 Producto Vendido") or "").strip()
        metodo_pago = (row.get("💳 Método de Pago") or "").strip()
        cash_collected = (row.get("Cash Collected") or "").strip()
        facturacion_total = (row.get("Facturación Total") or "").strip()
        fecha_llamada = (row.get("🗓️ Fecha de Llamada") or "").strip()
        llamada_realizada = (row.get("¿Se ha realizado la llamada?") or "").strip()
        razon_abandono = (row.get("nombre de la razón de abandono") or "").strip()

        if fecha_llamada:
            notas_parts.append(f"Fecha llamada: {fecha_llamada}")
        if llamada_realizada:
            notas_parts.append(f"Llamada realizada: {llamada_realizada}")
        if producto_vendido:
            notas_parts.append(f"Producto vendido: {producto_vendido}")
        if metodo_pago:
            notas_parts.append(f"Método pago: {metodo_pago}")
        if cash_collected:
            notas_parts.append(f"Cash collected: {cash_collected}")
        if facturacion_total:
            notas_parts.append(f"Facturación total: {facturacion_total}")
        if razon_abandono:
            notas_parts.append(f"Razón abandono: {razon_abandono}")

        # Old CRM IDs for traceability
        old_opp_id = (row.get("ID de oportunidad") or "").strip()
        old_contact_id = (row.get("ID de contacto") or "").strip()
        if old_opp_id:
            notas_parts.append(f"[CRM antiguo] Opp ID: {old_opp_id}")
        if old_contact_id:
            notas_parts.append(f"[CRM antiguo] Contact ID: {old_contact_id}")

        notas = "\n".join(notas_parts) if notas_parts else None

        # ── Closer (asignado) ──
        asignado = (row.get("asignado") or "").strip()
        closer_id = CLOSER_MAP.get(asignado)

        # ── Setter origen ──
        setter_origen_raw = (row.get("📥 Setter Asignado") or "").strip()
        setter_id = SETTER_ORIGEN_MAP.get(setter_origen_raw)

        # ── Seguidores → additional closer/follower ──
        seguidores = (row.get("Seguidores") or "").strip()
        follower_id = FOLLOWER_MAP.get(seguidores)

        # If no closer assigned but follower exists, use follower as closer
        # If closer assigned and follower different, store follower info in notas
        if follower_id and closer_id and follower_id != closer_id:
            notas = (notas or "") + f"\nSeguidor adicional: {seguidores}"

        # ── Dates ──
        created_at = (row.get("Creado el") or "").strip()
        updated_at = (row.get("Actualizado el") or "").strip()

        # ── Stage ──
        fase = (row.get("fase") or "").strip()
        etapa_id = ETAPA_MAP.get(fase, "3ac1f9c2-77da-4f1d-b4da-6e3afc735b5c")  # default: Contactado

        # ── Build lead INSERT ──
        lead_values.append(
            f"({escape_sql(lead_id)}, {escape_sql(nombre)}, {escape_sql(telefono)}, "
            f"{escape_sql(email)}, {escape_sql(fuente)}, {escape_sql(fuente_detalle)}, "
            f"{valor}, {escape_sql(notas)}, {escape_sql(enlace_grabacion)}, "
            f"{'NULL' if not setter_id else escape_sql(setter_id)}, "
            f"{'NULL' if not closer_id else escape_sql(closer_id)}, "
            f"{escape_sql(created_at) if created_at else 'NOW()'}, "
            f"{escape_sql(updated_at) if updated_at else 'NOW()'})"
        )

        # ── Build pipeline INSERT ──
        pipeline_values.append(
            f"({escape_sql(str(uuid.uuid4()))}, {escape_sql(lead_id)}, "
            f"{escape_sql(PIPELINE_CLOSERS)}, {escape_sql(etapa_id)}, "
            f"0, {escape_sql(created_at) if created_at else 'NOW()'})"
        )

        # ── Citas (for leads with call dates) ──
        if fecha_llamada:
            cita_estado = "completada" if llamada_realizada == "Sí" else "pendiente"
            cita_values.append(
                f"({escape_sql(str(uuid.uuid4()))}, {escape_sql(lead_id)}, "
                f"{'NULL' if not closer_id else escape_sql(closer_id)}, "
                f"{'NULL' if not setter_id else escape_sql(setter_id)}, "
                f"{escape_sql(fecha_llamada)}, "
                f"45, "  # duracion_minutos default
                f"{escape_sql(cita_estado)}, "
                f"{escape_sql(created_at) if created_at else 'NOW()'}, "
                f"'importacion_crm')"
            )

        # ── Ventas (for VENTA leads with product info) ──
        if fase == "🥇 VENTA" and (producto_vendido or cash_collected or facturacion_total):
            importe = 0
            try:
                if facturacion_total:
                    importe = float(facturacion_total.replace(",", ".").replace(" ", ""))
                elif cash_collected:
                    importe = float(cash_collected.replace(",", ".").replace(" ", ""))
                elif valor > 0:
                    importe = valor
            except:
                importe = valor if valor > 0 else 0

            # Map payment methods to allowed values
            metodo_pago_mapped = None
            if metodo_pago:
                mp_lower = metodo_pago.lower()
                if "stripe" in mp_lower:
                    metodo_pago_mapped = "stripe"
                elif "sequra" in mp_lower or "hotmart" in mp_lower:
                    metodo_pago_mapped = "hotmart"
                elif "transferencia" in mp_lower:
                    metodo_pago_mapped = "transferencia"

            venta_values.append(
                f"({escape_sql(str(uuid.uuid4()))}, {escape_sql(lead_id)}, "
                f"{'NULL' if not closer_id else escape_sql(closer_id)}, "
                f"{'NULL' if not setter_id else escape_sql(setter_id)}, "
                f"NULL, "  # paquete_id
                f"{escape_sql(created_at[:10]) if created_at else 'CURRENT_DATE'}, "
                f"{importe}, "
                f"{escape_sql(metodo_pago_mapped) if metodo_pago_mapped else 'NULL'}, "
                f"'aprobada', "
                f"false, "  # es_pago_unico
                f"NULL, NULL, NULL, "  # aprobada_por_id, fecha_aprobacion, fecha_rechazo
                f"false, NULL, "  # es_devolucion, fecha_devolucion
                f"{escape_sql(f'Producto: {producto_vendido}. Método original: {metodo_pago}') if producto_vendido else 'NULL'}, "
                f"{escape_sql(created_at) if created_at else 'NOW()'}, "
                f"{escape_sql(updated_at) if updated_at else 'NOW()'})"
            )

    # ── Execute ──
    BATCH = 50
    total_leads = len(lead_values)
    print(f"Inserting {total_leads} leads into closer pipeline...")

    for i in range(0, total_leads, BATCH):
        batch_leads = lead_values[i:i+BATCH]
        batch_pipeline = pipeline_values[i:i+BATCH]

        sql = f"""
INSERT INTO ventas_leads (id, nombre, telefono, email, fuente, fuente_detalle, valor, notas, enlace_grabacion, setter_asignado_id, closer_asignado_id, created_at, updated_at)
VALUES {', '.join(batch_leads)};

INSERT INTO ventas_lead_pipeline (id, lead_id, pipeline_id, etapa_id, contador_intentos, fecha_entrada)
VALUES {', '.join(batch_pipeline)};
"""
        resp = run_sql(token, sql)
        done = min(i + BATCH, total_leads)
        if resp is None:
            print(f"  ERROR at batch {i}-{done}")
            break
        else:
            print(f"  Inserted {done}/{total_leads}")

    # ── Insert citas ──
    if cita_values:
        print(f"Inserting {len(cita_values)} citas...")
        for i in range(0, len(cita_values), BATCH):
            batch = cita_values[i:i+BATCH]
            sql = f"""
INSERT INTO ventas_citas (id, lead_id, closer_id, setter_origen_id, fecha_hora, duracion_minutos, estado, created_at, origen_agendacion)
VALUES {', '.join(batch)};
"""
            resp = run_sql(token, sql)
            done = min(i + BATCH, len(cita_values))
            if resp is None:
                print(f"  ERROR at citas batch {i}-{done}")
                break
            else:
                print(f"  Citas: {done}/{len(cita_values)}")

    # ── Insert ventas ──
    if venta_values:
        print(f"Inserting {len(venta_values)} ventas...")
        for i in range(0, len(venta_values), BATCH):
            batch = venta_values[i:i+BATCH]
            sql = f"""
INSERT INTO ventas_ventas (id, lead_id, closer_id, setter_id, paquete_id, fecha_venta, importe, metodo_pago, estado, es_pago_unico, aprobada_por_id, fecha_aprobacion, fecha_rechazo, es_devolucion, fecha_devolucion, notas, created_at, updated_at)
VALUES {', '.join(batch)};
"""
            resp = run_sql(token, sql)
            done = min(i + BATCH, len(venta_values))
            if resp is None:
                print(f"  ERROR at ventas batch {i}-{done}")
                break
            else:
                print(f"  Ventas: {done}/{len(venta_values)}")

    print("Done!")


if __name__ == "__main__":
    main()
