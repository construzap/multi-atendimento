import { serverSupabaseClient, serverSupabaseServiceRole } from '#supabase/server'
import { assertMethod, createError, readBody, type H3Event } from 'h3'
import type { ProdutoAtualizarPlanilhaLinha } from '#shared/types/produtos'
import { normalizarCodigoBarras, normalizarCodigoExterno } from '#shared/utils/normalizarCodigoProduto'
import { checkLimiteProdutos } from './checkLimiteProdutos'
import { checkWorkspace } from './checkWorkspace'
import { getAuthUserId } from './getAuthUserId'
import { dadosDaLinha, type DadosPlanilha } from './produtoPlanilhaAtualizar'
import { inserirTermosVinculoLote, resolverTermosDoLoteImportacao } from './produtoTermosPesquisa'

export const MAX_LINHAS_LOTE_PLANILHA = 100

type Admin = { from: (table: string) => any }

export type ResumoLotePlanilha = {
  atualizados: number
  criados: number
}

type ProdutoAchado = {
  id: number
  nome: string
  codigo: string | null
  codigo_barras_ean: string | null
  tabelageral_id: number | null
}

type Catalogo = {
  id: number
  codigo_barras: string
  nome: string | null
  imagem_url: string | null
  categoria: string | null
}

type Criacao = {
  row: Record<string, unknown>
  termos: string[]
}

type Body = {
  workspace_id?: unknown
  linhas?: unknown
}

function parseWorkspaceId(raw: unknown): number {
  const n =
    typeof raw === 'number' && Number.isInteger(raw)
      ? raw
      : Number.parseInt(String(raw ?? '').trim(), 10)
  if (!Number.isFinite(n) || !Number.isInteger(n) || n < 1) {
    throw createError({ statusCode: 400, statusMessage: 'workspace_id inválido.' })
  }
  return n
}

export async function abrirLotePlanilha(event: H3Event): Promise<{
  admin: Admin
  workspaceId: number
  linhas: ProdutoAtualizarPlanilhaLinha[]
}> {
  assertMethod(event, 'POST')

  const client = await serverSupabaseClient(event)
  const { data: authData, error: authError } = await client.auth.getUser()
  if (authError || !authData.user) {
    throw createError({ statusCode: 401, statusMessage: 'Não autenticado' })
  }
  const userId = getAuthUserId(authData.user)
  if (!userId) throw createError({ statusCode: 401, statusMessage: 'Não autenticado' })

  const body = (await readBody<Body>(event).catch(() => null)) ?? {}
  const workspaceId = parseWorkspaceId(body.workspace_id)
  if (!Array.isArray(body.linhas)) {
    throw createError({ statusCode: 400, statusMessage: 'linhas deve ser um array.' })
  }
  if (body.linhas.length === 0) {
    throw createError({ statusCode: 400, statusMessage: 'Envie pelo menos uma linha.' })
  }
  if (body.linhas.length > MAX_LINHAS_LOTE_PLANILHA) {
    throw createError({
      statusCode: 400,
      statusMessage: `No máximo ${MAX_LINHAS_LOTE_PLANILHA} linhas por requisição.`,
    })
  }

  await checkWorkspace(event, workspaceId, userId)
  const admin = serverSupabaseServiceRole<any>(event)
  const linhas = body.linhas.filter((item) => item && typeof item === 'object') as ProdutoAtualizarPlanilhaLinha[]
  return { admin, workspaceId, linhas }
}

async function buscarPaginado(
  consultar: (inicio: number, fim: number) => PromiseLike<{ data: unknown[] | null; error: { message: string } | null }>,
): Promise<Record<string, unknown>[]> {
  const tamanho = 1000
  const todos: Record<string, unknown>[] = []
  for (let inicio = 0; inicio <= 20000; inicio += tamanho) {
    const { data, error } = await consultar(inicio, inicio + tamanho - 1)
    if (error) throw createError({ statusCode: 500, statusMessage: error.message })
    const pagina = (data ?? []) as Record<string, unknown>[]
    todos.push(...pagina)
    if (pagina.length < tamanho) break
  }
  return todos
}

function produtoDe(raw: Record<string, unknown>): ProdutoAchado | null {
  const id = Number(raw.id)
  if (!Number.isFinite(id)) return null
  const tg = raw.tabelageral_id == null ? null : Number(raw.tabelageral_id)
  return {
    id,
    nome: String(raw.nome ?? ''),
    codigo: normalizarCodigoExterno(raw.codigo),
    codigo_barras_ean: raw.codigo_barras_ean == null ? null : String(raw.codigo_barras_ean),
    tabelageral_id: tg != null && Number.isFinite(tg) ? tg : null,
  }
}

async function mapaCategorias(admin: Admin, workspaceId: number): Promise<Map<string, number>> {
  const { data, error } = await admin
    .from('produto_categorias')
    .select('id, nome')
    .eq('workspace_id', workspaceId)
    .eq('ativo', true)
  if (error) throw createError({ statusCode: 500, statusMessage: error.message })
  const map = new Map<string, number>()
  for (const raw of data ?? []) {
    const row = raw as { id?: unknown; nome?: unknown }
    const nome = String(row.nome ?? '').trim().toLowerCase()
    const id = Number(row.id)
    if (!nome || !Number.isFinite(id) || map.has(nome)) continue
    map.set(nome, id)
  }
  return map
}

function idCategoria(map: Map<string, number>, nome: string | undefined): number | null {
  if (!nome) return null
  return map.get(nome.trim().toLowerCase()) ?? null
}

function camposDaPlanilha(
  dados: DadosPlanilha,
  categoriaId: number | null,
  incluirNomeCategoria: boolean,
): Record<string, unknown> {
  const destino: Record<string, unknown> = {}
  if (incluirNomeCategoria && dados.nome) destino.nome = dados.nome
  if (incluirNomeCategoria && categoriaId) destino.categoria_id = categoriaId
  if (dados.codigo) destino.codigo = dados.codigo
  if (dados.codigo_barras_ean) destino.codigo_barras_ean = dados.codigo_barras_ean
  if (dados.sku) destino.sku = dados.sku
  if (dados.unidade_venda) destino.unidade_venda = dados.unidade_venda
  if (dados.marca) destino.marca = dados.marca
  if (dados.imagem_url) destino.imagem_url = dados.imagem_url
  if (dados.infos_relevantes) destino.infos_relevantes = dados.infos_relevantes
  if (dados.preco != null) destino.preco = dados.preco
  if (dados.preco_prazo != null) destino.preco_prazo = dados.preco_prazo
  if (dados.peso_kg != null) destino.peso_kg = dados.peso_kg
  if (dados.estoque != null) destino.estoque = dados.estoque
  if (dados.status != null) destino.status = dados.status
  return destino
}

function linhaNova(workspaceId: number, nome: string): Record<string, unknown> {
  return {
    workspace_id: workspaceId,
    nome,
    codigo: null,
    codigo_barras_ean: null,
    categoria_id: null,
    sku: null,
    unidade_venda: null,
    marca: null,
    preco: null,
    preco_prazo: null,
    peso_kg: null,
    estoque: null,
    imagem_url: null,
    infos_relevantes: null,
    status: true,
    envia_foto: true,
    preco_custo: 0,
    largura: 0,
    altura: 0,
    comprimento: 0,
    nao_encontrado: false,
    aguardando_escolha: false,
    tabelageral_id: null,
    dados_atualizacao: null,
  }
}

async function gravarAtualizacoes(admin: Admin, atualizacoes: Map<number, Record<string, unknown>>) {
  if (!atualizacoes.size) return
  const agora = new Date().toISOString()
  const grupos = new Map<string, Record<string, unknown>[]>()
  for (const row of atualizacoes.values()) {
    row.updated_at = agora
    const chave = Object.keys(row).sort().join('\0')
    const lista = grupos.get(chave) ?? []
    lista.push(row)
    grupos.set(chave, lista)
  }
  for (const rows of grupos.values()) {
    const { error } = await admin.from('produtos_workspace').upsert(rows, {
      onConflict: 'id',
      defaultToNull: false,
    })
    if (error) throw createError({ statusCode: 500, statusMessage: error.message })
  }
}

async function gravarCriacoes(
  admin: Admin,
  criacoes: Criacao[],
): Promise<{ id: number; termos: string[] }[]> {
  if (!criacoes.length) return []
  const { data, error } = await admin
    .from('produtos_workspace')
    .insert(criacoes.map((c) => c.row))
    .select('id')
  if (error) throw createError({ statusCode: 500, statusMessage: error.message })
  const inseridos = (data ?? []) as { id?: unknown }[]
  if (inseridos.length !== criacoes.length) {
    throw createError({ statusCode: 500, statusMessage: 'Falha ao gravar produtos novos.' })
  }
  return inseridos.map((row, i) => ({
    id: Number(row.id),
    termos: criacoes[i]?.termos ?? [],
  }))
}

async function ligarTermos(
  admin: Admin,
  workspaceId: number,
  pares: { produtoId: number; termos: string[] }[],
) {
  const nomes = [
    ...new Set(pares.flatMap((p) => p.termos.map((t) => t.trim()).filter((t) => t.length > 0))),
  ]
  if (!nomes.length) return
  const mapa = await resolverTermosDoLoteImportacao(admin, workspaceId, nomes)
  const rows: { produto_id: number; termo_id: number }[] = []
  for (const par of pares) {
    if (!Number.isFinite(par.produtoId) || par.produtoId < 1) continue
    for (const nome of par.termos) {
      const termoId = mapa.get(nome.trim().toLowerCase())
      if (termoId) rows.push({ produto_id: par.produtoId, termo_id: termoId })
    }
  }
  await inserirTermosVinculoLote(admin, rows)
}

function garantirUpdate(
  atualizacoes: Map<number, Record<string, unknown>>,
  produto: ProdutoAchado,
  workspaceId: number,
  campos: Record<string, unknown>,
  nomeFinal: string,
) {
  const atual = atualizacoes.get(produto.id) ?? {
    id: produto.id,
    workspace_id: workspaceId,
    nome: produto.nome,
    nao_encontrado: false,
  }
  Object.assign(atual, campos)
  atual.id = produto.id
  atual.workspace_id = workspaceId
  atual.nao_encontrado = false
  atual.nome = nomeFinal || produto.nome || 'Produto'
  atualizacoes.set(produto.id, atual)
}

/**
 * Planilha mapeada só com `codigo`.
 * Acha o produto pai do workspace por esse código.
 * Se achar, atualiza os outros campos e mantém o nome e a categoria que já estão no produto.
 * Se não achar, cria.
 */
export async function processarLotePorCodigo(
  event: H3Event,
  admin: Admin,
  workspaceId: number,
  linhas: ProdutoAtualizarPlanilhaLinha[],
): Promise<ResumoLotePlanilha> {
  const preparados = linhas
    .map((linha) => ({ dados: dadosDaLinha(linha), codigo: normalizarCodigoExterno(linha.codigo) }))
    .filter((item): item is { dados: DadosPlanilha; codigo: string } => !!item.codigo)

  const codigos = [...new Set(preparados.map((p) => p.codigo))]
  const produtos = codigos.length
    ? await buscarPaginado((inicio, fim) =>
        admin
          .from('produtos_workspace')
          .select('id, nome, codigo')
          .eq('workspace_id', workspaceId)
          .is('parent_id', null)
          .eq('aguardando_escolha', false)
          .in('codigo', codigos)
          .order('id', { ascending: true })
          .range(inicio, fim),
      )
    : []

  const porCodigo = new Map<string, ProdutoAchado[]>()
  for (const raw of produtos) {
    const produto = produtoDe(raw)
    if (!produto?.codigo) continue
    const lista = porCodigo.get(produto.codigo) ?? []
    lista.push(produto)
    porCodigo.set(produto.codigo, lista)
  }

  let categorias: Map<string, number> | null = null
  async function catIdDe(nome: string | undefined): Promise<number | null> {
    if (!nome) return null
    if (!categorias) categorias = await mapaCategorias(admin, workspaceId)
    return idCategoria(categorias, nome)
  }

  const atualizacoes = new Map<number, Record<string, unknown>>()
  const termosUpdate = new Map<number, string[]>()
  const criacoes = new Map<string, Criacao>()

  for (const item of preparados) {
    const achados = porCodigo.get(item.codigo) ?? []
    if (achados.length) {
      const campos = camposDaPlanilha(item.dados, null, false)
      for (const produto of achados) {
        garantirUpdate(atualizacoes, produto, workspaceId, campos, produto.nome)
        if (item.dados.termos_pesquisa?.length) termosUpdate.set(produto.id, item.dados.termos_pesquisa)
      }
      continue
    }

    const existente = criacoes.get(item.codigo)
    const catId = await catIdDe(item.dados.categoria)
    if (existente) {
      Object.assign(existente.row, camposDaPlanilha(item.dados, catId, true))
      existente.row.codigo = item.codigo
      if (item.dados.nome) existente.row.nome = item.dados.nome
      if (item.dados.termos_pesquisa?.length) existente.termos = item.dados.termos_pesquisa
      continue
    }

    const row = linhaNova(workspaceId, item.dados.nome || `Produto ${item.codigo}`)
    Object.assign(row, camposDaPlanilha(item.dados, catId, true))
    row.codigo = item.codigo
    row.nome = item.dados.nome || `Produto ${item.codigo}`
    criacoes.set(item.codigo, { row, termos: item.dados.termos_pesquisa ?? [] })
  }

  await gravarAtualizacoes(admin, atualizacoes)

  const listaCriacao = [...criacoes.values()]
  if (listaCriacao.length) await checkLimiteProdutos(event, workspaceId, listaCriacao.length)
  const inseridos = await gravarCriacoes(admin, listaCriacao)

  const pares = [
    ...[...termosUpdate.entries()].map(([produtoId, termos]) => ({ produtoId, termos })),
    ...inseridos.filter((row) => row.termos.length).map((row) => ({ produtoId: row.id, termos: row.termos })),
  ]
  await ligarTermos(admin, workspaceId, pares)

  return { atualizados: atualizacoes.size, criados: listaCriacao.length }
}

function escolherCatalogo(lista: Catalogo[]): Catalogo | null {
  if (!lista.length) return null
  return lista.find((c) => c.nome) ?? lista.find((c) => c.imagem_url) ?? lista[0] ?? null
}

function juntarCatalogo(dados: DadosPlanilha, cat: Catalogo | null): DadosPlanilha {
  const out: DadosPlanilha = { ...dados }
  if (!out.nome && cat?.nome) out.nome = cat.nome
  if (!out.imagem_url && cat?.imagem_url) out.imagem_url = cat.imagem_url
  if (!out.categoria && cat?.categoria) out.categoria = cat.categoria
  if (!out.codigo_barras_ean && cat?.codigo_barras) out.codigo_barras_ean = cat.codigo_barras
  return out
}

/**
 * Planilha mapeada só com código de barras.
 * Busca nome, foto e categoria na `tabelageral` e junta com a linha.
 * Se o workspace já tem produto pai com essa barra, atualiza. Senão, cria.
 */
export async function processarLotePorCodigoBarras(
  event: H3Event,
  admin: Admin,
  workspaceId: number,
  linhas: ProdutoAtualizarPlanilhaLinha[],
): Promise<ResumoLotePlanilha> {
  const preparados = linhas
    .map((linha) => ({
      dados: dadosDaLinha(linha),
      norma: normalizarCodigoBarras(linha.codigo_barras_ean),
    }))
    .filter((item): item is { dados: DadosPlanilha; norma: string } => !!item.norma)

  const normas = [...new Set(preparados.map((p) => p.norma))]
  const catalogoPorNorma = new Map<string, Catalogo[]>()
  if (normas.length) {
    const rows = await buscarPaginado((inicio, fim) =>
      admin
        .from('tabelageral')
        .select('id, codigo_barras, codigo_barras_norm, nome, imagem_url, categoria')
        .in('codigo_barras_norm', normas)
        .order('id', { ascending: true })
        .range(inicio, fim),
    )
    for (const raw of rows) {
      const id = Number(raw.id)
      const norma = String(raw.codigo_barras_norm ?? '')
      if (!Number.isFinite(id) || !norma) continue
      const lista = catalogoPorNorma.get(norma) ?? []
      const nome = raw.nome == null ? null : String(raw.nome).trim() || null
      const imagem = raw.imagem_url == null ? null : String(raw.imagem_url).trim() || null
      const categoria = raw.categoria == null ? null : String(raw.categoria).trim() || null
      lista.push({
        id,
        codigo_barras: String(raw.codigo_barras ?? ''),
        nome,
        imagem_url: imagem,
        categoria,
      })
      catalogoPorNorma.set(norma, lista)
    }
  }

  const idParaNorma = new Map<number, string>()
  for (const [norma, lista] of catalogoPorNorma) {
    for (const cat of lista) idParaNorma.set(cat.id, norma)
  }

  const barrasTexto = [
    ...new Set(
      preparados
        .flatMap((p) => {
          const cat = escolherCatalogo(catalogoPorNorma.get(p.norma) ?? [])
          return [p.dados.codigo_barras_ean, cat?.codigo_barras]
        })
        .filter((v): v is string => !!v),
    ),
  ]
  const idsCatalogo = [...idParaNorma.keys()]

  const porId = new Map<number, ProdutoAchado>()
  async function puxar(aplicar: (q: any) => any) {
    const rows = await buscarPaginado((inicio, fim) =>
      aplicar(
        admin
          .from('produtos_workspace')
          .select('id, nome, codigo, codigo_barras_ean, tabelageral_id')
          .eq('workspace_id', workspaceId)
          .is('parent_id', null)
          .eq('aguardando_escolha', false),
      )
        .order('id', { ascending: true })
        .range(inicio, fim),
    )
    for (const raw of rows) {
      const produto = produtoDe(raw)
      if (produto) porId.set(produto.id, produto)
    }
  }
  if (idsCatalogo.length) await puxar((q) => q.in('tabelageral_id', idsCatalogo))
  if (barrasTexto.length) await puxar((q) => q.in('codigo_barras_ean', barrasTexto))

  const normasSet = new Set(normas)
  const porNorma = new Map<string, ProdutoAchado[]>()
  function registrar(norma: string | null, produto: ProdutoAchado) {
    if (!norma || !normasSet.has(norma)) return
    const lista = porNorma.get(norma) ?? []
    if (!lista.some((p) => p.id === produto.id)) lista.push(produto)
    porNorma.set(norma, lista)
  }
  for (const produto of porId.values()) {
    if (produto.tabelageral_id != null) registrar(idParaNorma.get(produto.tabelageral_id) ?? null, produto)
    registrar(normalizarCodigoBarras(produto.codigo_barras_ean), produto)
  }

  let categorias: Map<string, number> | null = null
  async function catIdDe(nome: string | undefined): Promise<number | null> {
    if (!nome) return null
    if (!categorias) categorias = await mapaCategorias(admin, workspaceId)
    return idCategoria(categorias, nome)
  }

  const atualizacoes = new Map<number, Record<string, unknown>>()
  const termosUpdate = new Map<number, string[]>()
  const criacoes = new Map<string, Criacao>()

  for (const item of preparados) {
    const catalogo = escolherCatalogo(catalogoPorNorma.get(item.norma) ?? [])
    const juntos = juntarCatalogo(item.dados, catalogo)
    const catId = await catIdDe(juntos.categoria)
    const campos = camposDaPlanilha(juntos, catId, true)
    if (catalogo) campos.tabelageral_id = catalogo.id

    const achados = porNorma.get(item.norma) ?? []
    if (achados.length) {
      for (const produto of achados) {
        const nomeFinal = typeof campos.nome === 'string' && campos.nome ? campos.nome : produto.nome
        garantirUpdate(atualizacoes, produto, workspaceId, campos, nomeFinal)
        if (juntos.termos_pesquisa?.length) termosUpdate.set(produto.id, juntos.termos_pesquisa)
      }
      continue
    }

    const existente = criacoes.get(item.norma)
    if (existente) {
      Object.assign(existente.row, campos)
      if (juntos.nome) existente.row.nome = juntos.nome
      if (juntos.termos_pesquisa?.length) existente.termos = juntos.termos_pesquisa
      continue
    }

    const row = linhaNova(workspaceId, juntos.nome || 'Produto')
    Object.assign(row, campos)
    row.nome = juntos.nome || 'Produto'
    if (!row.codigo_barras_ean) row.codigo_barras_ean = item.dados.codigo_barras_ean || catalogo?.codigo_barras || null
    criacoes.set(item.norma, { row, termos: juntos.termos_pesquisa ?? [] })
  }

  await gravarAtualizacoes(admin, atualizacoes)

  const listaCriacao = [...criacoes.values()]
  if (listaCriacao.length) await checkLimiteProdutos(event, workspaceId, listaCriacao.length)
  const inseridos = await gravarCriacoes(admin, listaCriacao)

  const pares = [
    ...[...termosUpdate.entries()].map(([produtoId, termos]) => ({ produtoId, termos })),
    ...inseridos.filter((row) => row.termos.length).map((row) => ({ produtoId: row.id, termos: row.termos })),
  ]
  await ligarTermos(admin, workspaceId, pares)

  return { atualizados: atualizacoes.size, criados: listaCriacao.length }
}
