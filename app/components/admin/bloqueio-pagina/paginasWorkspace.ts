export type WorkspacePaginaColuna = {
  /** Slug alinhado à rota / page_roles (ex.: `kanban`, `vector-store`). */
  slug: string
  /** Rótulo exibido na coluna. */
  label: string
  /** Caminho relativo sob `workspaces/[id]/`. */
  path: string
}

const LABELS: Record<string, string> = {
  kanban: 'Kanban',
  chat: 'Chat',
  contato: 'Contato',
  canais: 'Canais',
  produtos: 'Produtos',
  'vector-store': 'Vector Store',
  atendentes: 'Atendentes',
  frete: 'Frete',
  cobranca: 'Cobrança',
  'agendamento-mensagens': 'Agendamento',
  logs: 'Logs',
  configuracoes: 'Configurações',
  'disparo-em-massa': 'Disparo em massa',
}

/** Páginas de ação / aninhadas que não entram no bloqueio. */
const PATHS_IGNORADOS = new Set([
  'produtos/criar',
])

/**
 * Descobre páginas em `app/pages/workspaces/[id]/...`.
 * Novas páginas (arquivo `.vue` ou pasta com `index.vue`) entram automaticamente no build.
 */
const pageModules = import.meta.glob('~/pages/workspaces/**/*.vue')

function tituloFromSlug(slug: string): string {
  if (LABELS[slug]) return LABELS[slug]
  return slug
    .split('-')
    .filter(Boolean)
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join(' ')
}

function normalizarPathModulo(raw: string): string {
  return raw.replace(/\\/g, '/')
}

/**
 * Extrai o trecho após `workspaces/[id]/` (ou `workspaces/<qualquer>/`).
 */
function trechoAposWorkspaceId(path: string): string | null {
  const match = path.match(/\/pages\/workspaces\/[^/]+\/(.+)$/)
  return match?.[1] ?? null
}

function temSegmentoDinamico(rel: string): boolean {
  return rel.split('/').some((seg) => /^\[.+\]$/.test(seg))
}

function slugEPathFromRel(rel: string): { slug: string; path: string } | null {
  // produtos/enviar-para-ia/vector-store.vue → vector-store
  if (rel === 'produtos/enviar-para-ia/vector-store.vue') {
    return { slug: 'vector-store', path: 'produtos/enviar-para-ia/vector-store' }
  }

  if (PATHS_IGNORADOS.has(rel.replace(/\.vue$/, ''))) return null

  // pasta/index.vue → slug da pasta
  if (rel.endsWith('/index.vue')) {
    const semIndex = rel.slice(0, -'/index.vue'.length)
    const parts = semIndex.split('/').filter(Boolean)
    if (parts.length !== 1) return null
    return { slug: parts[0]!, path: semIndex }
  }

  // arquivo direto: frete.vue → frete
  if (rel.endsWith('.vue') && !rel.includes('/')) {
    const slug = rel.replace(/\.vue$/, '')
    if (!slug || slug.startsWith('[')) return null
    return { slug, path: slug }
  }

  return null
}

let cacheColunas: WorkspacePaginaColuna[] | null = null

export function listarPaginasWorkspaceBloqueio(): WorkspacePaginaColuna[] {
  if (cacheColunas) return cacheColunas

  const bySlug = new Map<string, WorkspacePaginaColuna>()

  for (const key of Object.keys(pageModules)) {
    const path = normalizarPathModulo(key)
    const rel = trechoAposWorkspaceId(path)
    if (!rel) continue
    if (temSegmentoDinamico(rel)) continue

    const parsed = slugEPathFromRel(rel)
    if (!parsed) continue

    bySlug.set(parsed.slug, {
      slug: parsed.slug,
      label: tituloFromSlug(parsed.slug),
      path: parsed.path,
    })
  }

  const ordemPreferida = Object.keys(LABELS)
  cacheColunas = [...bySlug.values()].sort((a, b) => {
    const ia = ordemPreferida.indexOf(a.slug)
    const ib = ordemPreferida.indexOf(b.slug)
    if (ia === -1 && ib === -1) return a.label.localeCompare(b.label, 'pt-BR')
    if (ia === -1) return 1
    if (ib === -1) return -1
    return ia - ib
  })

  return cacheColunas
}
