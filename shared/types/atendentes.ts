/** Item da listagem (GET /api/atendentes). */
export type AtendenteListaItem = {
  /** PK da linha em `public.atendentes`. */
  id: number
  nome: string | null
  email: string | null
  atendente_user_id: string
}

export type AtendentesListResponse = {
  data: AtendenteListaItem[]
  /** `true` se o usuário logado é o criador do workspace (`workspace.user_id`). */
  sou_dono_workspace: boolean
}
