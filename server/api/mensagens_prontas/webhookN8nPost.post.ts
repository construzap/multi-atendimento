import { serverSupabaseClient } from '#supabase/server'
import { assertMethod, createError, readBody } from 'h3'
import type {
  MensagemProntaComPassos,
  MensagemProntaSequenciaResumo,
  WebhookN8nMensagemProntaResponse,
} from '#shared/types/mensagensProntas'
import { resolverMensagemProntaParaEnvio } from '#shared/utils/mensagemProntaVariaveis'
import { coercePassosInput, filtrarPassosValidosParaEnvio } from '#shared/utils/mensagensProntasPassosEnvio'
import { checkWorkspace } from '../../utils/checkWorkspace'
import { getAuthUserId } from '../../utils/getAuthUserId'

const WEBHOOK_MENSAGEM_PRONTA_N8N =
  'https://nwebhook.construzap.com/webhook/muster-septum-cuddly0-magnesium'

type Body = {
  workspace_id?: unknown
  canal_id?: unknown
  conversa_key?: unknown
  phone?: unknown
  name?: unknown
  mensagem_pronta?: unknown
  coluna_destino_id?: unknown
  mover_contato?: unknown
  ia_ligada?: unknown
  fechar_pedido_em_aberto?: unknown
}

function parsePositiveInt(raw: unknown, label: string): number {
  const n =
    typeof raw === 'number' && Number.isInteger(raw)
      ? raw
      : Number.parseInt(String(raw ?? '').trim(), 10)
  if (!Number.isFinite(n) || !Number.isInteger(n) || n < 1) {
    throw createError({ statusCode: 400, statusMessage: `${label} inválido.` })
  }
  return n
}

function parseConversaKey(raw: unknown): string {
  const key = String(raw ?? '').trim()
  if (!key) {
    throw createError({ statusCode: 400, statusMessage: 'Informe conversa_key.' })
  }
  return key
}

function nullableStr(raw: unknown): string | null {
  if (raw == null) return null
  const s = String(raw).trim()
  return s.length > 0 ? s : null
}

function parseMensagemPronta(raw: unknown): MensagemProntaComPassos {
  if (!raw || typeof raw !== 'object') {
    throw createError({ statusCode: 400, statusMessage: 'Informe mensagem_pronta.' })
  }
  const o = raw as Record<string, unknown>
  const seqRaw = o.sequencia
  if (!seqRaw || typeof seqRaw !== 'object') {
    throw createError({ statusCode: 400, statusMessage: 'mensagem_pronta.sequencia inválida.' })
  }
  const s = seqRaw as Record<string, unknown>
  const sequenciaId = String(s.id ?? '').trim()
  const nome = String(s.nome ?? '').trim()
  if (!sequenciaId || !nome) {
    throw createError({
      statusCode: 400,
      statusMessage: 'mensagem_pronta.sequencia precisa de id e nome.',
    })
  }

  const sequencia: MensagemProntaSequenciaResumo = {
    id: sequenciaId,
    nome,
    workspace_id: parsePositiveInt(s.workspace_id, 'mensagem_pronta.sequencia.workspace_id'),
    user_id: String(s.user_id ?? '').trim(),
    created_at: String(s.created_at ?? new Date().toISOString()),
    coluna_destino_id:
      s.coluna_destino_id == null || String(s.coluna_destino_id).trim() === ''
        ? null
        : parsePositiveInt(s.coluna_destino_id, 'mensagem_pronta.sequencia.coluna_destino_id'),
    ia_ligada: !(s.ia_ligada === false || s.ia_ligada === 'false' || s.ia_ligada === 0 || s.ia_ligada === '0'),
    fechar_pedido_em_aberto:
      s.fechar_pedido_em_aberto === true ||
      s.fechar_pedido_em_aberto === 'true' ||
      s.fechar_pedido_em_aberto === 1 ||
      s.fechar_pedido_em_aberto === '1',
  }

  if (!Array.isArray(o.passos) && coercePassosInput(o.passos).length === 0) {
    throw createError({
      statusCode: 400,
      statusMessage: 'mensagem_pronta.passos deve ter ao menos um passo.',
    })
  }

  const passos = filtrarPassosValidosParaEnvio(o.passos, sequenciaId)
  if (passos.length === 0) {
    throw createError({
      statusCode: 400,
      statusMessage: 'mensagem_pronta.passos deve ter ao menos um passo válido.',
    })
  }

  return { sequencia, passos }
}

/**
 * POST /api/mensagens_prontas/webhookN8nPost
 *
 * Encaminha workspace, canal, conversa (phone/name) e a mensagem pronta
 * com passos para o workflow N8N.
 */
export default defineEventHandler(async (event): Promise<WebhookN8nMensagemProntaResponse> => {
  assertMethod(event, 'POST')

  const client = await serverSupabaseClient(event)
  const { data: authData, error: authError } = await client.auth.getUser()
  if (authError || !authData.user) {
    throw createError({ statusCode: 401, statusMessage: 'Não autenticado' })
  }

  const userId = getAuthUserId(authData.user)
  if (!userId) {
    throw createError({ statusCode: 401, statusMessage: 'Não autenticado' })
  }

  const body = (await readBody<Body>(event).catch(() => null)) ?? {}
  const workspace_id = parsePositiveInt(body.workspace_id, 'workspace_id')
  const canal_id = parsePositiveInt(body.canal_id, 'canal_id')
  const conversa_key = parseConversaKey(body.conversa_key)
  const phone = nullableStr(body.phone)
  const name = nullableStr(body.name)
  const mensagem_pronta_raw = parseMensagemPronta(body.mensagem_pronta)
  /** Garante `{primeiro-nome}` / `{saudacao}` resolvidos mesmo se o client mandar o template cru. */
  const mensagem_pronta = resolverMensagemProntaParaEnvio(mensagem_pronta_raw, name)

  // Preferência: top-level do body → sequencia; null = não movimentar.
  let coluna_destino_id: number | null = null
  if (body.coluna_destino_id != null && String(body.coluna_destino_id).trim() !== '') {
    coluna_destino_id = parsePositiveInt(body.coluna_destino_id, 'coluna_destino_id')
  } else if (mensagem_pronta.sequencia.coluna_destino_id != null) {
    coluna_destino_id = mensagem_pronta.sequencia.coluna_destino_id
  }
  mensagem_pronta.sequencia.coluna_destino_id = coluna_destino_id
  const mover_contato = coluna_destino_id != null

  // Preferência: top-level do body → sequencia; default true.
  let ia_ligada = mensagem_pronta.sequencia.ia_ligada
  if (body.ia_ligada !== undefined && body.ia_ligada !== null && String(body.ia_ligada).trim() !== '') {
    ia_ligada = !(
      body.ia_ligada === false ||
      body.ia_ligada === 'false' ||
      body.ia_ligada === 0 ||
      body.ia_ligada === '0'
    )
  }
  mensagem_pronta.sequencia.ia_ligada = ia_ligada

  // Preferência: top-level do body → sequencia; default false.
  let fechar_pedido_em_aberto = mensagem_pronta.sequencia.fechar_pedido_em_aberto === true
  if (
    body.fechar_pedido_em_aberto !== undefined &&
    body.fechar_pedido_em_aberto !== null &&
    String(body.fechar_pedido_em_aberto).trim() !== ''
  ) {
    fechar_pedido_em_aberto =
      body.fechar_pedido_em_aberto === true ||
      body.fechar_pedido_em_aberto === 'true' ||
      body.fechar_pedido_em_aberto === 1 ||
      body.fechar_pedido_em_aberto === '1'
  }
  mensagem_pronta.sequencia.fechar_pedido_em_aberto = fechar_pedido_em_aberto

  await checkWorkspace(event, workspace_id, userId)

  const payload = JSON.parse(
    JSON.stringify({
      workspace_id,
      canal_id,
      conversa_key,
      phone,
      name,
      mensagem_pronta,
      coluna_destino_id,
      mover_contato,
      ia_ligada,
      fechar_pedido_em_aberto,
    }),
  )

  let res: Response
  try {
    res = await fetch(WEBHOOK_MENSAGEM_PRONTA_N8N, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
  } catch {
    throw createError({
      statusCode: 502,
      statusMessage: 'Não foi possível contactar o webhook N8N.',
    })
  }

  if (!res.ok) {
    throw createError({
      statusCode: 502,
      statusMessage: 'O webhook N8N retornou erro.',
    })
  }

  return { ok: true as const }
})
