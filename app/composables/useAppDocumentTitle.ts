/**
 * Título da aba do navegador a partir de `NUXT_PUBLIC_APP_NAME`.
 * Em `/workspaces/:id…` → `{appName} · {nome do workspace}`.
 * Nas demais rotas → `{appName}`.
 */
export function useAppDocumentTitle() {
  const config = useRuntimeConfig()
  const route = useRoute()
  const workspaces = useWorkspacesStore()

  const appName = computed(() => {
    const raw = String(config.public.appName ?? '').trim()
    return raw || 'ConstruZap'
  })

  const documentTitle = computed(() => {
    const name = appName.value
    const inWorkspaceRoute = /^\/workspaces\/[^/]+/.test(route.path)
    if (!inWorkspaceRoute) return name

    const wsNome = workspaces.currentWorkspace?.nome?.trim()
    if (wsNome) return `${name} · ${wsNome}`
    return name
  })

  useHead({
    title: documentTitle,
  })

  return { appName, documentTitle }
}
