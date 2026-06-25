/**
 * Dados genéricos de contato/conversa para o modal reutilizável `InfoContatoConversa`.
 */
export type InfoContatoConversaData = {
  conversa_key: string
  name: string | null
  phone: string | null
  photo: string | null
  preview: string | null
  updated_at: string | null
  canal_nome: string | null
  /** 1=baixa, 2=média, 3=alta */
  prioridade?: number | null
  /** Nome da etapa/coluna do funil, quando aplicável. */
  etapa_nome?: string | null
}
