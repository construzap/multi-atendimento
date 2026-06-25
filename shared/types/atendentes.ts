/** Item da listagem (GET /api/atendentes). */
export type AtendenteListaItem = {
  /** PK da linha em `public.atendentes`. */
  id: number
  nome: string | null
  email: string | null
  /** `true` se o registro pertence ao usuário autenticado. */
  sou_eu: boolean
}

export type AtendentesListResponse = {
  data: AtendenteListaItem[]
  /** `true` se o usuário logado é o criador do workspace (`workspace.user_id`). */
  sou_dono_workspace: boolean
}
