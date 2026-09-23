/** Rotas públicas do fluxo do entregador (`/entrega/:token`). */
export function isRotaEntregaPublica(path: string | null | undefined): boolean {
  const p = String(path ?? '')
  return p === '/entrega' || p.startsWith('/entrega/')
}

/** Loja pública (`/loja`, `/loja/:slug`, `/loja/:slug/:id`). */
export function isRotaLojaPublica(path: string | null | undefined): boolean {
  const p = String(path ?? '')
  return p === '/loja' || p.startsWith('/loja/')
}

/** Superfícies públicas (sem sessão). */
export function isRotaPublica(path: string | null | undefined): boolean {
  return isRotaEntregaPublica(path) || isRotaLojaPublica(path)
}
