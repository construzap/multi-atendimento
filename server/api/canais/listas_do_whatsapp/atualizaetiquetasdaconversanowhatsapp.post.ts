import { assertMethod, createError, readBody } from 'h3'
import { serverSupabaseServiceRole } from '#supabase/server'
import { normalizarLabelId } from '#shared/utils/validarCanalCamposExtras'
import {
  credenciaisCanalWhatsappLabels,
  normalizarListaLabelIds,
  parseCanalIdBody,
  parseEtiquetasWhatsappCampo,
  sincronizarEtiquetasConversaWhatsapp,
} from '../../../utils/canalWhatsappLabels'

type Body = {
  id_canal?: unknown
  number?: unknown
  /** Conjunto desejado de labelids (vazio = só remove as conhecidas). */
  labelids?: unknown
  /** Preferencial: key da conversa para ler/gravar `etiquetas_whatsapp`. */
  conversa_key?: unknown
}

export type AtualizaEtiquetasConversaWhatsappResponse = {
  ok: true
  response: string
  etiquetas_whatsapp: string[]
}

/**
 * POST /api/canais/listas_do_whatsapp/atualizaetiquetasdaconversanowhatsapp
 *
 * Sincroniza etiquetas do chat via Uazapi (`remove_labelid` + `add_labelid`).
 * Body: `{ id_canal, number, labelids?: string[], conversa_key? }`
 * - `labelids` = conjunto desejado (ex.: lista de atendimento); `[]` só limpa.
 * - Espelho local em `conversas.etiquetas_whatsapp`.
 */
export default defineEventHandler(
  async (event): Promise<AtualizaEtiquetasConversaWhatsappResponse> => {
    assertMethod(event, 'POST')
    const body = (await readBody<Body>(event).catch(() => null)) ?? {}
    const canalId = parseCanalIdBody(body.id_canal)

    const number = typeof body.number === 'string' ? body.number.trim() : String(body.number ?? '').trim()
    if (!number) {
      throw createError({ statusCode: 400, statusMessage: 'Informe number (telefone do contato).' })
    }

    let desejadas: string[] = []
    if (Array.isArray(body.labelids)) {
      desejadas = body.labelids
        .map((id) => normalizarLabelId(id) ?? '')
        .filter(Boolean)
    } else if (body.labelids != null && body.labelids !== '') {
      const one = normalizarLabelId(body.labelids)
      if (one) desejadas = [one]
    }
    desejadas = normalizarListaLabelIds(desejadas)

    const conversaKeyRaw =
      typeof body.conversa_key === 'string' ? body.conversa_key.trim() : String(body.conversa_key ?? '').trim()

    const admin = serverSupabaseServiceRole<any>(event)

    let conversa_key = conversaKeyRaw
    if (!conversa_key) {
      const digits = number.includes('@')
        ? number.split('@')[0]!.replace(/\D/g, '')
        : number.replace(/\D/g, '')

      const tryFind = async (column: 'phone' | 'lid', value: string) => {
        const { data, error } = await admin
          .from('conversas')
          .select('key')
          .eq('id_canal', canalId)
          .is('deleted_at', null)
          .eq(column, value)
          .limit(1)
        if (error) throw createError({ statusCode: 500, statusMessage: error.message })
        const row = Array.isArray(data) && data[0] && typeof data[0] === 'object' ? data[0] : null
        const key = row && typeof (row as { key?: unknown }).key === 'string'
          ? String((row as { key: string }).key).trim()
          : ''
        return key || null
      }

      conversa_key =
        (await tryFind('phone', number)) ||
        (digits ? await tryFind('phone', digits) : null) ||
        (await tryFind('lid', number)) ||
        (digits ? await tryFind('lid', `${digits}@lid`) : null) ||
        ''
    }

    if (!conversa_key) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Informe conversa_key (ou number de uma conversa existente no canal).',
      })
    }

    const { data: convRow, error: convErr } = await admin
      .from('conversas')
      .select('key, etiquetas_whatsapp, id_canal')
      .eq('key', conversa_key)
      .is('deleted_at', null)
      .maybeSingle()

    if (convErr) throw createError({ statusCode: 500, statusMessage: convErr.message })
    if (!convRow) {
      throw createError({ statusCode: 404, statusMessage: 'Conversa não encontrada.' })
    }
    if (Number((convRow as { id_canal?: unknown }).id_canal) !== Number(canalId)) {
      throw createError({ statusCode: 403, statusMessage: 'Conversa não pertence a este canal.' })
    }

    const atuais = parseEtiquetasWhatsappCampo(
      (convRow as { etiquetas_whatsapp?: unknown }).etiquetas_whatsapp,
    )

    const { token, servidor } = await credenciaisCanalWhatsappLabels(event, canalId)
    const sync = await sincronizarEtiquetasConversaWhatsapp({
      servidor,
      token,
      number,
      atuais,
      desejadas,
    })

    if (sync.precisaPersistir) {
      const { error: updErr } = await admin
        .from('conversas')
        .update({ etiquetas_whatsapp: sync.finais })
        .eq('key', conversa_key)

      if (updErr) throw createError({ statusCode: 500, statusMessage: updErr.message })
    }

    return {
      ok: true,
      response: sync.response,
      etiquetas_whatsapp: sync.finais,
    }
  },
)
