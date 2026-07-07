export type RegrasSenhaUsuario = {
  minimo: boolean
  maiuscula: boolean
  numero: boolean
  especial: boolean
}

export function regrasSenhaUsuarioAtendidas(senha: string): RegrasSenhaUsuario {
  return {
    minimo: senha.length >= 8,
    maiuscula: /[A-Z]/.test(senha),
    numero: /[0-9]/.test(senha),
    especial: /[^A-Za-z0-9]/.test(senha),
  }
}

export function senhaUsuarioValida(senha: string): boolean {
  const regras = regrasSenhaUsuarioAtendidas(senha)
  return regras.minimo && regras.maiuscula && regras.numero && regras.especial
}

export const MENSAGEM_SENHA_USUARIO_INVALIDA =
  'A senha deve ter no mínimo 8 caracteres, uma letra maiúscula, um número e um caractere especial.'

export function validarSenhaUsuario(senha: string): { valida: boolean; mensagem?: string } {
  if (!senha.length) {
    return { valida: false, mensagem: 'Informe a nova senha.' }
  }
  if (!senhaUsuarioValida(senha)) {
    return { valida: false, mensagem: MENSAGEM_SENHA_USUARIO_INVALIDA }
  }
  return { valida: true }
}
