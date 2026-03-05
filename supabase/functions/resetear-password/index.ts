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

    const { usuario_id, nueva_password } = await req.json()
    if (!usuario_id || !nueva_password) {
      return new Response(JSON.stringify({ error: 'usuario_id y nueva_password son requeridos' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Validar contraseña
    if (nueva_password.length < 8) {
      return new Response(JSON.stringify({ error: 'La contraseña debe tener al menos 8 caracteres' }), {
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

    // Verificar permiso (super_admin tiene acceso total)
    if (ejecutor.tipo !== 'super_admin') {
      const { data: tienePermiso } = await supabaseAdmin.rpc('tiene_permiso', {
        p_usuario_id: user.id,
        p_permiso_codigo: 'usuarios.editar',
      })

      if (!tienePermiso) {
        return new Response(JSON.stringify({ error: 'No tienes permiso para cambiar contraseñas' }), {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
    }

    // No cambiar contraseña propia por esta vía
    if (usuario_id === user.id) {
      return new Response(JSON.stringify({ error: 'No puedes cambiar tu propia contraseña por esta vía' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Obtener usuario objetivo
    const { data: target } = await supabaseAdmin
      .from('usuarios')
      .select('*, rol:roles(id, nombre, nivel)')
      .eq('id', usuario_id)
      .single()

    if (!target) {
      return new Response(JSON.stringify({ error: 'Usuario no encontrado' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // No cambiar contraseña de Super Admin si no eres Super Admin
    if (target.tipo === 'super_admin' && ejecutor.tipo !== 'super_admin') {
      return new Response(JSON.stringify({ error: 'Solo un Super Admin puede cambiar la contraseña de otro Super Admin' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Verificar jerarquia de niveles
    const nivelEjecutor = ejecutor.tipo === 'super_admin' ? 100 : (ejecutor.rol?.nivel ?? 0)
    const nivelTarget = target.tipo === 'super_admin' ? 100 : (target.rol?.nivel ?? 0)

    if (nivelTarget >= nivelEjecutor && ejecutor.tipo !== 'super_admin') {
      return new Response(JSON.stringify({ error: 'No puedes cambiar la contraseña de un usuario con nivel igual o superior' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Cambiar contraseña usando Admin API
    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
      usuario_id,
      { password: nueva_password }
    )

    if (updateError) {
      return new Response(JSON.stringify({ error: 'Error al cambiar contraseña: ' + updateError.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Registrar auditoria
    await supabaseAdmin.rpc('registrar_auditoria', {
      p_usuario_id: user.id,
      p_accion: 'UPDATE',
      p_categoria: 'usuarios',
      p_descripcion: `Contraseña reseteada para: ${target.nombre} (${target.email})`,
      p_tabla: 'usuarios',
      p_registro_id: usuario_id,
      p_datos_antes: null,
    })

    return new Response(JSON.stringify({
      success: true,
      message: `Contraseña de ${target.nombre} actualizada correctamente`
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
