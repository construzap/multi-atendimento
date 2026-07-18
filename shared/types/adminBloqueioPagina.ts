import type { PageRoleRow } from '#shared/types/pageRoles'

/** Profile listado no admin de bloqueio de página. */
export interface AdminBloqueioProfileItem {
  /** PK numérica em `profiles.id` (FK de `page_roles.profile_id`). */
  profile_id: number | null
  user_id: string
  full_name: string | null
  email: string | null
  whatsapp: string | null
  /** Dono do workspace (`workspace.user_id`). */
  is_owner: boolean
  /** Está na tabela `atendentes` deste workspace. */
  is_atendente: boolean
}

export interface AdminBloqueioProfilesResponse {
  workspace_id: number
  owner_user_id: string
  items: AdminBloqueioProfileItem[]
}

export interface AdminBloqueioPageRolesResponse {
  workspace_id: number
  items: PageRoleRow[]
}

export interface AdminBloqueioTogglePageBody {
  workspace_id: number
  profile_id: number
  /** Slug da página (ex.: `chat`, `kanban`). */
  page: string
  /** `true` adiciona em `pages`; `false` remove. */
  enabled: boolean
}

export interface AdminBloqueioTogglePageResponse {
  row: PageRoleRow
}
