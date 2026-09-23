import { extrairDigitosTelefone } from '#shared/utils/normalizeWhatsappBr'

function unicos(valores: string[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const v of valores) {
    const t = v.trim()
    if (!t || seen.has(t)) continue
    seen.add(t)
    out.push(t)
  }
  return out
}

function comESemDdi(local: string): string[] {
  if (!local) return []
  if (local.startsWith('55')) return [local]
  return [local, `55${local}`]
}

/**
 * Monta as duas formas do celular BR (com e sem o 9 extra) para busca em `conversas.phone`.
 */
export function variantesCelularBusca(input: unknown): { comNove: string[]; semNove: string[] } {
  const digits = extrairDigitosTelefone(input)
  if (!digits) return { comNove: [], semNove: [] }

  let local = digits
  if (local.startsWith('55') && (local.length === 12 || local.length === 13)) {
    local = local.slice(2)
  }

  if (local.length !== 10 && local.length !== 11) {
    return { comNove: comESemDdi(digits), semNove: [] }
  }

  const ddd = local.slice(0, 2)
  const rest = local.slice(2)

  let com = ''
  let sem = ''
  if (rest.length === 9 && rest.startsWith('9')) {
    com = `${ddd}${rest}`
    sem = `${ddd}${rest.slice(1)}`
  } else if (rest.length === 8) {
    sem = `${ddd}${rest}`
    com = `${ddd}9${rest}`
  } else {
    com = local
    sem = local
  }

  return {
    comNove: unicos(comESemDdi(com)),
    semNove: unicos(comESemDdi(sem)),
  }
}

/** Grava o celular como veio (com 55), sem remover o 9. */
export function celularParaGravar(input: unknown): string {
  let digits = extrairDigitosTelefone(input)
  if (!digits) return ''
  if (!digits.startsWith('55') && (digits.length === 10 || digits.length === 11)) {
    digits = `55${digits}`
  }
  if (digits.startsWith('55') && (digits.length === 12 || digits.length === 13)) return digits
  return ''
}
