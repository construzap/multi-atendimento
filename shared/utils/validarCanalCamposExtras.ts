import type {
  CanalConfigFollowUp,
  CanalFollowAtivoEmColunas,
  CanalFollowUpPasso,
  CanalFollowUpTipoMidia,
  CanalFormasPagamento,
  CanalFormasPagamentoEntrega,
  CanalFormasPagamentoOnline,
  CanalPalavrasAtivacaoFollowUp,
  CanalRegrasFollowUp,
} from '#shared/types/canal'
import {
  CANAL_FOLLOW_UP_TIPOS_MIDIA,
  CANAL_FORMAS_PAGAMENTO_PADRAO,
  CANAL_REGRAS_FOLLOW_UP_PADRAO,
} from '#shared/types/canal'

const TIPOS_FOLLOW_UP = new Set<string>(CANAL_FOLLOW_UP_TIPOS_MIDIA.map((t) => t.value))

const LOJA_SLUG_RE = /^[a-z0-9]([a-z0-9-]{0,62}[a-z0-9])?$/

function objetoJson(raw: unknown): Record<string, unknown> | null {
  if (raw == null) return null
  if (typeof raw === 'string') {
    const s = raw.trim()
    if (!s) return null
    try {
      const parsed = JSON.parse(s) as unknown
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>
      }
    } catch {
      return null
    }
    return null
  }
  if (typeof raw === 'object' && !Array.isArray(raw)) return raw as Record<string, unknown>
  return null
}

function boolCampo(raw: unknown, fallback: boolean): boolean {
  if (typeof raw === 'boolean') return raw
  if (raw === 'true') return true
  if (raw === 'false') return false
  return fallback
}

function lerGrupoOnline(raw: unknown, padrao: CanalFormasPagamentoOnline): CanalFormasPagamentoOnline {
  const o = raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {}
  return {
    pix: boolCampo(o.pix, padrao.pix),
    boleto: boolCampo(o.boleto, padrao.boleto),
    cartao_debito: boolCampo(o.cartao_debito, padrao.cartao_debito),
    cartao_credito: boolCampo(o.cartao_credito, padrao.cartao_credito),
  }
}

function lerGrupoEntrega(
  raw: unknown,
  padrao: CanalFormasPagamentoEntrega,
): CanalFormasPagamentoEntrega {
  const o = raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {}
  return {
    dinheiro: boolCampo(o.dinheiro, padrao.dinheiro),
    cartao_debito: boolCampo(o.cartao_debito, padrao.cartao_debito),
    vale_refeicao: boolCampo(o.vale_refeicao, padrao.vale_refeicao),
    cartao_credito: boolCampo(o.cartao_credito, padrao.cartao_credito),
  }
}

/** Leitura tolerante (GET). Valor ausente/inválido cai no padrão do banco. */
export function normalizarFormasPagamento(raw: unknown): CanalFormasPagamento {
  const obj = objetoJson(raw)
  if (!obj) return JSON.parse(JSON.stringify(CANAL_FORMAS_PAGAMENTO_PADRAO)) as CanalFormasPagamento
  return {
    online: lerGrupoOnline(obj.online, CANAL_FORMAS_PAGAMENTO_PADRAO.online),
    entrega: lerGrupoEntrega(obj.entrega, CANAL_FORMAS_PAGAMENTO_PADRAO.entrega),
  }
}

export function parseFormasPagamento(raw: unknown): CanalFormasPagamento | string {
  if (raw == null) return JSON.parse(JSON.stringify(CANAL_FORMAS_PAGAMENTO_PADRAO)) as CanalFormasPagamento
  const obj = objetoJson(raw)
  if (!obj) return 'formas_pagamento inválido.'
  return {
    online: lerGrupoOnline(obj.online, CANAL_FORMAS_PAGAMENTO_PADRAO.online),
    entrega: lerGrupoEntrega(obj.entrega, CANAL_FORMAS_PAGAMENTO_PADRAO.entrega),
  }
}

/** Aceita tipos antigos e normaliza áudio → `ptt`. */
function lerTipoFollowUp(raw: unknown): CanalFollowUpTipoMidia | null {
  if (typeof raw !== 'string') return null
  const t = raw.trim()
  if (t === 'audio' || t === 'myaudio') return 'ptt'
  if (t === 'videoplay' || t === 'ptv') return 'video'
  return TIPOS_FOLLOW_UP.has(t) ? (t as CanalFollowUpTipoMidia) : null
}

/**
 * Extrai só o `labelid` (string).
 * Aceita string pura, número, objeto antigo `{ labelid }` / `{ id: "owner:labelid" }`
 * ou JSON stringificado.
 */
export function extrairLabelId(raw: unknown): string | null {
  if (raw === null || raw === undefined || raw === '') return null

  if (typeof raw === 'number' && Number.isFinite(raw)) {
    return String(Math.trunc(raw))
  }

  if (typeof raw === 'string') {
    const s = raw.trim()
    if (!s || s === 'null' || s === '{}' || s === '""') return null
    if (s.startsWith('{') || s.startsWith('[')) {
      try {
        return extrairLabelId(JSON.parse(s) as unknown)
      } catch {
        return null
      }
    }
    // Formato legado "owner:labelid"
    if (s.includes(':')) {
      const parte = s.split(':').pop()?.trim()
      return parte || null
    }
    return s
  }

  if (typeof raw === 'object' && !Array.isArray(raw)) {
    const o = raw as Record<string, unknown>
    const direto = o.labelid ?? o.label_id
    if (typeof direto === 'string' && direto.trim()) return direto.trim()
    if (typeof direto === 'number' && Number.isFinite(direto)) {
      return String(Math.trunc(direto))
    }
    if (typeof o.id === 'string' && o.id.trim()) {
      return extrairLabelId(o.id.trim())
    }
  }

  return null
}

/** Leitura tolerante (GET) — só o labelid. */
export function normalizarLabelId(raw: unknown): string | null {
  return extrairLabelId(raw)
}

type ParseLabelIdResult = string | null | { erro: string }

/**
 * Lista de atendimento: apenas o labelid (string), ou null.
 * Erro → `{ erro }`.
 */
export function parseIdListaAtendimentoWhatsapp(raw: unknown): ParseLabelIdResult {
  if (raw === null || raw === undefined || raw === '') return null
  const labelid = extrairLabelId(raw)
  if (!labelid) return { erro: 'id_da_lista_de_atendimento_do_whatsapp inválido.' }
  return labelid
}

/** Lista finalizado: apenas o labelid (string), ou null. */
export function parseIdListaFinalizadoWhatsapp(raw: unknown): ParseLabelIdResult {
  if (raw === null || raw === undefined || raw === '') return null
  const labelid = extrairLabelId(raw)
  if (!labelid) return { erro: 'id_lista_finalizado_do_whatsapp inválido.' }
  return labelid
}

/** Lista transferência de atendimento: apenas o labelid (string), ou null. */
export function parseIdListaTransferenciaAtendimentoWhatsapp(
  raw: unknown,
): ParseLabelIdResult {
  if (raw === null || raw === undefined || raw === '') return null
  const labelid = extrairLabelId(raw)
  if (!labelid) {
    return { erro: 'id_lista_transferencia_de_atendimento_whatsapp inválido.' }
  }
  return labelid
}

/** Lista pedido pronto: apenas o labelid (string), ou null. */
export function parseIdListaPedidoProntoWhatsapp(raw: unknown): ParseLabelIdResult {
  if (raw === null || raw === undefined || raw === '') return null
  const labelid = extrairLabelId(raw)
  if (!labelid) return { erro: 'id_lista_pedido_pronto_whatsapp inválido.' }
  return labelid
}

export function parseEtiquetaFollowUp(raw: unknown): ParseLabelIdResult {
  if (raw === null || raw === undefined || raw === '') return null
  const labelid = extrairLabelId(raw)
  if (!labelid) return { erro: 'etiqueta do follow-up inválida.' }
  return labelid
}

function isParseLabelIdErro(v: ParseLabelIdResult): v is { erro: string } {
  return typeof v === 'object' && v != null && 'erro' in v
}

function normalizarPassoFollowUp(v: Record<string, unknown>): CanalFollowUpPasso | null {
  const minutos = v.minutos_espera
  const n = typeof minutos === 'number' ? minutos : Number.parseInt(String(minutos ?? ''), 10)
  if (!Number.isFinite(n) || n < 1) return null

  const mensagem_fixa = v.mensagem_fixa === true
  const etiqueta = extrairLabelId(v.etiqueta ?? v.label)
  const passo: CanalFollowUpPasso = {
    minutos_espera: Math.trunc(n),
    mensagem_fixa,
    etiqueta,
  }

  if (!mensagem_fixa) return passo

  const tipo = lerTipoFollowUp(v.tipo) ?? 'texto'
  passo.tipo = tipo
  const conteudo = typeof v.conteudo === 'string' ? v.conteudo : null
  passo.conteudo = conteudo
  if (tipo !== 'texto') {
    const media =
      typeof v.media_url === 'string' && v.media_url.trim() ? v.media_url.trim() : null
    passo.media_url = media
  } else {
    passo.media_url = null
  }
  return passo
}

/** Leitura tolerante (GET). */
export function normalizarConfigFollowUp(raw: unknown): CanalConfigFollowUp {
  const obj = objetoJson(raw)
  if (!obj) return {}
  const out: CanalConfigFollowUp = {}
  for (const [k, v] of Object.entries(obj)) {
    if (!/^\d+$/.test(k)) continue
    if (!v || typeof v !== 'object' || Array.isArray(v)) continue
    const passo = normalizarPassoFollowUp(v as Record<string, unknown>)
    if (!passo) continue
    out[String(Number.parseInt(k, 10))] = passo
  }
  return out
}

export function parseConfigFollowUp(raw: unknown): CanalConfigFollowUp | string {
  if (raw == null) return {}
  if (typeof raw === 'object' && !Array.isArray(raw) && Object.keys(raw as object).length === 0) {
    return {}
  }
  const obj = objetoJson(raw)
  if (!obj) return 'config_follow_up inválido.'
  const out: CanalConfigFollowUp = {}
  for (const [k, v] of Object.entries(obj)) {
    if (!/^\d+$/.test(k) || Number.parseInt(k, 10) < 1) {
      return `Passo de follow-up inválido: "${k}". Use 1, 2, 3…`
    }
    if (!v || typeof v !== 'object' || Array.isArray(v)) {
      return `Follow-up ${k} sem minutos_espera.`
    }
    const row = v as Record<string, unknown>
    const minutos = row.minutos_espera
    const n = typeof minutos === 'number' ? minutos : Number.parseInt(String(minutos ?? ''), 10)
    if (!Number.isFinite(n) || !Number.isInteger(n) || n < 1) {
      return `Minutos de espera inválidos no follow-up ${k} (informe um inteiro >= 1).`
    }

    const mensagem_fixa = row.mensagem_fixa === true
    const etiquetaParsed = parseEtiquetaFollowUp(row.etiqueta ?? row.label)
    if (isParseLabelIdErro(etiquetaParsed)) {
      return `Follow-up ${k}: ${etiquetaParsed.erro}`
    }
    const passo: CanalFollowUpPasso = {
      minutos_espera: n,
      mensagem_fixa,
      etiqueta: etiquetaParsed,
    }

    if (mensagem_fixa) {
      const tipo = lerTipoFollowUp(row.tipo)
      if (!tipo) {
        return `Tipo de mídia inválido no follow-up ${k}.`
      }
      passo.tipo = tipo
      const conteudo =
        typeof row.conteudo === 'string' ? row.conteudo.trim() : ''
      if (tipo === 'texto') {
        if (!conteudo) {
          return `Informe o texto da mensagem fixa no follow-up ${k}.`
        }
        passo.conteudo = conteudo
        passo.media_url = null
      } else {
        const media =
          typeof row.media_url === 'string' ? row.media_url.trim() : ''
        if (!media) {
          return `Envie o arquivo de mídia do follow-up ${k} antes de salvar.`
        }
        passo.media_url = media
        passo.conteudo = conteudo || null
      }
    }

    out[String(Number.parseInt(k, 10))] = passo
  }
  return out
}

/** Converte legado jsonb `{ quando_fazer, quando_nao_fazer }` em texto único. */
function regrasFollowUpLegadoParaTexto(obj: Record<string, unknown>): string {
  const partes: string[] = []
  const quandoFazer =
    typeof obj.quando_fazer === 'string' ? obj.quando_fazer.trim() : ''
  const quandoNao =
    typeof obj.quando_nao_fazer === 'string' ? obj.quando_nao_fazer.trim() : ''
  if (quandoFazer) partes.push(`Quando fazer:\n${quandoFazer}`)
  if (quandoNao) partes.push(`Quando não fazer:\n${quandoNao}`)
  return partes.join('\n\n')
}

export function normalizarRegrasFollowUp(raw: unknown): CanalRegrasFollowUp {
  if (typeof raw === 'string') return raw
  if (raw == null) return CANAL_REGRAS_FOLLOW_UP_PADRAO
  const obj = objetoJson(raw)
  if (obj) return regrasFollowUpLegadoParaTexto(obj)
  return CANAL_REGRAS_FOLLOW_UP_PADRAO
}

/** Texto livre. Erro → `{ erro }`. */
export function parseRegrasFollowUp(
  raw: unknown,
): CanalRegrasFollowUp | { erro: string } {
  if (raw == null) return CANAL_REGRAS_FOLLOW_UP_PADRAO
  if (typeof raw === 'string') return raw
  const obj = objetoJson(raw)
  if (obj) return regrasFollowUpLegadoParaTexto(obj)
  return { erro: 'regras_follow_up deve ser texto.' }
}

const MAX_PALAVRA_ATIVACAO_FOLLOW_UP = 200
const MAX_PALAVRAS_ATIVACAO_FOLLOW_UP = 50

/** Leitura tolerante (GET). Ausente/inválido → `[]`. */
export function normalizarPalavrasAtivacaoFollowUp(
  raw: unknown,
): CanalPalavrasAtivacaoFollowUp {
  const parsed = parsePalavrasAtivacaoFollowUp(raw)
  return typeof parsed === 'string' ? [] : parsed
}

/**
 * Array JSON de strings (palavras/frases).
 * Aceita letras, números e emoji. Vazio/ausente → `[]`.
 */
export function parsePalavrasAtivacaoFollowUp(
  raw: unknown,
): CanalPalavrasAtivacaoFollowUp | string {
  if (raw == null) return []
  let arr: unknown = raw
  if (typeof raw === 'string') {
    const s = raw.trim()
    if (!s || s === '[]') return []
    try {
      arr = JSON.parse(s) as unknown
    } catch {
      return 'palavras_ativacao_follow_up inválido.'
    }
  }
  if (!Array.isArray(arr)) return 'palavras_ativacao_follow_up inválido.'
  if (arr.length > MAX_PALAVRAS_ATIVACAO_FOLLOW_UP) {
    return `Informe no máximo ${MAX_PALAVRAS_ATIVACAO_FOLLOW_UP} palavras/frases.`
  }

  const out: CanalPalavrasAtivacaoFollowUp = []
  const vistos = new Set<string>()
  for (let i = 0; i < arr.length; i++) {
    const item = arr[i]
    if (typeof item !== 'string') {
      return `Palavra/frase ${i + 1} inválida.`
    }
    const texto = item.trim()
    if (!texto) continue
    if (texto.length > MAX_PALAVRA_ATIVACAO_FOLLOW_UP) {
      return `Palavra/frase ${i + 1} é longa demais (máx. ${MAX_PALAVRA_ATIVACAO_FOLLOW_UP} caracteres).`
    }
    const chave = texto.toLocaleLowerCase('pt-BR')
    if (vistos.has(chave)) continue
    vistos.add(chave)
    out.push(texto)
  }
  return out
}

/**
 * Gate do follow-up para mensagem do vendedor humano:
 * - sem palavras configuradas → `true` (comportamento atual)
 * - com palavras → `true` só se a mensagem contém alguma (case-insensitive)
 */
export function mensagemAtivaFollowUpPorPalavras(
  textoMensagem: string | null | undefined,
  palavrasRaw: unknown,
): boolean {
  const palavras = normalizarPalavrasAtivacaoFollowUp(palavrasRaw)
  if (!palavras.length) return true

  const texto = String(textoMensagem ?? '').toLocaleLowerCase('pt-BR')
  if (!texto.trim()) return false

  return palavras.some((p) => texto.includes(p.toLocaleLowerCase('pt-BR')))
}

/** Texto usado para casar palavras de ativação (`message` + `caption`). */
export function textoMensagemParaAtivacaoFollowUp(input: {
  message?: string | null
  caption?: string | null
}): string {
  const partes: string[] = []
  if (typeof input.message === 'string' && input.message.trim()) {
    partes.push(input.message.trim())
  }
  if (typeof input.caption === 'string' && input.caption.trim()) {
    partes.push(input.caption.trim())
  }
  return partes.join('\n')
}

/**
 * Slug da loja. Vazio → null.
 * Erro de formato volta como string começando por "Slug".
 */
export function parseLojaSlug(raw: unknown): string | null | { erro: string } {
  if (raw === null || raw === undefined) return null
  if (typeof raw !== 'string') return { erro: 'Slug da loja inválido.' }
  const slug = raw.trim().toLowerCase()
  if (!slug) return null
  if (!LOJA_SLUG_RE.test(slug)) {
    return {
      erro: 'Slug da loja inválido. Use letras minúsculas, números e hífen (sem hífen no início ou no fim).',
    }
  }
  return slug
}

export function parseMensagemSaudacao(raw: unknown): string | null | { erro: string } {
  if (raw === null || raw === undefined) return null
  if (typeof raw !== 'string') return { erro: 'Mensagem de saudação inválida.' }
  const t = raw.trim()
  return t || null
}

/** URL pública da imagem de saudação. Vazio → null. */
export function parseImagemSaudacao(raw: unknown): string | null | { erro: string } {
  if (raw === null || raw === undefined) return null
  if (typeof raw !== 'string') return { erro: 'Imagem de saudação inválida.' }
  const t = raw.trim()
  if (!t) return null
  if (t.length > 2000) return { erro: 'URL da imagem de saudação é longa demais.' }
  return t
}

function inteiroPositivo(raw: unknown): number | null {
  const n = typeof raw === 'number' ? raw : Number.parseInt(String(raw ?? ''), 10)
  if (!Number.isFinite(n) || !Number.isInteger(n) || n < 1) return null
  return n
}

/** Leitura tolerante (GET). Valor ausente ou inválido vira lista vazia. */
export function normalizarFollowAtivoEmColunas(raw: unknown): CanalFollowAtivoEmColunas {
  const parsed = parseFollowAtivoEmColunas(raw)
  return typeof parsed === 'string' ? [] : parsed
}

/**
 * Lista `[{ funil_id, coluna_id }]`.
 * Vazio ou ausente → `[]`.
 */
export function parseFollowAtivoEmColunas(raw: unknown): CanalFollowAtivoEmColunas | string {
  if (raw == null) return []
  let arr: unknown = raw
  if (typeof raw === 'string') {
    const s = raw.trim()
    if (!s) return []
    try {
      arr = JSON.parse(s) as unknown
    } catch {
      return 'follow_ativo_em_colunas inválido.'
    }
  }
  if (!Array.isArray(arr)) return 'follow_ativo_em_colunas inválido.'

  const out: CanalFollowAtivoEmColunas = []
  const vistos = new Set<string>()
  for (const item of arr) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      return 'Item de follow_ativo_em_colunas inválido.'
    }
    const o = item as Record<string, unknown>
    const funilId = inteiroPositivo(o.funil_id)
    const colunaId = inteiroPositivo(o.coluna_id)
    if (funilId == null || colunaId == null) {
      return 'funil_id e coluna_id devem ser inteiros positivos.'
    }
    const chave = `${funilId}:${colunaId}`
    if (vistos.has(chave)) continue
    vistos.add(chave)
    out.push({ funil_id: funilId, coluna_id: colunaId })
  }
  return out
}

export function parseFlagCanal(raw: unknown, label: string): boolean | string {
  if (typeof raw === 'boolean') return raw
  return `${label} inválido.`
}
