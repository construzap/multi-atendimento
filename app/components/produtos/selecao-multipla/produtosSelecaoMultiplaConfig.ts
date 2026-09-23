export type ItemSelecaoMultipla = {
  id: number
  nome: string
}

export const CONFIG_SELECAO_MULTIPLA = {
  tituloPainel: 'Categorias',
  tituloCriar: 'Criar categoria',
  tituloEditar: 'Editar categoria',
  tituloEliminar: 'Eliminar categoria',
  labelNomeCampo: 'Nome da categoria',
  labelBotaoCriar: 'Criar categoria',
  labelBotaoGerenciar: 'Gerenciar categorias',
  placeholderCelula: 'Selecionar categorias…',
  placeholderFiltro: 'Buscar categoria…',
  placeholderEdicao: 'Nome da categoria',
  apiBase: '/api/produtos/termos-de-pesquisa',
  apiItem: (id: number) => `/api/produtos/termos-de-pesquisa/${id}`,
  labelEliminarConfirm: (nome: string) =>
    `Eliminar a categoria «${nome}»? Será removida de todos os produtos que a usam.`,
  toastAtualizado: 'Categoria atualizada.',
  toastEliminado: 'Categoria eliminada.',
  toastCriado: 'Categoria criada.',
  toastJaExistia: 'Já existia; categoria selecionada.',
  erroAtualizar: 'Não foi possível atualizar a categoria.',
  erroEliminar: 'Não foi possível eliminar a categoria.',
  erroCriar: 'Não foi possível criar a categoria.',
  erroNomeVazio: 'Informe o nome da categoria.',
} as const
