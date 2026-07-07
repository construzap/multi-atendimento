export interface AdminPromptItem {
  id: string
  titulo: string
  conteudo: string
  tipo: string
  principal: boolean
  atualizadoEm: string
  /** Prompt ainda não persistido no banco. */
  isNovo?: boolean
}

export {
  PROMPT_WORKSPACE_TIPO_DEFAULT,
  PROMPT_WORKSPACE_TIPOS_OPCOES as PROMPT_TIPOS_OPCOES,
} from '#shared/types/adminPrompt'
