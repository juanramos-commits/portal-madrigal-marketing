import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    if (req.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Metodo no permitido' }), {
        status: 405,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'No autorizado' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { cliente_id } = await req.json()
    if (!cliente_id) {
      return new Response(JSON.stringify({ error: 'cliente_id es requerido' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const supabaseUser = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    )

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    )

    // Obtener usuario que ejecuta
    const { data: { user }, error: authError } = await supabaseUser.auth.getUser()
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Token invalido' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Verificar permiso clientes.eliminar
    const { data: tienePermiso } = await supabaseAdmin.rpc('tiene_permiso', {
      p_usuario_id: user.id,
      p_permiso_codigo: 'clientes.eliminar',
    })

    if (!tienePermiso) {
      return new Response(JSON.stringify({ error: 'No tienes permiso para eliminar clientes' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Obtener cliente
    const { data: cliente } = await supabaseAdmin
      .from('clientes')
      .select('*')
      .eq('id', cliente_id)
      .single()

    if (!cliente) {
      return new Response(JSON.stringify({ error: 'Cliente no encontrado' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Verificar asignacion si el usuario tiene restriccion
    const { data: tieneRestriccion } = await supabaseAdmin.rpc('tiene_permiso', {
      p_usuario_id: user.id,
      p_permiso_codigo: 'clientes.ver_solo_asignados',
    })

    if (tieneRestriccion && cliente.usuario_asignado_id !== user.id) {
      return new Response(JSON.stringify({ error: 'Solo puedes eliminar clientes asignados a ti' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Verificar dependencias criticas
    const warnings: string[] = []

    const { count: facturasCount } = await supabaseAdmin
      .from('facturas')
      .select('*', { count: 'exact', head: true })
      .eq('cliente_id', cliente_id)
      .eq('estado', 'pendiente')

    if (facturasCount && facturasCount > 0) {
      warnings.push(`${facturasCount} factura(s) pendiente(s)`)
    }

    const { count: campanasCount } = await supabaseAdmin
      .from('campanas')
      .select('*', { count: 'exact', head: true })
      .eq('cliente_id', cliente_id)
      .eq('activa', true)

    if (campanasCount && campanasCount > 0) {
      warnings.push(`${campanasCount} campana(s) activa(s)`)
    }

    // Eliminar datos relacionados en cascada
    const tablasRelacionadas = [
      'cliente_historial', 'cliente_notas', 'clientes_facturacion',
      'clientes_branding', 'clientes_urls', 'clientes_info_adicional',
      'clientes_socios', 'paquetes_leads', 'leads', 'reuniones',
      'campanas', 'facturas'
    ]

    for (const tabla of tablasRelacionadas) {
      await supabaseAdmin.from(tabla).delete().eq('cliente_id', cliente_id)
    }

    // Desasociar usuarios tipo cliente
    await supabaseAdmin
      .from('usuarios')
      .update({ cliente_id: null })
      .eq('cliente_id', cliente_id)

    // Eliminar el cliente
    const { error: deleteError } = await supabaseAdmin
      .from('clientes')
      .delete()
      .eq('id', cliente_id)

    if (deleteError) {
      return new Response(JSON.stringify({ error: 'Error al eliminar cliente: ' + deleteError.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Registrar auditoria
    await supabaseAdmin.rpc('registrar_auditoria', {
      p_usuario_id: user.id,
      p_accion: 'DELETE',
      p_categoria: 'clientes',
      p_descripcion: `Eliminado cliente: ${cliente.nombre_comercial || cliente.nombre_pila}`,
      p_tabla: 'clientes',
      p_registro_id: cliente_id,
      p_datos_antes: cliente,
    })

    return new Response(JSON.stringify({
      success: true,
      message: `Cliente ${cliente.nombre_comercial || cliente.nombre_pila} eliminado`,
      warnings: warnings.length > 0 ? warnings : undefined,
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message || 'Error interno' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
