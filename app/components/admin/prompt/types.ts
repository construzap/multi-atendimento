export interface AdminPromptItem {
  id: string
  titulo: string
  conteudo: string
  principal: boolean
  atualizadoEm: string
  /** Prompt ainda não persistido no banco. */
  isNovo?: boolean
}
