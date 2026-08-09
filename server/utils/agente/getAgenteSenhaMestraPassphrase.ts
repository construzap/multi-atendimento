import type { H3Event } from 'h3'

/**
 * Senha mestra para pgp_sym_encrypt/decrypt das API keys dos canais.
 *
 * Nuxt sobrescreve `runtimeConfig.agenteSenhaMestraEncriptografiaApiKey` com:
 *   NUXT_AGENTE_SENHA_MESTRA_ENCRIPTOGRAFIA_API_KEY
 *
 * O projeto também usa historicamente (typo):
 *   NUXT_AGENTE_SENHA_MESTRA_ENCRIPITOGRAFIA_API_KEY
 *
 * Lemos os dois + process.env para funcionar no Portainer sem depender do nome exato.
 */
export function getAgenteSenhaMestraPassphrase(event?: H3Event): string {
  const config = event ? useRuntimeConfig(event) : useRuntimeConfig()
  const fromConfig = String(config.agenteSenhaMestraEncriptografiaApiKey ?? '').trim()
  if (fromConfig) return fromConfig

  const fromEnv = String(
    process.env.NUXT_AGENTE_SENHA_MESTRA_ENCRIPTOGRAFIA_API_KEY ||
      process.env.NUXT_AGENTE_SENHA_MESTRA_ENCRIPITOGRAFIA_API_KEY ||
      process.env.AGENTE_SENHA_MESTRA_ENCRIPTOGRAFIA_API_KEY ||
      process.env.AGENTE_SENHA_MESTRA_ENCRIPITOGRAFIA_API_KEY ||
      '',
  ).trim()

  return fromEnv
}
