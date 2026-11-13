import { assertMethod, createError, readBody } from 'h3'
import { normalizarLabelId } from '#shared/utils/validarCanalCamposExtras'
import {
  atualizarEtiquetasConversaWhatsapp,
  credenciaisCanalWhatsappLabels,
  parseCanalIdBody,
} from '../../../utils/canalWhatsappLabels'

type Body = {
  id_canal?: unknown
  number?: unknown
  labelids?: unknown
}

export type AtualizaEtiquetasConversaWhatsappResponse = {
  ok: true
  response: string
}

/**
 * POST /api/canais/listas_do_whatsapp/atualizaetiquetasdaconversanowhatsapp
 *
 * Aplica etiquetas no chat via Uazapi (`POST {servidor}/chat/labels`).
 * Body: `{ id_canal, number, labelids: string[] }`
 * - Cliente (atendimento): `labelids: [id_da_lista_de_atendimento_do_whatsapp]`
 * - Vendedor: `labelids: []` (limpa)
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

    let labelids: string[] = []
    if (Array.isArray(body.labelids)) {
      labelids = body.labelids
        .map((id) => normalizarLabelId(id) ?? '')
        .filter(Boolean)
    } else if (body.labelids != null && body.labelids !== '') {
      const one = normalizarLabelId(body.labelids)
      if (one) labelids = [one]
    }

    const { token, servidor } = await credenciaisCanalWhatsappLabels(event, canalId)
    const res = await atualizarEtiquetasConversaWhatsapp({
      servidor,
      token,
      number,
      labelids,
    })

    return { ok: true, response: res.response }
  },
)
