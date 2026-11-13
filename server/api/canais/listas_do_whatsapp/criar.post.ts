import { assertMethod, readBody } from 'h3'
import type { WhatsappLabelMutateResponse } from '#shared/types/canal'
import {
  credenciaisCanalWhatsappLabels,
  parseCanalIdBody,
  parseCorLabel,
  parseNomeLabel,
  postLabelUazapi,
} from '../../../utils/canalWhatsappLabels'

type Body = {
  id_canal?: unknown
  name?: unknown
  color?: unknown
}

/**
 * POST /api/canais/listas_do_whatsapp/criar
 * Cria etiqueta na Uazapi (`labelid: "new"`, `delete: false`).
 * Body: `{ id_canal, name, color }`
 */
export default defineEventHandler(async (event): Promise<WhatsappLabelMutateResponse> => {
  assertMethod(event, 'POST')
  const body = (await readBody<Body>(event).catch(() => null)) ?? {}
  const canalId = parseCanalIdBody(body.id_canal)
  const name = parseNomeLabel(body.name)
  const color = parseCorLabel(body.color)

  const { token, servidor } = await credenciaisCanalWhatsappLabels(event, canalId)
  const res = await postLabelUazapi(servidor, token, {
    labelid: 'new',
    name,
    color,
    delete: false,
  })

  return { ok: true, response: res.response }
})
