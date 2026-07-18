/**
 * Slugs de página usados em `public.page_roles.pages` (text[]).
 * Alinhados aos segmentos de rota em `/workspaces/[id]/...`.
 */
export type PageRoleSlug =
  | 'kanban'
  | 'chat'
  | 'contato'
  | 'canais'
  | 'produtos'
  | 'vector-store'
  | 'atendentes'
  | 'frete'
  | 'cobranca'
  | 'agendamento-mensagens'
  | 'logs'
  | 'configuracoes'
  | 'disparo-em-massa'

/** Mensagem quando o perfil não tem o slug em `page_roles.pages`. */
export const MSG_SEM_PERMISSAO_PAGINA =
  'Você não tem permissão para acessar esta página. Entre em contato com o suporte.'

/**
 * Páginas liberadas por padrão ao criar workspace (dono) ou atendente.
 * Alterar aqui afeta os dois fluxos.
 */
export const PAGE_ROLES_PADRAO: readonly PageRoleSlug[] = [
  'canais',
  'atendentes',
  'configuracoes',
  'frete',
  'vector-store',
  'contato',
  'produtos',
] as const

/** Linha de `public.page_roles`. */
export interface PageRoleRow {
  id: number
  workspace_id: number
  profile_id: number
  pages: string[]
  created_at: string
  updated_at: string
}

/** Resposta de `GET /api/page-roles`. */
export interface PageRolesCheckResponse {
  pages: string[]
  row: PageRoleRow | null
}
