import { serverSupabaseClient, serverSupabaseServiceRole } from '#supabase/server'
import { createError, getQuery } from 'h3'
import type { InstanciaConexaoStatus, InstanciaStatus } from '#shared/types/instanciaStatus'
import { checkChannel } from '../../utils/checkChannel'
import { getAuthUserId } from '../../utils/getAuthUserId'

type UazapiStatusOk = {
  instance?: {
    status?: string
    profileName?: string | null
    profilePicUrl?: string | null
    /** Algumas versões podem retornar variações de nome de campo. */
    profilePicURL?: string | null
    profile_pic_url?: string | null
    owner?: string | null
  }
}

type UazapiStatusError = {
  error?: string
}

/**
 * GET /api/canais/statusInstancia?id_canal=
 * Verifica o status da instância (Uazapi) do canal informado.
 *
 * Retorna apenas: `status`, `nome`, `foto`, `numero`.
 */
export default defineEventHandler(
  async (
    event
  ): Promise<InstanciaStatus> => {
    const client = await serverSupabaseClient(event)
    const { data: authData, error: authError } = await client.auth.getUser()

    if (authError || !authData.user) {
      throw createError({ statusCode: 401, statusMessage: 'Não autenticado' })
    }

    const userId = getAuthUserId(authData.user)
    if (!userId) {
      throw createError({ statusCode: 401, statusMessage: 'Não autenticado' })
    }

    const q = getQuery(event)
    const rawCanal = q.id_canal
    if (rawCanal === undefined || rawCanal === null || rawCanal === '') {
      throw createError({ statusCode: 400, statusMessage: 'Informe id_canal na query.' })
    }

    const canalId = typeof rawCanal === 'number' ? rawCanal : Number.parseInt(String(rawCanal), 10)
    if (!Number.isFinite(canalId) || !Number.isInteger(canalId)) {
      throw createError({ statusCode: 400, statusMessage: 'id_canal inválido.' })
    }

    const ok = await checkChannel(event, canalId, userId)
    if (!ok) {
      throw createError({
        statusCode: 403,
        statusMessage: 'Você não tem permissão para acessar este canal.'
      })
    }

    const admin = serverSupabaseServiceRole<any>(event)

    const { data: canalRow, error: canalErr } = await admin
      .from('canais')
      .select('token, servidor')
      .eq('id', canalId)
      .maybeSingle()

    if (canalErr) {
      throw createError({ statusCode: 500, statusMessage: canalErr.message })
    }

    if (!canalRow) {
      throw createError({ statusCode: 404, statusMessage: 'Canal não encontrado.' })
    }

    const token = typeof canalRow?.token === 'string' ? canalRow.token.trim() : ''
    const servidor = typeof canalRow?.servidor === 'string' ? canalRow.servidor.trim() : ''

    if (!token || !servidor) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Canal não possui token/servidor configurados.'
      })
    }

    // Remove barras finais do servidor antes de concatenar o path.
    // A rota na Uazapi é case-sensitive: `/instance/status` (minúsculo), conforme doc.
    const url = `${servidor.replace(/\/+$/, '')}/instance/status`

    let res: UazapiStatusOk | UazapiStatusError
    try {
      res = await $fetch<UazapiStatusOk | UazapiStatusError>(url, {
        method: 'GET',
        headers: { token }
      })
    } catch (err: unknown) {
      const maybe = err as { data?: unknown; message?: string }
      const data = maybe?.data
      const apiErr =
        data && typeof data === 'object' && 'error' in (data as any) ? String((data as any).error ?? '') : ''

      throw createError({
        statusCode: 502,
        statusMessage: apiErr.trim() || maybe?.message || 'Falha ao consultar status da instância.'
      })
    }

    if (res && typeof res === 'object' && 'error' in res && typeof (res as UazapiStatusError).error === 'string') {
      const msg = (res as UazapiStatusError).error?.trim()
      throw createError({
        statusCode: 502,
        statusMessage: msg || 'Falha ao consultar status da instância.'
      })
    }

    const inst = (res as UazapiStatusOk).instance
    const rawStatus = typeof inst?.status === 'string' ? inst.status : null
    const status: InstanciaConexaoStatus | null =
      rawStatus === 'disconnected' || rawStatus === 'connecting' || rawStatus === 'connected' ? rawStatus : null

    return {
      status,
      nome: typeof inst?.profileName === 'string' ? inst.profileName : null,
      foto: (() => {
        const raw =
          (typeof inst?.profilePicUrl === 'string' && inst.profilePicUrl) ||
          (typeof inst?.profilePicURL === 'string' && inst.profilePicURL) ||
          (typeof (inst as any)?.profile_pic_url === 'string' && (inst as any).profile_pic_url) ||
          ''
        const t = String(raw).trim()
        return t ? t : null
      })(),
      numero: typeof inst?.owner === 'string' ? inst.owner : null
    }
  }
)

