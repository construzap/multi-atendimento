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

type ProdutoComId = { id?: unknown; nome?: unknown; quantidade?: unknown }

/**
 * Valida que cada produto usa o id numérico retornado por <estoque>, não o nome.
 * Retorna mensagem de erro para o modelo ou null se ok.
 */
export function validateProdutosIdsFromEstoque(
  produtos: unknown,
  toolName: 'orcamentopronto' | 'frete',
): string | null {
  if (!Array.isArray(produtos) || produtos.length === 0) {
    return (
      `ERRO ao chamar <${toolName}>: o array de produtos está vazio ou inválido. ` +
      'Chame a ferramenta <estoque> para CADA item do pedido (um produto por chamada), ' +
      'anote o id numérico de cada resposta e só então chame <' +
      toolName +
      '>.'
    )
  }

  for (let i = 0; i < produtos.length; i++) {
    const item = produtos[i] as ProdutoComId
    const id = String(item?.id ?? '').trim()
    const nome = String(item?.nome ?? '').trim()

    if (!/^\d+$/.test(id)) {
      const preview = id.length > 80 ? `${id.slice(0, 80)}…` : id
      return (
        `ERRO ao chamar <${toolName}>: produto #${i + 1} tem id inválido "${preview}". ` +
        'O campo id deve ser APENAS o número retornado pela ferramenta <estoque> (ex.: "7203"). ' +
        'Nunca use o nome do produto como id. ' +
        'Chame <estoque> um produto por vez, use o id numérico de cada resposta e tente <' +
        toolName +
        '> novamente.'
      )
    }

    if (nome && id === nome) {
      return (
        `ERRO ao chamar <${toolName}>: produto #${i + 1} — id e nome são iguais. ` +
        'O id deve ser o número da <estoque>, não o nome do produto.'
      )
    }
  }

  return null
}
