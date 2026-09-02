import type { MensagemProntaComPassos, MensagemProntaPasso } from '#shared/types/mensagensProntas'
import { filtrarPassosValidosParaEnvio } from '#shared/utils/mensagensProntasPassosEnvio'

/** Token inserido no editor e resolvido no envio. */
export const VAR_PRIMEIRO_NOME = '{primeiro-nome}'

/** Token: vira "bom dia" / "boa tarde" / "boa noite" conforme o horário do envio. */
export const VAR_SAUDACAO = '{saudacao}'

/**
 * Aceita hífen ASCII e traços unicode comuns (copy/paste).
 * Ex.: `{primeiro-nome}`, `{primeiro–nome}`
 */
const RE_PRIMEIRO_NOME = /\{primeiro[\s\u00ad\u2010-\u2015\u2212_-]*nome\}/gi

/** Aceita variações leves de digitação / copy-paste. */
const RE_SAUDACAO = /\{saudacao\}/gi

const TZ_BRASIL = 'America/Sao_Paulo'

/**
 * Primeira palavra do nome.
 * Vazio se null/vazio ou se o nome (ou a 1ª palavra) for só números.
 */
export function extrairPrimeiroNome(name: string | null | undefined): string {
  const t = String(name ?? '').trim()
  if (!t) return ''

  const semEspacos = t.replace(/\s+/g, '')
  if (/^\d+$/.test(semEspacos)) return ''

  const primeiro = t.split(/\s+/)[0] ?? ''
  if (!primeiro || /^\d+$/.test(primeiro)) return ''

  return primeiro
}

/**
 * Saudação pelo horário atual (fuso America/Sao_Paulo):
 * - 05:00–11:59 → Bom dia
 * - 12:00–17:59 → Boa tarde
 * - 18:00–04:59 → Boa noite
 */
export function saudacaoPorHorario(agora: Date = new Date()): string {
  let hora = agora.getHours()
  try {
    const parts = new Intl.DateTimeFormat('pt-BR', {
      timeZone: TZ_BRASIL,
      hour: 'numeric',
      hour12: false,
      hourCycle: 'h23',
    }).formatToParts(agora)
    const h = parts.find((p) => p.type === 'hour')?.value
    if (h != null) {
      const n = Number.parseInt(h, 10)
      if (Number.isFinite(n)) hora = n
    }
  } catch {
    /* fallback: hora local do runtime */
  }

  if (hora >= 5 && hora < 12) return 'Bom dia'
  if (hora >= 12 && hora < 18) return 'Boa tarde'
  return 'Boa noite'
}

/** Substitui variáveis de texto (ex.: `{primeiro-nome}`, `{saudacao}`). */
export function aplicarVariaveisMensagemPronta(
  texto: string,
  name: string | null | undefined,
  agora?: Date,
): string {
  const primeiro = extrairPrimeiroNome(name)
  const saudacao = saudacaoPorHorario(agora)
  return String(texto ?? '')
    .replace(RE_PRIMEIRO_NOME, primeiro)
    .replace(RE_SAUDACAO, saudacao)
}

/** Resolve variáveis só em passos `texto`; mídia permanece igual. */
export function resolverPassosMensagemPronta(
  passos: MensagemProntaPasso[],
  name: string | null | undefined,
  agora?: Date,
): MensagemProntaPasso[] {
  return (passos ?? []).map((p) => {
    const tipo = String(p.tipo ?? '').trim().toLowerCase()
    if (tipo !== 'texto') return { ...p }
    return {
      ...p,
      conteudo: aplicarVariaveisMensagemPronta(p.conteudo, name, agora),
    }
  })
}

export function resolverMensagemProntaParaEnvio(
  item: MensagemProntaComPassos,
  name: string | null | undefined,
  agora?: Date,
): MensagemProntaComPassos {
  const passosValidos = filtrarPassosValidosParaEnvio(item.passos, item.sequencia.id)
  return {
    sequencia: { ...item.sequencia },
    passos: resolverPassosMensagemPronta(passosValidos, name, agora),
  }
}
