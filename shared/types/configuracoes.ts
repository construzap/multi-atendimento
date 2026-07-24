/** Configurações editáveis do workspace na página de configurações. */
export interface WorkspaceConfiguracoes {
  nome: string
  descricao: string | null
  fase_teste: boolean
  numero_testes: string | null
  numero_notificacao: string | null
  tempo_resposta: number
  tempo_pausa: number
  /** ID do funil (`funil_workspace.id`) para origem dos leads. */
  funil_origem_leads: string | null
  /** ID da coluna (`funil_workspace_colunas.id`) para origem dos leads. */
  coluna_origem_leads: string | null
}
