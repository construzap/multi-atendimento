import type { User } from '@supabase/supabase-js'

/**
 * UUID do usuário autenticado para uso em `user_id` / FKs.
 * Usa `User.id` (padrão no Supabase) e, se vazio, o claim `sub` quando presente no objeto.
 */
export function getAuthUserId(user: User): string | null {
  const id = typeof user.id === 'string' ? user.id.trim() : ''
  if (id.length > 0) return id

  const sub = (user as User & { sub?: unknown }).sub
  if (typeof sub === 'string' && sub.trim().length > 0) return sub.trim()

  return null
}
