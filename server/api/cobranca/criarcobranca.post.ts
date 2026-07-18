import { serverSupabaseClient, serverSupabaseServiceRole } from '#supabase/server'
import { assertMethod, createError, readBody } from 'h3'
import type {
  Cobranca,
  CobrancaProduto,
  CobrancaProdutoInput,
  CriarCobrancaBody,
  CriarCobrancaResponse,
  FrequenciaCobranca,
  FrequenciaRecorrencia,
  TipoCobranca,
} from '#shared/types/cobranca'
import { isIanaFusoBrasilPermitido } from '#shared/constants/ianaTimezonesBrasil'
import { parseDataHoraLocalBrasilParaUtcIso } from '#shared/utils/agendamentoDataUtc'
import { checkWorkspace } from '../../utils/checkWorkspace'
import { getAuthUserId } from '../../utils/getAuthUserId'

function parsePositiveInt(raw: unknown, label: string): number {
  const s = String(raw ?? '').trim()
  if (!s) {
    throw createError({ statusCode: 400, statusMessage: `${label} é obrigatório.` })
  }
  const n = Number.parseInt(s, 10)
  if (!Number.isFinite(n) || !Number.isInteger(n) || n < 1) {
    throw createError({ statusCode: 400, statusMessage: `${label} inválido.` })
  }
  return n
}

function parseMoney(raw: unknown, label: string): number {
  if (typeof raw === 'number' && Number.isFinite(raw) && raw >= 0) {
    return Math.round(raw * 100) / 100
  }
  if (typeof raw === 'string') {
    const n = Number.parseFloat(raw.replace(/\./g, '').replace(',', '.'))
    if (Number.isFinite(n) && n >= 0) return Math.round(n * 100) / 100
  }
  throw createError({ statusCode: 400, statusMessage: `${label} inválido.` })
}

function parsePercent(raw: unknown, label: string, fallback = 0): number {
  if (raw === undefined || raw === null || raw === '') return fallback
  if (typeof raw === 'number' && Number.isFinite(raw) && raw >= 0) {
    return Math.round(raw * 100) / 100
  }
  if (typeof raw === 'string') {
    const n = Number.parseFloat(raw.replace(',', '.'))
    if (Number.isFinite(n) && n >= 0) return Math.round(n * 100) / 100
  }
  throw createError({ statusCode: 400, statusMessage: `${label} inválido.` })
}

function parseTipoCobranca(raw: unknown): TipoCobranca {
  const s = String(raw ?? '').trim().toLowerCase()
  if (s === 'fiado' || s === 'unico') return 'unico'
  if (s === 'parcelado' || s === 'assinatura') return s
  throw createError({
    statusCode: 400,
    statusMessage: 'tipo_cobranca inválido (use unico, parcelado ou assinatura).',
  })
}

function parseFrequencia(raw: unknown): FrequenciaRecorrencia | null {
  if (raw === undefined || raw === null || raw === '') return null
  const s = String(raw).trim().toLowerCase()
  if (s === 'mensal' || s === 'semanal') return s
  throw createError({
    statusCode: 400,
    statusMessage: 'frequencia_recorrencia inválida (use mensal ou semanal).',
  })
}

function parseFrequenciaCobranca(raw: unknown): FrequenciaCobranca | null {
  if (raw === undefined || raw === null || raw === '') return null
  const s = String(raw).trim().toLowerCase()
  if (s === 'diaria' || s === 'semanal' || s === 'mensal' || s === 'anual') return s
  throw createError({
    statusCode: 400,
    statusMessage: 'frequencia_cobranca inválida (use diaria, semanal, mensal ou anual).',
  })
}

function parseDateYmd(raw: unknown, label: string, required: boolean): string | null {
  if (raw === undefined || raw === null || raw === '') {
    if (required) {
      throw createError({ statusCode: 400, statusMessage: `${label} é obrigatório.` })
    }
    return null
  }
  const s = String(raw).trim()
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    throw createError({ statusCode: 400, statusMessage: `${label} inválido (use AAAA-MM-DD).` })
  }
  return s
}

function parseHoraLocal(raw: unknown, label: string): string {
  const s = String(raw ?? '').trim()
  if (!/^\d{1,2}:\d{2}$/.test(s)) {
    throw createError({ statusCode: 400, statusMessage: `${label} inválida (use HH:mm).` })
  }
  return s
}

function parseIanaTimezone(raw: unknown): string {
  const s = String(raw ?? '').trim()
  if (!s) {
    throw createError({ statusCode: 400, statusMessage: 'iana_timezone é obrigatório.' })
  }
  if (!isIanaFusoBrasilPermitido(s)) {
    throw createError({
      statusCode: 400,
      statusMessage: 'iana_timezone não é um fuso do Brasil permitido.',
    })
  }
  return s
}

function parseDiaVencimento(raw: unknown): number {
  const n = typeof raw === 'number' ? raw : Number.parseInt(String(raw ?? ''), 10)
  if (!Number.isFinite(n) || !Number.isInteger(n) || n < 1 || n > 31) {
    throw createError({
      statusCode: 400,
      statusMessage: 'dia_vencimento inválido (use inteiro de 1 a 31).',
    })
  }
  return n
}

function parseProdutos(raw: unknown): CobrancaProdutoInput[] {
  if (!Array.isArray(raw) || raw.length === 0) {
    throw createError({ statusCode: 400, statusMessage: 'Informe ao menos um produto.' })
  }

  return raw.map((item, index) => {
    const row = (item && typeof item === 'object' ? item : {}) as Record<string, unknown>
    const nome = String(row.produto_nome ?? row.nome ?? '').trim()
    if (!nome) {
      throw createError({
        statusCode: 400,
        statusMessage: `Produto #${index + 1}: nome é obrigatório.`,
      })
    }
    const quantidadeRaw =
      typeof row.quantidade === 'number'
        ? row.quantidade
        : Number.parseInt(String(row.quantidade ?? ''), 10)
    if (!Number.isFinite(quantidadeRaw) || !Number.isInteger(quantidadeRaw) || quantidadeRaw < 1) {
      throw createError({
        statusCode: 400,
        statusMessage: `Produto #${index + 1}: quantidade inválida.`,
      })
    }
    const precoUnitario = parseMoney(row.preco_unitario ?? row.precoUnitario, `Produto #${index + 1}: preço`)
    return {
      produto_nome: nome,
      quantidade: quantidadeRaw,
      preco_unitario: precoUnitario,
    }
  })
}

function toNumber(raw: unknown, fallback = 0): number {
  if (typeof raw === 'number' && Number.isFinite(raw)) return raw
  const n = Number.parseFloat(String(raw ?? ''))
  return Number.isFinite(n) ? n : fallback
}

function mapCobranca(row: Record<string, unknown>): Cobranca {
  return {
    id: toNumber(row.id),
    workspace_id: toNumber(row.workspace_id),
    canal_id: toNumber(row.canal_id),
    conversa_key: String(row.conversa_key ?? ''),
    phone: String(row.phone ?? ''),
    name: row.name == null || String(row.name).trim() === '' ? null : String(row.name).trim(),
    tipo_cobranca: String(row.tipo_cobranca ?? 'unico') as TipoCobranca,
    valor_total: toNumber(row.valor_total),
    status_contrato: (String(row.status_contrato ?? 'ativo') as Cobranca['status_contrato']),
    total_parcelas: row.total_parcelas == null ? null : toNumber(row.total_parcelas),
    frequencia_recorrencia:
      row.frequencia_recorrencia == null
        ? null
        : (String(row.frequencia_recorrencia) as FrequenciaRecorrencia),
    frequencia_cobranca:
      row.frequencia_cobranca == null
        ? null
        : (String(row.frequencia_cobranca) as FrequenciaCobranca),
    data_proxima_notificacao:
      row.data_proxima_notificacao == null
        ? null
        : String(row.data_proxima_notificacao),
    iana_timezone:
      row.iana_timezone == null || String(row.iana_timezone).trim() === ''
        ? null
        : String(row.iana_timezone).trim(),
    dia_vencimento: toNumber(row.dia_vencimento),
    data_inicio: String(row.data_inicio ?? ''),
    data_fim: row.data_fim == null ? null : String(row.data_fim),
    porcentagem_multa: row.porcentagem_multa == null ? null : toNumber(row.porcentagem_multa),
    porcentagem_juros_mes:
      row.porcentagem_juros_mes == null ? null : toNumber(row.porcentagem_juros_mes),
    template_mensagem: String(row.template_mensagem ?? ''),
    template_mensagem_vencida: String(row.template_mensagem_vencida ?? ''),
    data_vencimento:
      row.data_vencimento == null ? null : String(row.data_vencimento),
    created_at: String(row.created_at ?? ''),
    updated_at: row.updated_at == null ? null : String(row.updated_at),
  }
}

function mapProduto(row: Record<string, unknown>): CobrancaProduto {
  return {
    id: toNumber(row.id),
    cobranca_id: toNumber(row.cobranca_id),
    produto_nome: String(row.produto_nome ?? ''),
    quantidade: toNumber(row.quantidade, 1),
    preco_unitario: toNumber(row.preco_unitario),
    preco_total: toNumber(row.preco_total),
  }
}

/**
 * POST /api/cobranca/criarcobranca
 *
 * Insere em `cobranca` + `cobranca_produtos` após `checkWorkspace`.
 */
export default defineEventHandler(async (event): Promise<CriarCobrancaResponse> => {
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

  const body = (await readBody<Partial<CriarCobrancaBody>>(event).catch(() => null)) ?? {}

  const workspaceId = parsePositiveInt(body.workspace_id, 'workspace_id')
  await checkWorkspace(event, workspaceId, userId)

  const canalId = parsePositiveInt(body.canal_id, 'canal_id')
  const conversaKey = String(body.conversa_key ?? '').trim()
  if (!conversaKey) {
    throw createError({ statusCode: 400, statusMessage: 'conversa_key é obrigatório.' })
  }

  const phone = String(body.phone ?? '').trim()
  if (!phone) {
    throw createError({ statusCode: 400, statusMessage: 'phone é obrigatório.' })
  }

  const nameRaw = String(body.name ?? '').trim()
  const name = nameRaw || null

  const tipoCobranca = parseTipoCobranca(body.tipo_cobranca)
  const produtos = parseProdutos(body.produtos)
  const valorTotalInformado = parseMoney(body.valor_total, 'valor_total')
  const valorTotalCalculado =
    Math.round(
      produtos.reduce((acc, p) => acc + p.quantidade * p.preco_unitario, 0) * 100,
    ) / 100
  const valorTotal = valorTotalInformado > 0 ? valorTotalInformado : valorTotalCalculado
  if (valorTotal <= 0) {
    throw createError({ statusCode: 400, statusMessage: 'valor_total deve ser maior que zero.' })
  }

  const dataProximaLocal = parseDateYmd(body.data_proxima_local, 'data_proxima_local', true)!
  const horaProximaLocal = parseHoraLocal(body.hora_proxima_local, 'hora_proxima_local')
  const ianaTimezone = parseIanaTimezone(body.iana_timezone)
  const dataProximaNotificacao = parseDataHoraLocalBrasilParaUtcIso(
    dataProximaLocal,
    horaProximaLocal,
    ianaTimezone,
  )
  if (!dataProximaNotificacao) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Combinação inválida de data_proxima_local, hora_proxima_local e iana_timezone.',
    })
  }
  // Mantém colunas legado NOT NULL alinhadas à data local.
  const dataInicio = dataProximaLocal
  const diaVencimento = Number.parseInt(dataProximaLocal.slice(8, 10), 10)
  const dataFim = parseDateYmd(body.data_fim, 'data_fim', false)
  const templateMensagem = String(body.template_mensagem ?? '').trim()
  if (!templateMensagem) {
    throw createError({ statusCode: 400, statusMessage: 'template_mensagem é obrigatório.' })
  }
  const templateMensagemVencida = String(body.template_mensagem_vencida ?? '').trim()
  if (!templateMensagemVencida) {
    throw createError({ statusCode: 400, statusMessage: 'template_mensagem_vencida é obrigatório.' })
  }

  const porcentagemMulta = parsePercent(body.porcentagem_multa, 'porcentagem_multa', 0)
  const porcentagemJurosMes = parsePercent(
    body.porcentagem_juros_mes,
    'porcentagem_juros_mes',
    0,
  )

  let totalParcelas: number | null = 1
  let frequenciaRecorrencia: FrequenciaRecorrencia | null = null
  let frequenciaCobranca: FrequenciaCobranca | null = null

  if (tipoCobranca === 'parcelado') {
    totalParcelas = parsePositiveInt(body.total_parcelas, 'total_parcelas')
    if (totalParcelas < 2) {
      throw createError({
        statusCode: 400,
        statusMessage: 'total_parcelas deve ser pelo menos 2 para cobrança parcelada.',
      })
    }
  } else if (tipoCobranca === 'assinatura') {
    totalParcelas = null
    frequenciaRecorrencia = parseFrequencia(body.frequencia_recorrencia)
    if (!frequenciaRecorrencia) {
      throw createError({
        statusCode: 400,
        statusMessage: 'frequencia_recorrencia é obrigatória para assinatura.',
      })
    }
  } else {
    totalParcelas = 1
    frequenciaRecorrencia = null
    frequenciaCobranca = parseFrequenciaCobranca(body.frequencia_cobranca)
    if (!frequenciaCobranca) {
      throw createError({
        statusCode: 400,
        statusMessage: 'frequencia_cobranca é obrigatória para fiado (diaria, semanal, mensal ou anual).',
      })
    }
  }

  const admin = serverSupabaseServiceRole<any>(event)

  const { data: cobrancaRow, error: cobrancaError } = await admin
    .from('cobranca')
    .insert({
      workspace_id: workspaceId,
      canal_id: canalId,
      conversa_key: conversaKey,
      phone,
      name,
      tipo_cobranca: tipoCobranca,
      valor_total: valorTotal,
      status_contrato: 'ativo',
      total_parcelas: totalParcelas,
      frequencia_recorrencia: frequenciaRecorrencia,
      frequencia_cobranca: frequenciaCobranca,
      data_proxima_notificacao: dataProximaNotificacao,
      data_vencimento: dataProximaNotificacao,
      iana_timezone: ianaTimezone,
      dia_vencimento: diaVencimento,
      data_inicio: dataInicio,
      data_fim: dataFim,
      porcentagem_multa: porcentagemMulta,
      porcentagem_juros_mes: porcentagemJurosMes,
      template_mensagem: templateMensagem,
      template_mensagem_vencida: templateMensagemVencida,
    })
    .select(
      'id, workspace_id, canal_id, conversa_key, phone, name, tipo_cobranca, valor_total, status_contrato, total_parcelas, frequencia_recorrencia, frequencia_cobranca, data_proxima_notificacao, iana_timezone, data_vencimento, dia_vencimento, data_inicio, data_fim, porcentagem_multa, porcentagem_juros_mes, template_mensagem, template_mensagem_vencida, created_at, updated_at',
    )
    .maybeSingle()

  if (cobrancaError) {
    throw createError({ statusCode: 500, statusMessage: cobrancaError.message })
  }
  if (!cobrancaRow) {
    throw createError({ statusCode: 500, statusMessage: 'Não foi possível criar a cobrança.' })
  }

  const cobrancaId = toNumber((cobrancaRow as Record<string, unknown>).id)
  const produtosInsert = produtos.map((p) => ({
    cobranca_id: cobrancaId,
    produto_nome: p.produto_nome,
    quantidade: p.quantidade,
    preco_unitario: p.preco_unitario,
    preco_total: Math.round(p.quantidade * p.preco_unitario * 100) / 100,
  }))

  const { data: produtosRows, error: produtosError } = await admin
    .from('cobranca_produtos')
    .insert(produtosInsert)
    .select('id, cobranca_id, produto_nome, quantidade, preco_unitario, preco_total')

  if (produtosError) {
    await admin.from('cobranca').delete().eq('id', cobrancaId)
    throw createError({ statusCode: 500, statusMessage: produtosError.message })
  }

  return {
    cobranca: {
      ...mapCobranca(cobrancaRow as Record<string, unknown>),
      produtos: ((produtosRows ?? []) as Record<string, unknown>[]).map(mapProduto),
    },
    produtos: ((produtosRows ?? []) as Record<string, unknown>[]).map(mapProduto),
  }
})
