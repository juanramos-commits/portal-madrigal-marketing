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

    const { rol_id, permisos_ids } = await req.json()
    if (!rol_id || !Array.isArray(permisos_ids)) {
      return new Response(JSON.stringify({ error: 'rol_id y permisos_ids (array) son requeridos' }), {
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

    // Verificar permiso roles.editar
    const { data: tienePermiso } = await supabaseAdmin.rpc('tiene_permiso', {
      p_usuario_id: user.id,
      p_permiso_codigo: 'roles.editar',
    })

    if (!tienePermiso) {
      return new Response(JSON.stringify({ error: 'No tienes permiso para editar roles' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Obtener el rol
    const { data: rol } = await supabaseAdmin
      .from('roles')
      .select('*')
      .eq('id', rol_id)
      .single()

    if (!rol) {
      return new Response(JSON.stringify({ error: 'Rol no encontrado' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // No modificar permisos de Super Admin
    if (rol.nombre === 'Super Admin') {
      return new Response(JSON.stringify({ error: 'No se pueden modificar los permisos de Super Admin' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Verificar nivel: no modificar roles de nivel superior
    const { data: ejecutor } = await supabaseAdmin
      .from('usuarios')
      .select('*, rol:roles(id, nombre, nivel)')
      .eq('id', user.id)
      .single()

    const nivelEjecutor = ejecutor?.tipo === 'super_admin' ? 100 : (ejecutor?.rol?.nivel ?? 0)

    if (rol.nivel >= nivelEjecutor && ejecutor?.tipo !== 'super_admin') {
      return new Response(JSON.stringify({ error: 'No puedes modificar permisos de un rol de nivel igual o superior al tuyo' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Obtener permisos anteriores
    const { data: permisosAnteriores } = await supabaseAdmin
      .from('roles_permisos')
      .select('permiso_id')
      .eq('rol_id', rol_id)

    const idsAnteriores = permisosAnteriores?.map(p => p.permiso_id) || []

    // DELETE + INSERT (transaccion atomica)
    const { error: deleteError } = await supabaseAdmin
      .from('roles_permisos')
      .delete()
      .eq('rol_id', rol_id)

    if (deleteError) {
      return new Response(JSON.stringify({ error: 'Error al limpiar permisos: ' + deleteError.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (permisos_ids.length > 0) {
      const { error: insertError } = await supabaseAdmin
        .from('roles_permisos')
        .insert(permisos_ids.map((permiso_id: string) => ({ rol_id, permiso_id })))

      if (insertError) {
        return new Response(JSON.stringify({ error: 'Error al asignar permisos: ' + insertError.message }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
    }

    // Registrar auditoria
    await supabaseAdmin.rpc('registrar_auditoria', {
      p_usuario_id: user.id,
      p_accion: 'UPDATE',
      p_categoria: 'roles',
      p_descripcion: `Permisos del rol ${rol.nombre} actualizados: ${idsAnteriores.length} -> ${permisos_ids.length}`,
      p_tabla: 'roles_permisos',
      p_registro_id: rol_id,
      p_datos_antes: { permisos: idsAnteriores },
      p_datos_despues: { permisos: permisos_ids },
    })

    return new Response(JSON.stringify({
      success: true,
      message: `Permisos del rol ${rol.nombre} actualizados (${permisos_ids.length} permisos)`
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
