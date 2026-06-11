/** Configurações editáveis do workspace na página de configurações. */
export interface WorkspaceConfiguracoes {
  nome: string
  descricao: string | null
  fase_teste: boolean
  numero_testes: string | null
  numero_notificacao: string | null
}
