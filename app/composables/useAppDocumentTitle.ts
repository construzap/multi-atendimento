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

  const workspaceIdFromRoute = computed(() => {
    const raw = route.params.id
    const id = Array.isArray(raw) ? raw[0] : raw
    return id != null ? String(id).trim() : ''
  })

  const activeWorkspace = computed(() => {
    const idRaw = workspaces.currentWorkspaceId ?? workspaceIdFromRoute.value
    if (!idRaw) return null

    const n = Number.parseInt(String(idRaw), 10)
    if (!Number.isFinite(n)) return null

    return workspaces.items.find((w) => w.id === n) ?? null
  })

  function ensureWorkspacesForTitle() {
    if (!/^\/workspaces\/[^/]+/.test(route.path)) return
    workspaces.ensureAllLoaded().catch(() => {})
  }

  if (import.meta.client) {
    onMounted(ensureWorkspacesForTitle)
    watch(() => route.path, ensureWorkspacesForTitle)
  }

  const documentTitle = computed(() => {
    const name = appName.value
    const inWorkspaceRoute = /^\/workspaces\/[^/]+/.test(route.path)
    if (!inWorkspaceRoute) return name

    const wsNome = activeWorkspace.value?.nome?.trim()
    if (wsNome) return `${name} · ${wsNome}`
    return name
  })

  useHead({
    title: documentTitle,
  })

  return { appName, documentTitle }
}
