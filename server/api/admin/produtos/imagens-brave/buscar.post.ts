import { assertMethod, createError, readBody } from 'h3'
import type {
  AdminBuscarImagensBraveBody,
  AdminBuscarImagensBraveResponse,
} from '#shared/types/admin'
import { requireAdminUser } from '../../../../utils/adminPrompt'
import { buscarImagensBrave } from '../../../../utils/braveImageSearch'

/**
 * POST /api/admin/produtos/imagens-brave/buscar
 * Body: `{ q, num? }`
 * Busca imagens na Brave Image Search (somente ADMIN).
 */
export default defineEventHandler(
  async (event): Promise<AdminBuscarImagensBraveResponse> => {
    assertMethod(event, 'POST')
    await requireAdminUser(event)

    const body = (await readBody<AdminBuscarImagensBraveBody>(event).catch(() => null)) ?? {}
    const q = String(body.q ?? '').trim()
    if (!q) {
      throw createError({ statusCode: 400, statusMessage: 'Informe o termo de busca (q).' })
    }
    if (q.length > 400) {
      throw createError({ statusCode: 400, statusMessage: 'Termo de busca excede 400 caracteres.' })
    }

    const num =
      body.num == null
        ? 8
        : typeof body.num === 'number'
          ? body.num
          : Number.parseInt(String(body.num), 10)

    const items = await buscarImagensBrave({ q, num })

    return { q, items }
  },
)
