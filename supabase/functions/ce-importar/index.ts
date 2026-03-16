import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { isBlacklisted } from "../_shared/blacklist-checker.ts";
import { batchVerifyMX } from "../_shared/mx-verifier.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type, authorization",
};

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

/** Basic email format validation. */
function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

const MAX_IMPORT_SIZE = 10_000;
const UPSERT_BATCH_SIZE = 500;

interface ContactoInput {
  email: string;
  nombre?: string;
  empresa?: string;
  cargo?: string;
  telefono?: string;
  etiquetas?: string[];
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const body = await req.json();
    const contactos: ContactoInput[] = body.contactos;
    const listaId: string | undefined = body.lista_id;
    const verificarMx: boolean = body.verificar_mx ?? false;

    // ── 1. Validate input ────────────────────────────────────────────
    if (!Array.isArray(contactos) || contactos.length === 0) {
      return jsonResponse(
        { error: "contactos debe ser un array no vacio" },
        400,
      );
    }

    if (contactos.length > MAX_IMPORT_SIZE) {
      return jsonResponse(
        {
          error: `Maximo ${MAX_IMPORT_SIZE} contactos por importacion`,
        },
        400,
      );
    }

    // ── 2. Deduplicate by email (lowercase) ──────────────────────────
    const seen = new Map<string, ContactoInput>();
    const errores: string[] = [];

    for (const c of contactos) {
      if (!c.email || typeof c.email !== "string") {
        errores.push("Contacto sin email valido omitido");
        continue;
      }

      const normalizedEmail = c.email.trim().toLowerCase();
      if (!isValidEmail(normalizedEmail)) {
        errores.push(`Email invalido: ${normalizedEmail}`);
        continue;
      }

      // Keep last occurrence (overwrites duplicates).
      seen.set(normalizedEmail, { ...c, email: normalizedEmail });
    }

    const uniqueContacts = [...seen.values()];

    // ── 3. Check blacklist ───────────────────────────────────────────
    const blacklistedEmails = new Set<string>();
    const nonBlacklisted: ContactoInput[] = [];

    // Check in parallel batches of 50 to avoid overwhelming the DB.
    const BLACKLIST_BATCH = 50;
    for (let i = 0; i < uniqueContacts.length; i += BLACKLIST_BATCH) {
      const batch = uniqueContacts.slice(i, i + BLACKLIST_BATCH);
      const results = await Promise.all(
        batch.map(async (c) => ({
          contact: c,
          blacklisted: await isBlacklisted(supabase, c.email),
        })),
      );

      for (const { contact, blacklisted } of results) {
        if (blacklisted) {
          blacklistedEmails.add(contact.email);
        } else {
          nonBlacklisted.push(contact);
        }
      }
    }

    // ── 4. Optional MX verification ──────────────────────────────────
    let mxInvalid = 0;
    let mxResults: Map<string, boolean> | null = null;

    if (verificarMx && nonBlacklisted.length > 0) {
      const emails = nonBlacklisted.map((c) => c.email);
      mxResults = await batchVerifyMX(emails);

      for (const [email, valid] of mxResults) {
        if (!valid) mxInvalid++;
      }
    }

    // ── 5. Upsert into ce_contactos ──────────────────────────────────
    let importados = 0;
    let actualizados = 0;
    const contactIdsForLista: string[] = [];

    for (let i = 0; i < nonBlacklisted.length; i += UPSERT_BATCH_SIZE) {
      const batch = nonBlacklisted.slice(i, i + UPSERT_BATCH_SIZE);

      const rows = batch.map((c) => {
        const row: Record<string, unknown> = {
          email: c.email,
          nombre: c.nombre ?? null,
          empresa: c.empresa ?? null,
          cargo: c.cargo ?? null,
          telefono: c.telefono ?? null,
          etiquetas: c.etiquetas ?? [],
          estado: "activo",
        };

        if (verificarMx && mxResults) {
          const valid = mxResults.get(c.email);
          row.mx_valido = valid ?? null;
          row.mx_verificado_at = valid !== undefined ? new Date().toISOString() : null;
        }

        return row;
      });

      const { data: upserted, error: upsertErr } = await supabase
        .from("ce_contactos")
        .upsert(rows, {
          onConflict: "email",
          ignoreDuplicates: false,
        })
        .select("id, email");

      if (upsertErr) {
        errores.push(`Upsert batch error: ${upsertErr.message}`);
        continue;
      }

      if (upserted) {
        for (const row of upserted) {
          contactIdsForLista.push(row.id);
        }
        // Count all as imported (upsert doesn't distinguish insert vs update
        // without extra logic; we report total processed).
        importados += upserted.length;
      }
    }

    // Estimate actualizados: if we had existing emails, some were updates.
    // We rely on the total minus truly new ones. Since Supabase upsert
    // doesn't distinguish, report total as importados.
    actualizados = 0; // Cannot distinguish without pre-check; leave at 0.

    // ── 6. Link to lista if provided ─────────────────────────────────
    if (listaId && contactIdsForLista.length > 0) {
      const listaRows = contactIdsForLista.map((contactoId) => ({
        contacto_id: contactoId,
        lista_id: listaId,
      }));

      // Insert in batches, ignoring conflicts (contact already in list).
      for (let i = 0; i < listaRows.length; i += UPSERT_BATCH_SIZE) {
        const batch = listaRows.slice(i, i + UPSERT_BATCH_SIZE);
        const { error: listaErr } = await supabase
          .from("ce_contactos_listas")
          .upsert(batch, {
            onConflict: "contacto_id,lista_id",
            ignoreDuplicates: true,
          });

        if (listaErr) {
          errores.push(`Lista insert error: ${listaErr.message}`);
        }
      }
    }

    // ── 7. Return summary ────────────────────────────────────────────
    return jsonResponse({
      importados,
      actualizados,
      rechazados_blacklist: blacklistedEmails.size,
      rechazados_mx: mxInvalid,
      total_recibidos: contactos.length,
      duplicados_entrada: contactos.length - uniqueContacts.length,
      errores,
    });
  } catch (err) {
    console.error("ce-importar error:", err);
    return jsonResponse(
      { error: "Error interno", detail: String(err) },
      500,
    );
  }
});
