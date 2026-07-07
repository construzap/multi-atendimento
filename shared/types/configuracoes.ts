/** Configurações editáveis do workspace na página de configurações. */
export interface WorkspaceConfiguracoes {
  nome: string
  descricao: string | null
  fase_teste: boolean
  numero_testes: string | null
  numero_notificacao: string | null
  tempo_resposta: number
  tempo_pausa: number
  coluna_origem_leads: string | null
}
