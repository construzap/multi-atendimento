/**
 * Fusos IANA oficiais usados no Brasil (lista fechada para validação no servidor).
 * @see https://www.gov.br/mre/pt-br/assuntos/portal-consular/servicos-ao-cidadao/informacoes-aos-viajantes
 */
export const IANA_TIMEZONES_BRASIL = [
  'America/Noronha',
  'America/Belem',
  'America/Fortaleza',
  'America/Recife',
  'America/Maceio',
  'America/Bahia',
  'America/Sao_Paulo',
  'America/Campo_Grande',
  'America/Cuiaba',
  'America/Porto_Velho',
  'America/Manaus',
  'America/Eirunepe',
  'America/Rio_Branco',
] as const

export type IanaFusoBrasil = (typeof IANA_TIMEZONES_BRASIL)[number]

export const OPCOES_FUSO_BRASIL: { value: IanaFusoBrasil; label: string }[] = [
  { value: 'America/Noronha', label: 'Noronha (UTC−2)' },
  { value: 'America/Belem', label: 'Pará (Belém)' },
  { value: 'America/Fortaleza', label: 'Ceará / RN / PB / PI / MA' },
  { value: 'America/Recife', label: 'Pernambuco' },
  { value: 'America/Maceio', label: 'Alagoas / Sergipe' },
  { value: 'America/Bahia', label: 'Bahia' },
  { value: 'America/Sao_Paulo', label: 'Sudeste / Sul / GO / DF' },
  { value: 'America/Campo_Grande', label: 'Mato Grosso do Sul' },
  { value: 'America/Cuiaba', label: 'Mato Grosso' },
  { value: 'America/Porto_Velho', label: 'Rondônia' },
  { value: 'America/Manaus', label: 'Amazonas (capital)' },
  { value: 'America/Eirunepe', label: 'Acre (Eirunepé)' },
  { value: 'America/Rio_Branco', label: 'Acre (Rio Branco)' },
]

export function isIanaFusoBrasilPermitido(tz: string): tz is IanaFusoBrasil {
  return (IANA_TIMEZONES_BRASIL as readonly string[]).includes(tz.trim())
}

/** Se o navegador reportar um dos fusos acima, usa-o; senão Brasília. */
export function defaultFusoDoNavegador(): IanaFusoBrasil {
  try {
    const z = Intl.DateTimeFormat().resolvedOptions().timeZone
    if ((IANA_TIMEZONES_BRASIL as readonly string[]).includes(z)) {
      return z as IanaFusoBrasil
    }
  } catch {
    /* ignore */
  }
  return 'America/Sao_Paulo'
}
