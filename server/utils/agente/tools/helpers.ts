import type { AgenteContext } from '#shared/types/agente'

export type ToolDef = {
  name: string
  description: string
  parameters: Record<string, unknown>
  /** Chave em runtimeConfig para URL HTTP; null = calculator local */
  urlConfigKey: string | null
  buildBody: (args: Record<string, unknown>, ctx: AgenteContext) => Record<string, unknown>
}

export function ctxStr(v: string | null | undefined): string {
  return v == null ? '' : String(v)
}

/**
 * Escolhe a primeira URL “real” entre candidatos.
 * Ignora string vazia e expressões N8N não avaliadas (ex.: {{ $('X').item.json.y }}).
 */
export function resolveCtxUrl(
  ...candidates: Array<string | null | undefined>
): string {
  for (const raw of candidates) {
    const s = ctxStr(raw).trim()
    if (!s) continue
    if (s.includes('{{') || s.includes('}}')) continue
    if (s.includes("$('") || s.includes('$("')) continue
    return s
  }
  return ''
}

export function argStr(args: Record<string, unknown>, ...keys: string[]): string {
  for (const k of keys) {
    if (args[k] !== undefined && args[k] !== null) {
      const v = args[k]
      return typeof v === 'string' ? v : JSON.stringify(v)
    }
  }
  return ''
}

export function argAny(args: Record<string, unknown>, ...keys: string[]): unknown {
  for (const k of keys) {
    if (args[k] !== undefined && args[k] !== null) return args[k]
  }
  return undefined
}
