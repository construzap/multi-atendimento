/**
 * Mapeamento do status da conexão da instância (Uazapi).
 * Usado para padronizar o retorno do backend e o consumo no frontend.
 */
export type InstanciaConexaoStatus = 'disconnected' | 'connecting' | 'connected'

export interface InstanciaStatus {
  /** Status da conexão (Uazapi). */
  status: InstanciaConexaoStatus | null
  /** Nome do perfil conectado no WhatsApp (quando disponível). */
  nome: string | null
  /** Foto do perfil conectado no WhatsApp (quando disponível). */
  foto: string | null
  /** Número/login do WhatsApp (quando disponível). */
  numero: string | null
}

