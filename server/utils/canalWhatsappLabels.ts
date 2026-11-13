import { serverSupabaseClient, serverSupabaseServiceRole } from '#supabase/server'
import { createError } from 'h3'
import type { H3Event } from 'h3'
import { checkChannel } from './checkChannel'
import { getAuthUserId } from './getAuthUserId'

export type CanalWhatsappCredenciais = {
  canalId: number
  token: string
  servidor: string
}

export function parseCanalIdBody(raw: unknown): number {
  const n = typeof raw === 'number' ? raw : Number.parseInt(String(raw ?? ''), 10)
  if (!Number.isFinite(n) || !Number.isInteger(n) || n < 1) {
    throw createError({ statusCode: 400, statusMessage: 'id_canal inválido.' })
  }
  return n
}

export function parseNomeLabel(raw: unknown): string {
  if (typeof raw !== 'string') {
    throw createError({ statusCode: 400, statusMessage: 'Informe o nome da etiqueta.' })
  }
  const nome = raw.trim()
  if (!nome) {
    throw createError({ statusCode: 400, statusMessage: 'Informe o nome da etiqueta.' })
  }
  if (nome.length > 100) {
    throw createError({ statusCode: 400, statusMessage: 'Nome da etiqueta é longo demais.' })
  }
  return nome
}

export function parseCorLabel(raw: unknown): number {
  const n = typeof raw === 'number' ? raw : Number.parseInt(String(raw ?? ''), 10)
  if (!Number.isFinite(n) || !Number.isInteger(n) || n < 0 || n > 19) {
    throw createError({ statusCode: 400, statusMessage: 'Cor inválida (use um código de 0 a 19).' })
  }
  return n
}

export function parseLabelIdEdit(raw: unknown): string {
  const id = String(raw ?? '').trim()
  if (!id || id === 'new') {
    throw createError({ statusCode: 400, statusMessage: 'Informe o labelid da etiqueta.' })
  }
  return id
}

export async function credenciaisCanalWhatsappLabels(
  event: H3Event,
  canalId: number,
): Promise<CanalWhatsappCredenciais> {
  const client = await serverSupabaseClient(event)
  const { data: authData, error: authError } = await client.auth.getUser()
  if (authError || !authData.user) {
    throw createError({ statusCode: 401, statusMessage: 'Não autenticado' })
  }

  const userId = getAuthUserId(authData.user)
  if (!userId) {
    throw createError({ statusCode: 401, statusMessage: 'Não autenticado' })
  }

  const ok = await checkChannel(event, canalId, userId)
  if (!ok) {
    throw createError({
      statusCode: 403,
      statusMessage: 'Você não tem permissão para acessar este canal.',
    })
  }

  const admin = serverSupabaseServiceRole<any>(event)
  const { data: canalRow, error: canalErr } = await admin
    .from('canais')
    .select('token, servidor')
    .eq('id', canalId)
    .is('deleted_at', null)
    .maybeSingle()

  if (canalErr) throw createError({ statusCode: 500, statusMessage: canalErr.message })
  if (!canalRow) throw createError({ statusCode: 404, statusMessage: 'Canal não encontrado.' })

  const token = typeof canalRow.token === 'string' ? canalRow.token.trim() : ''
  const servidor = typeof canalRow.servidor === 'string' ? canalRow.servidor.trim() : ''
  if (!token || !servidor) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Canal não possui token/servidor configurados.',
    })
  }

  return { canalId, token, servidor }
}

/** Listagem: `GET /labels`. */
export function urlLabelsUazapi(servidor: string): string {
  return `${String(servidor).replace(/\/+$/, '')}/labels`
}

/** Criar / editar / deletar: `POST /label/edit`. */
export function urlLabelEditUazapi(servidor: string): string {
  return `${String(servidor).replace(/\/+$/, '')}/label/edit`
}

export function mensagemErroUazapiLabels(err: unknown, fallback: string): string {
  const maybe = err as { data?: unknown; message?: string }
  const data = maybe?.data
  const apiErr =
    data && typeof data === 'object' && 'error' in (data as Record<string, unknown>)
      ? String((data as Record<string, unknown>).error ?? '')
      : ''
  return apiErr.trim() || maybe?.message || fallback
}

export async function postLabelUazapi(
  servidor: string,
  token: string,
  body: { labelid: string; name: string; color: number; delete: boolean },
): Promise<{ response: string }> {
  try {
    const res = await $fetch<{ response?: string }>(urlLabelEditUazapi(servidor), {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        token,
      },
      body,
    })
    return {
      response: typeof res?.response === 'string' && res.response.trim() ? res.response.trim() : 'ok',
    }
  } catch (err: unknown) {
    throw createError({
      statusCode: 502,
      statusMessage: mensagemErroUazapiLabels(err, 'Falha ao salvar a etiqueta no WhatsApp.'),
    })
  }
}

/** Aplica etiquetas em um chat: `POST {servidor}/chat/labels`. */
export function urlChatLabelsUazapi(servidor: string): string {
  return `${String(servidor).replace(/\/+$/, '')}/chat/labels`
}

export type AtualizarEtiquetasConversaWhatsappInput = {
  servidor: string
  token: string
  /** Telefone/JID do contato (`number` da Uazapi). */
  number: string
  /** Lista de `labelid` a aplicar (vazia = remove etiquetas). */
  labelids: string[]
}

/**
 * Define as etiquetas do chat no WhatsApp via Uazapi.
 * `labelids: []` limpa; com IDs, substitui pelo conjunto informado.
 */
export async function atualizarEtiquetasConversaWhatsapp(
  input: AtualizarEtiquetasConversaWhatsappInput,
): Promise<{ response: string }> {
  const servidor = String(input.servidor ?? '').trim()
  const token = String(input.token ?? '').trim()
  const number = String(input.number ?? '').trim()
  if (!servidor || !token) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Canal sem token/servidor para atualizar etiquetas.',
    })
  }
  if (!number) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Informe o number (telefone) do contato.',
    })
  }

  const labelids = (input.labelids ?? [])
    .map((id) => String(id ?? '').trim())
    .filter(Boolean)

  try {
    const res = await $fetch<{ response?: string }>(urlChatLabelsUazapi(servidor), {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        token,
      },
      body: {
        number,
        labelids,
      },
    })
    return {
      response: typeof res?.response === 'string' && res.response.trim() ? res.response.trim() : 'ok',
    }
  } catch (err: unknown) {
    throw createError({
      statusCode: 502,
      statusMessage: mensagemErroUazapiLabels(
        err,
        'Falha ao atualizar etiquetas da conversa no WhatsApp.',
      ),
    })
  }
}
