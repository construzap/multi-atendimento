export type CatalogoSelecaoUnica = 'categoria' | 'termos_pesquisa'

export type ItemSelecaoUnica = {
  id: number
  nome: string
}

export type ConfigSelecaoUnica = {
  tituloPainel: string
  placeholderCelula: string
  placeholderFiltro: string
  placeholderForm: string
  placeholderEdicao: string
  apiBase: string
  apiItem: (id: number) => string
  labelEliminarConfirm: (nome: string) => string
  toastAtualizado: string
  toastEliminado: string
  toastCriado: string
  toastJaExistia: string
  erroAtualizar: string
  erroEliminar: string
  erroCriar: string
  erroNomeVazio: string
}

export const CONFIGS_SELECAO_UNICA: Record<CatalogoSelecaoUnica, ConfigSelecaoUnica> = {
  categoria: {
    tituloPainel: 'Categorias',
    placeholderCelula: 'Selecionar categoria…',
    placeholderFiltro: 'Buscar ou criar categoria…',
    placeholderForm: 'Comece a digitar para buscar…',
    placeholderEdicao: 'Nome da categoria',
    apiBase: '/api/produtos/categorias',
    apiItem: (id) => `/api/produtos/categorias/${id}`,
    labelEliminarConfirm: (nome) =>
      `Eliminar a categoria «${nome}»? Os produtos que usam esta categoria ficam sem categoria.`,
    toastAtualizado: 'Categoria atualizada.',
    toastEliminado: 'Categoria eliminada.',
    toastCriado: 'Categoria criada.',
    toastJaExistia: 'Já existia uma categoria com esse nome; foi selecionada.',
    erroAtualizar: 'Não foi possível atualizar a categoria.',
    erroEliminar: 'Não foi possível eliminar a categoria.',
    erroCriar: 'Não foi possível criar a categoria.',
    erroNomeVazio: 'Informe o nome da categoria.',
  },
  termos_pesquisa: {
    tituloPainel: 'Termos de pesquisa',
    placeholderCelula: 'Selecionar termo…',
    placeholderFiltro: 'Buscar ou criar termo…',
    placeholderForm: 'Buscar termo…',
    placeholderEdicao: 'Nome do termo',
    apiBase: '/api/produtos/termos-de-pesquisa',
    apiItem: (id) => `/api/produtos/termos-de-pesquisa/${id}`,
    labelEliminarConfirm: (nome) =>
      `Eliminar o termo «${nome}»? Será removido de todos os produtos que o usam.`,
    toastAtualizado: 'Termo atualizado.',
    toastEliminado: 'Termo eliminado.',
    toastCriado: 'Termo criado.',
    toastJaExistia: 'Já existia; termo selecionado.',
    erroAtualizar: 'Não foi possível atualizar o termo.',
    erroEliminar: 'Não foi possível eliminar o termo.',
    erroCriar: 'Não foi possível criar o termo.',
    erroNomeVazio: 'Informe o nome do termo.',
  },
}

/** @deprecated use CONFIGS_SELECAO_UNICA.categoria */
export const CONFIG_SELECAO_UNICA = CONFIGS_SELECAO_UNICA.categoria
