import type { MensagemProntaPasso, MensagemProntaTipo } from '#shared/types/mensagensProntas'
import {
  CONTEUDO_PASSO_LIGACAO,
  DURACAO_LIGACAO_SEGUNDOS_MAX,
  DURACAO_LIGACAO_SEGUNDOS_MIN,
} from '#shared/types/mensagensProntas'

const TIPOS: MensagemProntaTipo[] = [
  'texto',
  'audio',
  'imagem',
  'video',
  'documento',
  'figurinha',
  'ligacao',
]

/** Aceita array ou objeto `{ "0": passo, ... }`; ignora chaves soltas (ex.: `duracao_ligacao_segundos`). */
export function coercePassosInput(raw: unknown): unknown[] {
  if (Array.isArray(raw)) return raw
  if (raw && typeof raw === 'object') {
    return Object.keys(raw as Record<string, unknown>)
      .filter((k) => /^\d+$/.test(k))
      .sort((a, b) => Number(a) - Number(b))
      .map((k) => (raw as Record<string, unknown>)[k])
  }
  return []
}

function tipoPassoValido(row: Record<string, unknown>): MensagemProntaTipo | null {
  const tipoRaw = String(row.tipo ?? '').trim().toLowerCase()
  if (!(TIPOS as string[]).includes(tipoRaw)) return null
  return tipoRaw as MensagemProntaTipo
}

/**
 * Remove entradas inválidas/“fantasma” (ex.: `{ duracao_ligacao_segundos: null }` sem `tipo`).
 * Usado antes de enviar ao N8N.
 */
export function filtrarPassosValidosParaEnvio(
  raw: unknown,
  sequenciaId = '',
): MensagemProntaPasso[] {
  const items = coercePassosInput(raw)
  const out: MensagemProntaPasso[] = []

  for (let i = 0; i < items.length; i++) {
    const item = items[i]
    if (!item || typeof item !== 'object') continue
    const row = item as Record<string, unknown>
    const tipo = tipoPassoValido(row)
    if (!tipo) continue

    const isLigacao = tipo === 'ligacao'
    const conteudo = isLigacao
      ? (String(row.conteudo ?? '').trim() || CONTEUDO_PASSO_LIGACAO)
      : String(row.conteudo ?? '').trim()
    if (!isLigacao && !conteudo) continue

    let duracao_ligacao_segundos: number | null = null
    if (isLigacao) {
      const d = Number(row.duracao_ligacao_segundos)
      if (
        !Number.isFinite(d) ||
        d < DURACAO_LIGACAO_SEGUNDOS_MIN ||
        d > DURACAO_LIGACAO_SEGUNDOS_MAX
      ) {
        continue
      }
      duracao_ligacao_segundos = Math.trunc(d)
    }

    out.push({
      id: String(row.id ?? `${i + 1}`),
      sequencia_id: String(row.sequencia_id ?? sequenciaId),
      ordem: Number(row.ordem ?? i + 1),
      tipo,
      conteudo,
      delay_segundos: Math.max(0, Number(row.delay_segundos ?? 0) || 0),
      duracao_ligacao_segundos,
      created_at: String(row.created_at ?? new Date().toISOString()),
    })
  }

  out.sort((a, b) => a.ordem - b.ordem)
  return out
}
