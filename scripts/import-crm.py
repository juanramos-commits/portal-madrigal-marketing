#!/usr/bin/env python3
"""
Import opportunities.csv from old CRM into Supabase ventas_leads + ventas_lead_pipeline.
"""
import csv
import json
import subprocess
import uuid
import sys

CSV_PATH = "/Users/juanramosgonzalez/Downloads/opportunities.csv"
PROJECT_REF = "ootncgtcvwnrskqtamak"

# ── ID Mappings ──
PIPELINE_SETTERS = "a0000000-0000-0000-0000-000000000001"

ETAPA_MAP = {
    "🧨 POR CONTACTAR": "86426696-28a8-492f-85e6-6857fce68f3f",
    "💪 CONTACTADO": "27565840-01d2-4bab-9aa0-9c8c4576790a",
    "👻 GHOSTING": "cadbcc64-9115-49bb-831b-feea5449250c",
    "👻 GHOSTING 1": "cadbcc64-9115-49bb-831b-feea5449250c",
    "👻 GHOSTING 2": "45df3639-8d20-433e-898e-5a9874f2ec5f",
    "👀 SEGUIMIENTO": "67883eab-18bd-4f93-b59f-28e5cb3cece0",
    "👀 SEGUIMIENTO 2": "30e06b70-4edd-4d10-927a-1af674e2821a",
    "♻️ NURTURING": "ba757014-fb92-4086-8fb3-dab12b8045c4",
    "✅ AGENDADO": "a4c071d0-3756-4d13-89a8-cb3abb1b8f73",
    "📳 YA AGENDO": "a4c071d0-3756-4d13-89a8-cb3abb1b8f73",
    "🚯 NO LEAD": "0f3cb6be-a214-4a27-8881-4c5814caacf0",       # → Lost + tag
    "📵 TELEFONO ERRONEO": "0f3cb6be-a214-4a27-8881-4c5814caacf0", # → Lost + tag
    "❌ LOST": "0f3cb6be-a214-4a27-8881-4c5814caacf0",
}

SETTER_MAP = {
    "Mercedes Hernandez": "0bf00739-59e3-4b1d-bf78-f4b5bfb57ce9",
    "Mireia Garcia": "2af74587-e3df-44f7-a4b4-48bd286824d7",
    "Pablo Zamora": "504f3541-90e9-4488-b5f9-807873e32937",
}

ETIQUETA_NO_LEAD = "fefa413c-a6f7-4619-89f3-eec439b60de1"
ETIQUETA_TEL_ERRONEO = "946ad2b9-5b41-4b02-80d1-e68acec6edce"

def get_token():
    raw = subprocess.check_output(
        ["security", "find-generic-password", "-s", "Supabase CLI", "-w"],
        stderr=subprocess.DEVNULL
    ).decode().strip()
    if raw.startswith("go-keyring-base64:"):
        import base64
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
            print(f"SQL ERROR: {data['message'][:200]}")
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

    print(f"Loaded {len(rows)} rows from CSV")

    # Build SQL in batches
    lead_values = []
    pipeline_values = []
    etiqueta_values = []

    for row in rows:
        lead_id = str(uuid.uuid4())

        nombre = (row.get("Nombre del contacto") or row.get("Nombre del cliente potencial") or "").strip()
        telefono = (row.get("teléfono") or "").strip() or None
        email = (row.get("correo electrónico") or "").strip() or None
        fuente = (row.get("fuente") or "").strip() or None
        valor = 0
        try:
            valor = float(row.get("Valor del cliente potencial", 0) or 0)
        except:
            valor = 0

        # Notas: combine Notas + Seguidores info + enlace grabacion + any extra
        notas_parts = []
        notas_raw = (row.get("Notas") or "").strip()
        if notas_raw:
            notas_parts.append(notas_raw)

        seguidores = (row.get("Seguidores") or "").strip()
        enlace_grabacion = (row.get("⏺️ Links Grabacion Llamadas") or "").strip() or None
        producto_vendido = (row.get("🎁 Producto Vendido") or "").strip()
        metodo_pago = (row.get("💳 Método de Pago") or "").strip()
        cash_collected = (row.get("Cash Collected") or "").strip()
        facturacion_total = (row.get("Facturación Total") or "").strip()
        fecha_llamada = (row.get("🗓️ Fecha de Llamada") or "").strip()
        llamada_realizada = (row.get("¿Se ha realizado la llamada?") or "").strip()

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

        notas = "\n".join(notas_parts) if notas_parts else None

        # Setter
        asignado = (row.get("📥 Setter Asignado") or row.get("asignado") or "").strip()
        setter_id = SETTER_MAP.get(asignado)

        # Closer (from Seguidores field)
        closer_id = SETTER_MAP.get(seguidores) if seguidores else None

        # Dates
        created_at = (row.get("Creado el") or "").strip()
        updated_at = (row.get("Actualizado el") or "").strip()

        # Stage
        fase = (row.get("fase") or "").strip()
        etapa_id = ETAPA_MAP.get(fase, "86426696-28a8-492f-85e6-6857fce68f3f")  # default: Por Contactar

        # Fuente detail from old CRM
        fuente_detalle = (row.get("Fuente del lead") or "").strip() or None

        # Old CRM IDs for traceability
        old_opp_id = (row.get("ID de oportunidad") or "").strip()
        old_contact_id = (row.get("ID de contacto") or "").strip()

        # Build lead INSERT
        lead_values.append(
            f"({escape_sql(lead_id)}, {escape_sql(nombre)}, {escape_sql(telefono)}, "
            f"{escape_sql(email)}, {escape_sql(fuente)}, {escape_sql(fuente_detalle)}, "
            f"{valor}, {escape_sql(notas)}, {escape_sql(enlace_grabacion)}, "
            f"{'NULL' if not setter_id else escape_sql(setter_id)}, "
            f"{'NULL' if not closer_id else escape_sql(closer_id)}, "
            f"{escape_sql(created_at) if created_at else 'NOW()'}, "
            f"{escape_sql(updated_at) if updated_at else 'NOW()'})"
        )

        # Build pipeline INSERT
        pipeline_values.append(
            f"({escape_sql(str(uuid.uuid4()))}, {escape_sql(lead_id)}, "
            f"{escape_sql(PIPELINE_SETTERS)}, {escape_sql(etapa_id)}, "
            f"0, {escape_sql(created_at) if created_at else 'NOW()'})"
        )

        # Etiquetas
        if fase == "🚯 NO LEAD":
            etiqueta_values.append(
                f"({escape_sql(str(uuid.uuid4()))}, {escape_sql(lead_id)}, {escape_sql(ETIQUETA_NO_LEAD)})"
            )
        elif fase == "📵 TELEFONO ERRONEO":
            etiqueta_values.append(
                f"({escape_sql(str(uuid.uuid4()))}, {escape_sql(lead_id)}, {escape_sql(ETIQUETA_TEL_ERRONEO)})"
            )

    # Execute in batches of 50
    BATCH = 50
    total_leads = len(lead_values)
    print(f"Inserting {total_leads} leads...")

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
            # Try to print more detail
            break
        else:
            print(f"  Inserted {done}/{total_leads}")

    # Insert etiquetas
    if etiqueta_values:
        print(f"Inserting {len(etiqueta_values)} etiquetas...")
        for i in range(0, len(etiqueta_values), BATCH):
            batch = etiqueta_values[i:i+BATCH]
            sql = f"""
INSERT INTO ventas_lead_etiquetas (id, lead_id, etiqueta_id)
VALUES {', '.join(batch)};
"""
            resp = run_sql(token, sql)
            done = min(i + BATCH, len(etiqueta_values))
            if resp is None:
                print(f"  ERROR at etiquetas batch {i}-{done}")
                break
            else:
                print(f"  Etiquetas: {done}/{len(etiqueta_values)}")

    print("Done!")

if __name__ == "__main__":
    main()
