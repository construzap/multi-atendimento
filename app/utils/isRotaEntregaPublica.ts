/** Rotas públicas do fluxo do entregador (`/entrega/:token`). */
export function isRotaEntregaPublica(path: string | null | undefined): boolean {
  const p = String(path ?? '')
  return p === '/entrega' || p.startsWith('/entrega/')
}
