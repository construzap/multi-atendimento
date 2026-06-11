import { serverSupabaseServiceRole } from '#supabase/server'
import { createError } from 'h3'
import type { H3Event } from 'h3'
import type { UserRole } from '#shared/types/profile'

/** Mensagem quando o usuário logado não tem `profiles.role = 'ADMIN'`. */
export const MSG_SEM_ACESSO_ADMIN =
  'Esta área é restrita a administradores do sistema.'

/**
 * Lê `profiles.role` do usuário autenticado.
 * @returns `null` se não houver linha em `profiles`.
 */
export async function getUserRole(event: H3Event, userId: string): Promise<UserRole | null> {
  const admin = serverSupabaseServiceRole<any>(event)

  const { data, error } = await admin
    .from('profiles')
    .select('role')
    .eq('user_id', userId)
    .maybeSingle()

  if (error) {
    throw createError({ statusCode: 500, statusMessage: error.message })
  }

  const raw = (data as { role?: unknown } | null)?.role
  if (raw === 'ADMIN' || raw === 'MEMBRO') return raw

  return null
}

/** Retorna `true` quando `profiles.role` do usuário é `ADMIN`. */
export async function isUserAdmin(event: H3Event, userId: string): Promise<boolean> {
  const role = await getUserRole(event, userId)
  return role === 'ADMIN'
}

/**
 * Garante que o usuário logado é administrador (`profiles.role = 'ADMIN'`).
 * @throws {createError} 403 — perfil sem papel de administrador.
 * @throws {createError} 500 — erro de banco.
 */
export async function checkAdmin(event: H3Event, userId: string): Promise<void> {
  const isAdmin = await isUserAdmin(event, userId)

  if (!isAdmin) {
    throw createError({
      statusCode: 403,
      statusMessage: MSG_SEM_ACESSO_ADMIN,
    })
  }
}
