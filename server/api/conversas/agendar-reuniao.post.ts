import { assertMethod, createError, readBody } from 'h3'
import { assertAdminWorkspaceAtivo, requireAdminUser } from '../../utils/adminPrompt'

const WEBHOOK_AGENDAR_REUNIAO =
  'https://nwebhook.construzap.com/webhook/agendar_reuniao_notion_ghostinguer02'

const DATA_AGENDADA_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.000-03:00$/
const DATA_FORMATADA_RE = /^\d{2}\/\d{2}\/\d{4} às \d{2}:\d{2} horas$/

type Body = {
  workspace_id?: unknown
  canal_id?: unknown
  key?: unknown
  phone?: unknown
  email?: unknown
  nome?: unknown
  data_agendada?: unknown
  data_formatada?: unknown
  duracao_minutos?: unknown
}

function texto(raw: unknown): string {
  return typeof raw === 'string' ? raw.trim() : ''
}

/** POST /api/conversas/agendar-reuniao — admin envia o agendamento ao Notion via webhook. */
export default defineEventHandler(async (event) => {
  assertMethod(event, 'POST')
  await requireAdminUser(event)

  const body = (await readBody<Body>(event).catch(() => null)) ?? {}
  const workspaceId = parseWorkspaceId(body.workspace_id)
  await assertAdminWorkspaceAtivo(event, workspaceId)

  const canalId = parseInteiroPositivo(body.canal_id, 'canal_id')
  const key = texto(body.key)
  const phone = texto(body.phone)
  const nome = texto(body.nome)
  const dataAgendada = texto(body.data_agendada)
  const dataFormatada = texto(body.data_formatada)
  const email = texto(body.email)
  const duracao = Number(body.duracao_minutos)

  if (!key) {
    throw createError({ statusCode: 400, statusMessage: 'Informe a key da conversa.' })
  }
  if (!phone) {
    throw createError({ statusCode: 400, statusMessage: 'A conversa não tem telefone.' })
  }
  if (!DATA_AGENDADA_RE.test(dataAgendada)) {
    throw createError({ statusCode: 400, statusMessage: 'Data agendada inválida.' })
  }
  if (!DATA_FORMATADA_RE.test(dataFormatada)) {
    throw createError({ statusCode: 400, statusMessage: 'Data formatada inválida.' })
  }
  if (!Number.isInteger(duracao) || duracao < 1 || duracao > 480) {
    throw createError({ statusCode: 400, statusMessage: 'Duração da reunião inválida.' })
  }

  const payload = {
    workspace_id: workspaceId,
    canal_id: canalId,
    key,
    phone,
    email: email || null,
    nome,
    data_agendada: dataAgendada,
    data_termino: dataTerminoIso(dataAgendada, duracao),
    data_formatada: dataFormatada,
    duracao_minutos: duracao,
    url: urlSiteAplicativo(),
  }

  let res: Response
  try {
    res = await fetch(WEBHOOK_AGENDAR_REUNIAO, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
  } catch {
    throw createError({
      statusCode: 502,
      statusMessage: 'Não foi possível contactar o serviço de agendamento.',
    })
  }

  if (!res.ok) {
    throw createError({
      statusCode: 502,
      statusMessage: 'O serviço de agendamento retornou erro.',
    })
  }

  return { ok: true as const }
})

/** Origem pública do app (`URL_MULTIATENDIMENTO_CONSTRUZAP`), sem caminho. */
function urlSiteAplicativo(): string {
  const config = useRuntimeConfig()
  const raw = String(config.urlMultiatendimentoConstruzap ?? '').trim()
  if (!raw) {
    throw createError({
      statusCode: 500,
      statusMessage: 'URL_MULTIATENDIMENTO_CONSTRUZAP não configurada no servidor.',
    })
  }
  try {
    return new URL(raw).origin
  } catch {
    throw createError({ statusCode: 500, statusMessage: 'URL do aplicativo inválida.' })
  }
}

function parseWorkspaceId(raw: unknown): number {
  return parseInteiroPositivo(raw, 'workspace_id')
}

function parseInteiroPositivo(raw: unknown, label: string): number {
  const n =
    typeof raw === 'number' && Number.isInteger(raw)
      ? raw
      : Number.parseInt(String(raw ?? '').trim(), 10)
  if (!Number.isFinite(n) || !Number.isInteger(n) || n < 1) {
    throw createError({ statusCode: 400, statusMessage: `${label} inválido.` })
  }
  return n
}

/** Soma a duração e devolve no mesmo fuso de `data_agendada` (`-03:00`). */
function dataTerminoIso(dataAgendada: string, duracaoMinutos: number): string {
  const inicio = new Date(dataAgendada)
  if (Number.isNaN(inicio.getTime())) {
    throw createError({ statusCode: 400, statusMessage: 'Data agendada inválida.' })
  }
  const fim = new Date(inicio.getTime() + duracaoMinutos * 60_000)
  const partes = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(fim)
  const ler = (tipo: Intl.DateTimeFormatPartTypes) =>
    partes.find((parte) => parte.type === tipo)?.value ?? '00'
  return `${ler('year')}-${ler('month')}-${ler('day')}T${ler('hour')}:${ler('minute')}:${ler('second')}.000-03:00`
}
