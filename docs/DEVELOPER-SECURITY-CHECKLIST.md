# Checklist de Seguridad para Developers

## Reglas fundamentales

- **NUNCA** usar `service_role` key en el frontend. Solo `anon` key
- **NUNCA** exponer credenciales en el código. Usar variables de entorno (`.env`)
- **NUNCA** hacer `console.log` de datos sensibles. Usar `logger` que se desactiva en producción

## Al crear una tabla nueva

1. **Habilitar RLS inmediatamente**:
   ```sql
   ALTER TABLE mi_tabla ENABLE ROW LEVEL SECURITY;
   ```

2. **Crear políticas RLS** para SELECT, INSERT, UPDATE, DELETE:
   ```sql
   CREATE POLICY mi_tabla_select ON mi_tabla FOR SELECT USING (
     tiene_permiso(auth.uid()::uuid, 'mi_modulo.ver')
   );
   ```

3. **No olvidar** que sin políticas + RLS habilitado = nadie puede acceder (por defecto es seguro)

## Al crear una ruta nueva

1. Envolver con `PermissionRoute`:
   ```jsx
   <Route path="nueva-ruta" element={
     <PermissionRoute permiso="modulo.permiso">
       <NuevaPagina />
     </PermissionRoute>
   } />
   ```

2. Añadir al sidebar en `Layout.jsx` con el campo `permiso`

3. Usar `tienePermiso()` para ocultar botones y acciones:
   ```jsx
   {tienePermiso('modulo.accion') && <button>Acción</button>}
   ```

## Al crear un permiso nuevo

1. **Insertar en la tabla permisos**:
   ```sql
   INSERT INTO permisos (modulo, codigo, descripcion)
   VALUES ('mi_modulo', 'mi_modulo.mi_accion', 'Descripción');
   ```

2. **Asignar a roles** en `roles_permisos`

3. **Actualizar** la constante `MODULOS` en `Usuarios.jsx` y `Roles.jsx`

## Al crear un módulo nuevo en el sidebar

1. Definir el item en `defaultNavigation` de `Layout.jsx`
2. Incluir campo `permiso` para filtrado automático
3. Si es solo para ciertos tipos de usuario, añadir `onlyFor: ['equipo', 'admin']`

## Operaciones destructivas

- **Siempre** usar Edge Functions para eliminar/desactivar usuarios, clientes, cambiar roles
- **Nunca** hacer DELETE directo desde el frontend a tablas críticas
- Las Edge Functions validan jerarquía, protegen Super Admin, y registran auditoría

## Testing de seguridad

1. Login como Super Admin -> verificar acceso total
2. Login como usuario limitado -> verificar:
   - Rutas bloqueadas devuelven "No tienes acceso"
   - Sidebar solo muestra items autorizados
   - Botones de acción ocultos sin permiso
3. Verificar audit_log tiene registros de las acciones
4. Intentar acceder a URLs directamente sin permiso

## Passwords

- Mínimo 8 caracteres
- Requiere: mayúscula, minúscula, número, carácter especial
- Usar `validarPassword()` de `src/lib/passwordValidation.js`
- Usar `PasswordStrengthMeter` component en formularios

## Auditoría

- Todas las acciones importantes se registran automáticamente vía triggers
- Los eventos de auth (LOGIN, LOGOUT, MFA) se registran desde el frontend
- Usar `registrar_auditoria()` RPC para acciones custom:
  ```javascript
  await supabase.rpc('registrar_auditoria', {
    p_usuario_id: usuario.id,
    p_accion: 'MI_ACCION',
    p_categoria: 'mi_modulo',
    p_descripcion: 'Descripción de la acción'
  })
  ```
