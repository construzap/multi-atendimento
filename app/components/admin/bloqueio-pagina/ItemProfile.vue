<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { toast } from 'vue-sonner'
import type { AdminBloqueioProfileItem } from '#shared/types/adminBloqueioPagina'
import type { WorkspacePaginaColuna } from '~/components/admin/bloqueio-pagina/paginasWorkspace'
import { useAdminBloqueioPaginaStore } from '~/stores/adminBloqueioPagina'
import { mensagemErroFetch } from '~/stores/canais'

const props = defineProps<{
  profile: AdminBloqueioProfileItem
  paginas: WorkspacePaginaColuna[]
}>()

const adminStore = useAdminStore()
const bloqueioStore = useAdminBloqueioPaginaStore()
const { selectedWorkspaceId } = storeToRefs(adminStore)

const nomeExibicao = computed(
  () => props.profile.full_name?.trim() || props.profile.email?.trim() || 'Sem nome',
)

const papelLabel = computed(() => (props.profile.is_owner ? 'Dono' : 'Membro'))

/** Estado dos toggles — inicia a partir do Pinia (`page_roles`). */
const toggles = reactive<Record<string, boolean>>({})

function sincronizarTogglesDoStore() {
  for (const p of props.paginas) {
    toggles[p.slug] = bloqueioStore.isPageEnabled(props.profile.profile_id, p.slug)
  }
}

watch(
  [
    () => props.profile.profile_id,
    () => props.paginas.map((p) => p.slug).join(','),
    () => bloqueioStore.pageRoles,
  ],
  () => {
    sincronizarTogglesDoStore()
  },
  { immediate: true, deep: true },
)

async function onToggle(slug: string, event: Event) {
  const target = event.target as HTMLInputElement | null
  const enabled = Boolean(target?.checked)
  const anterior = Boolean(toggles[slug])

  const profileId = props.profile.profile_id
  const wsRaw = selectedWorkspaceId.value
  const workspaceId = wsRaw ? Number.parseInt(wsRaw, 10) : NaN

  if (profileId == null || !Number.isFinite(workspaceId) || workspaceId < 1) {
    toast.error('Profile ou workspace inválido.')
    if (target) target.checked = anterior
    toggles[slug] = anterior
    return
  }

  if (bloqueioStore.isToggling(profileId, slug)) {
    if (target) target.checked = anterior
    toggles[slug] = anterior
    return
  }

  toggles[slug] = enabled

  try {
    await bloqueioStore.togglePage({
      workspaceId,
      profileId,
      page: slug,
      enabled,
    })
  } catch (err) {
    toggles[slug] = anterior
    if (target) target.checked = anterior
    toast.error(mensagemErroFetch(err, 'Não foi possível atualizar a permissão.'))
  }
}
</script>

<template>
  <tr class="border-b border-outline/20 last:border-b-0 dark:border-dark-outline/20">
    <td class="sticky left-0 z-10 min-w-[14rem] bg-surface-container-lowest px-4 py-3 dark:bg-dark-surface-container-low">
      <p class="truncate text-sm font-semibold text-on-surface dark:text-dark-on-surface">
        {{ nomeExibicao }}
      </p>
      <p class="mt-0.5 truncate text-xs text-on-surface-variant dark:text-dark-on-surface-variant">
        {{ profile.email || profile.whatsapp || '—' }}
      </p>
    </td>

    <td class="whitespace-nowrap px-3 py-3 text-center">
      <span
        class="inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-semibold"
        :class="
          profile.is_owner
            ? 'bg-primary-500/15 text-primary-700 dark:text-dark-primary'
            : 'bg-amber-500/15 text-amber-800 dark:text-amber-300'
        "
      >
        {{ papelLabel }}
      </span>
    </td>

    <td
      v-for="pagina in paginas"
      :key="pagina.slug"
      class="px-2 py-3 text-center"
    >
      <label
        class="inline-flex cursor-pointer items-center justify-center"
        :class="
          bloqueioStore.isToggling(profile.profile_id, pagina.slug) || !profile.profile_id
            ? 'pointer-events-none opacity-50'
            : ''
        "
        :title="pagina.label"
      >
        <span class="sr-only">{{ pagina.label }}</span>
        <input
          type="checkbox"
          class="peer sr-only"
          :checked="Boolean(toggles[pagina.slug])"
          :disabled="!profile.profile_id || bloqueioStore.isToggling(profile.profile_id, pagina.slug)"
          @change="onToggle(pagina.slug, $event)"
        />
        <span
          class="relative h-5 w-9 rounded-full bg-outline/40 transition-colors peer-checked:bg-primary-500 peer-focus-visible:ring-2 peer-focus-visible:ring-primary-300 dark:bg-dark-outline/50 dark:peer-checked:bg-primary-500"
          aria-hidden="true"
        >
          <span
            class="absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform"
            :class="toggles[pagina.slug] ? 'translate-x-4' : 'translate-x-0'"
          />
        </span>
      </label>
    </td>
  </tr>
</template>
