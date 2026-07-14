import { storeToRefs } from 'pinia'
import { useConversasStore } from '~/stores/conversas'

/**
 * Filtros da lista lateral de conversas (Pinia `conversas.filtros`).
 */
export function useConversasFiltros() {
  const conversasStore = useConversasStore()
  const {
    filtros,
    mostrarFechadas,
    mostrarGrupos,
    termoPesquisa,
    filtroKanbanFunilId,
    filtroKanbanColunaId,
    temFiltroKanbanAtivo,
  } = storeToRefs(conversasStore)

  return {
    conversasStore,
    filtros,
    mostrarFechadas,
    mostrarGrupos,
    termoPesquisa,
    filtroKanbanFunilId,
    filtroKanbanColunaId,
    temFiltroKanbanAtivo,
  }
}
