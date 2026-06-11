export type ItemSelecaoMultipla = {
  id: number
  nome: string
}

export const CONFIG_SELECAO_MULTIPLA = {
  tituloPainel: 'Termos de pesquisa',
  placeholderCelula: 'Selecionar termos…',
  placeholderFiltro: 'Buscar ou criar termo…',
  placeholderEdicao: 'Nome do termo',
  apiBase: '/api/produtos/termos-de-pesquisa',
  apiItem: (id: number) => `/api/produtos/termos-de-pesquisa/${id}`,
  labelEliminarConfirm: (nome: string) =>
    `Eliminar o termo «${nome}»? Será removido de todos os produtos que o usam.`,
  toastAtualizado: 'Termo atualizado.',
  toastEliminado: 'Termo eliminado.',
  toastCriado: 'Termo criado.',
  toastJaExistia: 'Já existia; termo selecionado.',
  erroAtualizar: 'Não foi possível atualizar o termo.',
  erroEliminar: 'Não foi possível eliminar o termo.',
  erroCriar: 'Não foi possível criar o termo.',
  erroNomeVazio: 'Informe o nome do termo.',
} as const
