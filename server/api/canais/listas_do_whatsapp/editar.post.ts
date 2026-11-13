import { assertMethod, readBody } from 'h3'
import type { WhatsappLabelMutateResponse } from '#shared/types/canal'
import {
  credenciaisCanalWhatsappLabels,
  parseCanalIdBody,
  parseCorLabel,
  parseLabelIdEdit,
  parseNomeLabel,
  postLabelUazapi,
} from '../../../utils/canalWhatsappLabels'

type Body = {
  id_canal?: unknown
  labelid?: unknown
  name?: unknown
  color?: unknown
}

/**
 * POST /api/canais/listas_do_whatsapp/editar
 * Edita etiqueta na Uazapi (`labelid` real, `delete: false`).
 * Body: `{ id_canal, labelid, name, color }`
 */
export default defineEventHandler(async (event): Promise<WhatsappLabelMutateResponse> => {
  assertMethod(event, 'POST')
  const body = (await readBody<Body>(event).catch(() => null)) ?? {}
  const canalId = parseCanalIdBody(body.id_canal)
  const labelid = parseLabelIdEdit(body.labelid)
  const name = parseNomeLabel(body.name)
  const color = parseCorLabel(body.color)

  const { token, servidor } = await credenciaisCanalWhatsappLabels(event, canalId)
  const res = await postLabelUazapi(servidor, token, {
    labelid,
    name,
    color,
    delete: false,
  })

  return { ok: true, response: res.response }
})
