import type { LojaEndereco } from '#shared/types/loja'

export function formatarEnderecoLinhas(endereco: LojaEndereco): string[] {
  const ruaNum = [endereco.rua, endereco.numero].filter(Boolean).join(', ')
  const linhas: string[] = []
  if (endereco.apelido) linhas.push(endereco.apelido)
  if (ruaNum) linhas.push(ruaNum)
  if (endereco.complemento) linhas.push(endereco.complemento)
  if (endereco.bairro) linhas.push(endereco.bairro)
  const cidadeUf = [endereco.cidade, endereco.uf].filter(Boolean).join(' - ')
  if (cidadeUf) linhas.push(cidadeUf)
  if (endereco.cep) linhas.push(endereco.cep)
  return linhas
}

export function resumoEndereco(geo: {
  rua: string
  numero: string
  bairro: string
  cidade: string
  estado: string
}): { titulo: string; subtitulo: string } {
  const titulo = [geo.rua, geo.numero, geo.bairro].filter(Boolean).join(', ')
  const subtitulo = [geo.cidade, geo.estado].filter(Boolean).join(', ')
  return {
    titulo: titulo || 'Localização encontrada',
    subtitulo,
  }
}
