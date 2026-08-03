import { MSG_SEM_PERMISSAO_PAGINA } from '#shared/types/pageRoles'
import type { UserProfile } from '#shared/types/profile'
import { parseWorkspacePageRoute } from '#shared/utils/resolvePageRoleSlug'
import { usePageRolesStore } from '~/stores/pageRoles'
import { useProfileStore } from '~/stores/profile'
import { useWorkspacesStore } from '~/stores/workspaces'

function mensagemDoErro(err: unknown, fallback: string): string {
  if (!err || typeof err !== 'object') return fallback
  const e = err as Record<string, unknown>
  const data = e.data
  if (data && typeof data === 'object') {
    const d = data as Record<string, unknown>
    if (typeof d.message === 'string' && d.message.trim()) return d.message
    if (typeof d.statusMessage === 'string' && d.statusMessage.trim()) return d.statusMessage
  }
  if (typeof e.message === 'string' && e.message.trim()) return e.message
  if (typeof e.statusMessage === 'string' && e.statusMessage.trim()) return e.statusMessage
  return fallback
}

function statusDoErro(err: unknown): number {
  if (!err || typeof err !== 'object') return NaN
  const e = err as Record<string, unknown>
  if (typeof e.statusCode === 'number') return e.statusCode
  const data = e.data
  if (data && typeof data === 'object' && typeof (data as { statusCode?: unknown }).statusCode === 'number') {
    return (data as { statusCode: number }).statusCode
  }
  return NaN
}

/**
 * Em rotas `/workspaces/:id/...`: usa cache Pinia de `page_roles`.
 * Só chama a API se ainda não houver dados para o par workspace+profile
 * (1ª abertura / F5 / troca de workspace). Depois valida o slug localmente.
 */
export default defineNuxtRouteMiddleware(async (to) => {
  const parsed = parseWorkspacePageRoute(to.path)
  if (!parsed) return

  const { workspaceId, pageSlug } = parsed
  const workspaces = useWorkspacesStore()
  const profile = useProfileStore()
  const pageRoles = usePageRolesStore()
  const ufetch = useRequestFetch()

  workspaces.setCurrentWorkspaceId(String(workspaceId))

  try {
    await profile.ensureMeLoaded()
  } catch {
    try {
      const me = await ufetch<UserProfile>('/api/perfil/me', { method: 'GET' })
      profile.me = me
      profile.loadedAt = Date.now()
    } catch {
      return
    }
  }

  const profileId = profile.me?.id
  if (profileId == null || !Number.isFinite(Number(profileId))) {
    return abortNavigation(
      createError({
        statusCode: 403,
        message: MSG_SEM_PERMISSAO_PAGINA,
        statusMessage: 'Acesso negado',
        fatal: true,
      }),
    )
  }

  if (!pageRoles.isLoadedFor(workspaceId, Number(profileId))) {
    try {
      await pageRoles.checkPageRoles({
        workspaceId,
        profileId: Number(profileId),
        fetcher: ufetch as typeof $fetch,
      })
    } catch (err: unknown) {
      const statusCode = statusDoErro(err)
      const message = mensagemDoErro(err, MSG_SEM_PERMISSAO_PAGINA)

      return abortNavigation(
        createError({
          statusCode: Number.isFinite(statusCode) && statusCode >= 400 ? statusCode : 500,
          message: message || 'Não foi possível verificar permissões desta página.',
          statusMessage: 'Erro ao verificar permissão',
          fatal: true,
        }),
      )
    }
  }

  if (!pageRoles.hasPage(pageSlug)) {
    return abortNavigation(
      createError({
        statusCode: 403,
        message: MSG_SEM_PERMISSAO_PAGINA,
        statusMessage: 'Acesso negado',
        fatal: true,
      }),
    )
  }
})
