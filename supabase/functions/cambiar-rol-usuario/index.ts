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

    const { usuario_id, nuevo_rol_id } = await req.json()
    if (!usuario_id) {
      return new Response(JSON.stringify({ error: 'usuario_id es requerido' }), {
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

    // Verificar permiso usuarios.editar
    const { data: tienePermiso } = await supabaseAdmin.rpc('tiene_permiso', {
      p_usuario_id: user.id,
      p_permiso_codigo: 'usuarios.editar',
    })

    if (!tienePermiso) {
      return new Response(JSON.stringify({ error: 'No tienes permiso para editar usuarios' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Obtener datos del ejecutor
    const { data: ejecutor } = await supabaseAdmin
      .from('usuarios')
      .select('*, rol:roles(id, nombre, nivel)')
      .eq('id', user.id)
      .single()

    // Obtener usuario target
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

    // No cambiar rol de Super Admin (solo otro Super Admin puede)
    if (target.tipo === 'super_admin' && ejecutor.tipo !== 'super_admin') {
      return new Response(JSON.stringify({ error: 'Solo un Super Admin puede cambiar el rol de otro Super Admin' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Verificar nivel del nuevo rol
    if (nuevo_rol_id) {
      const { data: nuevoRol } = await supabaseAdmin
        .from('roles')
        .select('*')
        .eq('id', nuevo_rol_id)
        .single()

      if (!nuevoRol) {
        return new Response(JSON.stringify({ error: 'Rol no encontrado' }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      const nivelEjecutor = ejecutor.tipo === 'super_admin' ? 100 : (ejecutor.rol?.nivel ?? 0)

      // No puede asignar un rol de nivel igual o superior al suyo
      if (nuevoRol.nivel >= nivelEjecutor && ejecutor.tipo !== 'super_admin') {
        return new Response(JSON.stringify({ error: 'No puedes asignar un rol de nivel igual o superior al tuyo' }), {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
    }

    // Ejecutar UPDATE
    const { error: updateError } = await supabaseAdmin
      .from('usuarios')
      .update({ rol_id: nuevo_rol_id || null })
      .eq('id', usuario_id)

    if (updateError) {
      return new Response(JSON.stringify({ error: 'Error al cambiar rol: ' + updateError.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Registrar auditoria
    const { data: nuevoRolData } = nuevo_rol_id
      ? await supabaseAdmin.from('roles').select('nombre').eq('id', nuevo_rol_id).single()
      : { data: { nombre: 'Sin rol' } }

    await supabaseAdmin.rpc('registrar_auditoria', {
      p_usuario_id: user.id,
      p_accion: 'UPDATE',
      p_categoria: 'usuarios',
      p_descripcion: `Cambio de rol de ${target.nombre}: ${target.rol?.nombre || 'Sin rol'} -> ${nuevoRolData?.nombre || 'Sin rol'}`,
      p_tabla: 'usuarios',
      p_registro_id: usuario_id,
      p_campos_modificados: ['rol_id'],
    })

    return new Response(JSON.stringify({
      success: true,
      message: `Rol actualizado a ${nuevoRolData?.nombre || 'Sin rol'}`
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
