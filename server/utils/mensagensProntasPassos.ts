import { createError } from 'h3'
import type {
  MensagemProntaPasso,
  MensagemProntaPassoInput,
  MensagemProntaTipo,
} from '#shared/types/mensagensProntas'
import {
  CONTEUDO_PASSO_LIGACAO,
  DURACAO_LIGACAO_SEGUNDOS_MAX,
  DURACAO_LIGACAO_SEGUNDOS_MIN,
} from '#shared/types/mensagensProntas'

export const MENSAGEM_PRONTA_TIPOS: MensagemProntaTipo[] = [
  'texto',
  'audio',
  'imagem',
  'video',
  'documento',
  'figurinha',
  'ligacao',
]

export const MENSAGEM_PRONTA_PASSOS_SELECT =
  'id, sequencia_id, ordem, tipo, conteudo, delay_segundos, duracao_ligacao_segundos, created_at'

function strRequired(raw: unknown, label: string): string {
  const s = typeof raw === 'string' ? raw.trim() : String(raw ?? '').trim()
  if (!s) {
    throw createError({ statusCode: 400, statusMessage: `${label} é obrigatório.` })
  }
  return s
}

export function parseDuracaoLigacaoSegundos(raw: unknown, label: string): number {
  const n =
    typeof raw === 'number' && Number.isFinite(raw)
      ? Math.trunc(raw)
      : Number.parseInt(String(raw ?? '').trim(), 10)
  if (!Number.isFinite(n) || n < DURACAO_LIGACAO_SEGUNDOS_MIN || n > DURACAO_LIGACAO_SEGUNDOS_MAX) {
    throw createError({
      statusCode: 400,
      statusMessage: `${label} deve ser um inteiro entre ${DURACAO_LIGACAO_SEGUNDOS_MIN} e ${DURACAO_LIGACAO_SEGUNDOS_MAX}.`,
    })
  }
  return n
}

export function mapDuracaoLigacaoSegundos(tipo: string, raw: unknown): number | null {
  if (String(tipo).trim().toLowerCase() !== 'ligacao') return null
  const n =
    typeof raw === 'number' && Number.isFinite(raw)
      ? Math.trunc(raw)
      : Number.parseInt(String(raw ?? '').trim(), 10)
  if (!Number.isFinite(n) || n < 1) return null
  return n
}

export function mapPassoFromDbRow(row: Record<string, unknown>): MensagemProntaPasso {
  const tipo = String(row.tipo ?? '') as MensagemProntaTipo
  return {
    id: String(row.id),
    sequencia_id: String(row.sequencia_id),
    ordem: Number(row.ordem),
    tipo,
    conteudo: String(row.conteudo ?? ''),
    delay_segundos: Number(row.delay_segundos ?? 0),
    duracao_ligacao_segundos: mapDuracaoLigacaoSegundos(tipo, row.duracao_ligacao_segundos),
    created_at: String(row.created_at ?? new Date().toISOString()),
  }
}

export function passoInsertRow(sequenciaId: string, p: MensagemProntaPassoInput) {
  const isLigacao = p.tipo === 'ligacao'
  return {
    sequencia_id: sequenciaId,
    ordem: p.ordem,
    tipo: p.tipo,
    conteudo: isLigacao ? (p.conteudo?.trim() || CONTEUDO_PASSO_LIGACAO) : p.conteudo,
    delay_segundos: p.delay_segundos,
    duracao_ligacao_segundos: isLigacao ? (p.duracao_ligacao_segundos ?? null) : null,
  }
}

export function parsePassos(raw: unknown): MensagemProntaPassoInput[] {
  if (!Array.isArray(raw) || raw.length === 0) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Informe ao menos um passo em passos[].',
    })
  }

  const out: MensagemProntaPassoInput[] = []

  for (let i = 0; i < raw.length; i++) {
    const item = raw[i]
    if (!item || typeof item !== 'object') {
      throw createError({ statusCode: 400, statusMessage: `Passo ${i + 1} inválido.` })
    }
    const o = item as Record<string, unknown>
    const tipoRaw = String(o.tipo ?? '').trim().toLowerCase()
    if (!(MENSAGEM_PRONTA_TIPOS as string[]).includes(tipoRaw)) {
      throw createError({
        statusCode: 400,
        statusMessage: `Tipo inválido no passo ${i + 1}. Use: ${MENSAGEM_PRONTA_TIPOS.join(', ')}.`,
      })
    }
    const tipo = tipoRaw as MensagemProntaTipo
    const isLigacao = tipo === 'ligacao'

    const conteudo = isLigacao
      ? (typeof o.conteudo === 'string' ? o.conteudo.trim() : String(o.conteudo ?? '').trim()) ||
        CONTEUDO_PASSO_LIGACAO
      : strRequired(o.conteudo, `Conteúdo do passo ${i + 1}`)

    const ordemRaw = o.ordem
    const ordem =
      typeof ordemRaw === 'number' && Number.isFinite(ordemRaw)
        ? Math.trunc(ordemRaw)
        : Number.parseInt(String(ordemRaw ?? i + 1), 10)
    if (!Number.isFinite(ordem) || ordem < 1) {
      throw createError({ statusCode: 400, statusMessage: `Ordem inválida no passo ${i + 1}.` })
    }

    const delayRaw = o.delay_segundos
    const delay =
      typeof delayRaw === 'number' && Number.isFinite(delayRaw)
        ? Math.max(0, Math.trunc(delayRaw))
        : Math.max(0, Number.parseInt(String(delayRaw ?? 0), 10) || 0)

    const duracao_ligacao_segundos = isLigacao
      ? parseDuracaoLigacaoSegundos(o.duracao_ligacao_segundos, `Tempo da ligação no passo ${i + 1}`)
      : null

    out.push({
      ordem,
      tipo,
      conteudo,
      delay_segundos: delay,
      duracao_ligacao_segundos,
    })
  }

  out.sort((a, b) => a.ordem - b.ordem)
  return out
}
