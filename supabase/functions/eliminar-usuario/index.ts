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

    const { usuario_id } = await req.json()
    if (!usuario_id) {
      return new Response(JSON.stringify({ error: 'usuario_id es requerido' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Cliente con token del usuario (respeta RLS)
    const supabaseUser = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    )

    // Cliente admin (bypassa RLS)
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

    // Obtener datos del ejecutor
    const { data: ejecutor } = await supabaseAdmin
      .from('usuarios')
      .select('*, rol:roles(id, nombre, nivel)')
      .eq('id', user.id)
      .single()

    if (!ejecutor) {
      return new Response(JSON.stringify({ error: 'Usuario ejecutor no encontrado' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Verificar permiso usuarios.eliminar
    const { data: tienePermiso } = await supabaseAdmin.rpc('tiene_permiso', {
      p_usuario_id: user.id,
      p_permiso_codigo: 'usuarios.eliminar',
    })

    if (!tienePermiso) {
      return new Response(JSON.stringify({ error: 'No tienes permiso para eliminar usuarios' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // No eliminarse a si mismo
    if (usuario_id === user.id) {
      return new Response(JSON.stringify({ error: 'No puedes eliminarte a ti mismo' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Obtener usuario a eliminar
    const { data: target } = await supabaseAdmin
      .from('usuarios')
      .select('*, rol:roles(id, nombre, nivel)')
      .eq('id', usuario_id)
      .single()

    if (!target) {
      return new Response(JSON.stringify({ error: 'Usuario a eliminar no encontrado' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // No eliminar Super Admin (solo otro Super Admin puede)
    if (target.tipo === 'super_admin' && ejecutor.tipo !== 'super_admin') {
      return new Response(JSON.stringify({ error: 'Solo un Super Admin puede eliminar a otro Super Admin' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Verificar jerarquia de niveles
    const nivelEjecutor = ejecutor.tipo === 'super_admin' ? 100 : (ejecutor.rol?.nivel ?? 0)
    const nivelTarget = target.tipo === 'super_admin' ? 100 : (target.rol?.nivel ?? 0)

    if (nivelTarget >= nivelEjecutor && ejecutor.tipo !== 'super_admin') {
      return new Response(JSON.stringify({ error: 'No puedes eliminar un usuario con nivel igual o superior al tuyo' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Soft delete: desactivar usuario
    const { error: updateError } = await supabaseAdmin
      .from('usuarios')
      .update({ activo: false })
      .eq('id', usuario_id)

    if (updateError) {
      return new Response(JSON.stringify({ error: 'Error al desactivar usuario: ' + updateError.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Registrar auditoria
    await supabaseAdmin.rpc('registrar_auditoria', {
      p_usuario_id: user.id,
      p_accion: 'DELETE',
      p_categoria: 'usuarios',
      p_descripcion: `Desactivado usuario: ${target.nombre} (${target.email})`,
      p_tabla: 'usuarios',
      p_registro_id: usuario_id,
      p_datos_antes: target,
    })

    return new Response(JSON.stringify({
      success: true,
      message: `Usuario ${target.nombre} desactivado correctamente`
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
