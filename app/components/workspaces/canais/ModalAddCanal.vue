<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { faWhatsapp } from '@fortawesome/free-brands-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome'
import { toast } from 'vue-sonner'
import BaseButton from '~/components/BaseButton.vue'
import BaseInput from '~/components/BaseInput.vue'
import BaseModal from '~/components/BaseModal.vue'
import type { CanalCriado } from '~/stores/canais'
import type { Canal, CanalHorarioDia, CanalHorarios } from '#shared/types/canal'

type DiaHorarioKey = keyof CanalHorarios

type HorarioDia = CanalHorarioDia

const DIAS_HORARIO: { key: DiaHorarioKey; label: string }[] = [
  { key: 'semana', label: 'Segunda a sexta' },
  { key: 'sabado', label: 'Sábado' },
  { key: 'domingo', label: 'Domingo' },
]

function horarioDiaPadrao(partial?: Partial<HorarioDia>): HorarioDia {
  return {
    aberto: partial?.aberto ?? true,
    inicio: partial?.inicio ?? '',
    inicioAlmoco: partial?.inicioAlmoco ?? '',
    fimAlmoco: partial?.fimAlmoco ?? '',
    fim: partial?.fim ?? '',
  }
}

function horariosPadrao(): Record<DiaHorarioKey, HorarioDia> {
  return {
    semana: horarioDiaPadrao({
      aberto: true,
      inicio: '07:30',
      inicioAlmoco: '12:00',
      fimAlmoco: '13:30',
      fim: '17:30',
    }),
    sabado: horarioDiaPadrao({
      aberto: true,
      inicio: '08:00',
      fim: '13:00',
    }),
    domingo: horarioDiaPadrao({
      aberto: false,
      inicio: '08:00',
      fim: '12:00',
    }),
  }
}

function normalizarHorarioParaInput(valor: unknown): string {
  if (typeof valor !== 'string') return ''
  const t = valor.trim()
  if (!t) return ''
  const match = /^(\d{2}:\d{2})/.exec(t)
  return match ? match[1] : t
}

function normalizarBooleano(valor: unknown, fallback: boolean): boolean {
  if (typeof valor === 'boolean') return valor
  if (valor === 'true') return true
  if (valor === 'false') return false
  return fallback
}

function horariosFromCanal(raw: CanalHorarios | null | undefined): Record<DiaHorarioKey, HorarioDia> {
  const padrao = horariosPadrao()
  if (!raw) return padrao

  const cloneDia = (dia: CanalHorarioDia | undefined, fallback: HorarioDia): HorarioDia => ({
    aberto: normalizarBooleano(dia?.aberto, fallback.aberto),
    inicio: normalizarHorarioParaInput(dia?.inicio) || fallback.inicio,
    inicioAlmoco: normalizarHorarioParaInput(dia?.inicioAlmoco),
    fimAlmoco: normalizarHorarioParaInput(dia?.fimAlmoco),
    fim: normalizarHorarioParaInput(dia?.fim) || fallback.fim,
  })

  return {
    semana: cloneDia(raw.semana, padrao.semana),
    sabado: cloneDia(raw.sabado, padrao.sabado),
    domingo: cloneDia(raw.domingo, padrao.domingo),
  }
}

function formatarCoordenada(valor: number | null | undefined): string {
  if (valor == null || !Number.isFinite(valor)) return ''
  return String(valor)
}

function formatarDataCriacao(iso: string | null | undefined): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d)
}

const props = withDefaults(
  defineProps<{
    open: boolean
    /** Workspace atual (rota /workspaces/[id]/canais ou contexto do chat). */
    workspaceId: number
    /** `create`: fluxo atual. `edit`: preenche com dados do Pinia. */
    mode?: 'create' | 'edit'
    /** Id do canal em edição — dados lidos de `canaisStore.items`. */
    canalEdicaoId?: number | null
  }>(),
  {
    mode: 'create',
    canalEdicaoId: null
  }
)

const emit = defineEmits<{
  'update:open': [value: boolean]
  criado: [payload: CanalCriado]
}>()

const canaisStore = useCanaisStore()

const isOpen = computed({
  get: () => props.open,
  set: (v: boolean) => emit('update:open', v)
})

const isEdit = computed(() => props.mode === 'edit')

/** Canal em edição — sempre resolvido a partir de `canaisStore.items`. */
const canalPinia = computed((): Canal | null => {
  const id = props.canalEdicaoId
  if (!isEdit.value || id == null) return null
  return canaisStore.items.find((c) => c.id === id) ?? null
})

const createdAtLabel = computed(() => formatarDataCriacao(canalPinia.value?.created_at))

const fieldIdSuffix = computed(() =>
  isEdit.value ? `edit-${props.canalEdicaoId ?? 'canal'}` : 'create',
)

const nome = ref('')
const descricao = ref('')
const endereco = ref('')
const latitude = ref('')
const longitude = ref('')
const tempoAvisoMinutos = ref('30')
const horarios = ref(horariosPadrao())

function normalizarCoordenadaTexto(valor: string): string {
  return valor.trim().replace(',', '.').replace('−', '-')
}

function parseCoordenadaFormulario(valor: string, min: number, max: number): number | null {
  const n = Number.parseFloat(normalizarCoordenadaTexto(valor))
  if (!Number.isFinite(n) || n < min || n > max) return null
  return n
}

function buildConfigPayload():
  | {
      endereco: string
      latitude: number
      longitude: number
      tempo_aviso_minutos: number
      horarios: CanalHorarios
    }
  | string {
  const end = endereco.value.trim()
  if (!end) return 'Informe o endereço da loja.'

  const lat = parseCoordenadaFormulario(latitude.value, -90, 90)
  if (lat == null) return 'Latitude inválida (entre -90 e 90).'

  const lng = parseCoordenadaFormulario(longitude.value, -180, 180)
  if (lng == null) return 'Longitude inválida (entre -180 e 180).'

  const aviso = Number.parseInt(tempoAvisoMinutos.value.trim(), 10)
  if (!tempoAvisoMinutos.value.trim() || !Number.isFinite(aviso) || aviso < 0) {
    return 'Informe o tempo de aviso em minutos (número válido).'
  }

  const erroHorarios = validarCamposExtras()
  if (erroHorarios) return erroHorarios

  return {
    endereco: end,
    latitude: lat,
    longitude: lng,
    tempo_aviso_minutos: aviso,
    horarios: {
      semana: { ...horarios.value.semana },
      sabado: { ...horarios.value.sabado },
      domingo: { ...horarios.value.domingo },
    },
  }
}

function resetarCamposExtras() {
  endereco.value = ''
  latitude.value = ''
  longitude.value = ''
  tempoAvisoMinutos.value = '30'
  horarios.value = horariosPadrao()
}

function preencherDoPinia() {
  if (!isEdit.value) {
    nome.value = ''
    descricao.value = ''
    resetarCamposExtras()
    return
  }

  const canal = canalPinia.value
  if (!canal) {
    limparFormulario()
    return
  }

  nome.value = canal.nome?.trim() ?? ''
  descricao.value = canal.descricao?.trim() ?? ''
  endereco.value = canal.endereco?.trim() ?? ''
  latitude.value = formatarCoordenada(canal.latitude)
  longitude.value = formatarCoordenada(canal.longitude)
  tempoAvisoMinutos.value = String(canal.tempo_aviso_minutos ?? 30)
  horarios.value = horariosFromCanal(canal.horarios)
}

function limparFormulario() {
  nome.value = ''
  descricao.value = ''
  resetarCamposExtras()
}

watch(isOpen, (aberto) => {
  if (aberto) {
    preencherDoPinia()
  } else {
    limparFormulario()
  }
})

watch(
  () => [props.mode, props.canalEdicaoId, canalPinia.value] as const,
  () => {
    if (isOpen.value) preencherDoPinia()
  },
  { deep: true }
)

function horarioValido(valor: string): boolean {
  return /^\d{2}:\d{2}$/.test(valor.trim())
}

function coordenadaValida(valor: string, min: number, max: number): boolean {
  return parseCoordenadaFormulario(valor, min, max) != null
}

function validarCamposExtras(): string | null {
  if (!endereco.value.trim()) return 'Informe o endereço da loja.'

  if (!latitude.value.trim()) return 'Informe a latitude.'
  if (!coordenadaValida(latitude.value, -90, 90)) return 'Latitude inválida (entre -90 e 90).'

  if (!longitude.value.trim()) return 'Informe a longitude.'
  if (!coordenadaValida(longitude.value, -180, 180)) return 'Longitude inválida (entre -180 e 180).'

  const aviso = Number.parseInt(tempoAvisoMinutos.value, 10)
  if (!tempoAvisoMinutos.value.trim() || !Number.isFinite(aviso) || aviso < 0) {
    return 'Informe o tempo de aviso em minutos (número válido).'
  }

  for (const { key, label } of DIAS_HORARIO) {
    const dia = horarios.value[key]
    if (!horarioValido(dia.inicio)) return `Informe o horário de abertura (${label}).`
    if (!horarioValido(dia.fim)) return `Informe o horário de fechamento (${label}).`

    const temInicioAlmoco = Boolean(dia.inicioAlmoco.trim())
    const temFimAlmoco = Boolean(dia.fimAlmoco.trim())
    if (temInicioAlmoco !== temFimAlmoco) {
      return `Preencha início e fim do almoço em ${label}, ou deixe os dois vazios.`
    }
    if (temInicioAlmoco && !horarioValido(dia.inicioAlmoco)) {
      return `Horário de início do almoço inválido (${label}).`
    }
    if (temFimAlmoco && !horarioValido(dia.fimAlmoco)) {
      return `Horário de fim do almoço inválido (${label}).`
    }
  }

  return null
}

const formularioValido = computed(() => {
  if (!nome.value.trim()) return false
  return validarCamposExtras() === null
})

/** Mensagem do Nitro/ofetch em erros HTTP (403 assinatura, workspace, etc.). */
function mensagemErroApi(err: unknown): string {
  if (err && typeof err === 'object') {
    const o = err as Record<string, unknown>
    const data = o.data as Record<string, unknown> | undefined
    if (data) {
      if (typeof data.statusMessage === 'string' && data.statusMessage) return data.statusMessage
      if (typeof data.message === 'string' && data.message) return data.message
    }
    if (typeof o.statusMessage === 'string' && o.statusMessage) return o.statusMessage
    if (typeof o.message === 'string' && o.message && !o.message.startsWith('[')) return o.message
  }
  if (err instanceof Error && err.message) return err.message
  return isEdit.value ? 'Não foi possível salvar o canal.' : 'Não foi possível criar o canal.'
}

function close() {
  isOpen.value = false
}

async function onCreate() {
  const n = nome.value.trim()
  const d = descricao.value.trim()

  if (!n) {
    toast.warning('Informe o nome do canal.')
    return
  }

  const payload = buildConfigPayload()
  if (typeof payload === 'string') {
    toast.warning(payload)
    return
  }

  if (isEdit.value) {
    const idCanal = props.canalEdicaoId ?? canalPinia.value?.id
    if (!idCanal) {
      toast.error('Canal inválido para edição.')
      return
    }

    if (!Number.isFinite(props.workspaceId)) {
      toast.error('Workspace inválido.')
      return
    }

    try {
      await canaisStore.updateCanal({
        id_canal: idCanal,
        workspace_id: props.workspaceId,
        nome: n,
        descricao: d || null,
        endereco: payload.endereco,
        latitude: payload.latitude,
        longitude: payload.longitude,
        tempo_aviso_minutos: payload.tempo_aviso_minutos,
        horarios: payload.horarios,
      })
      toast.success('Canal atualizado com sucesso.')
      close()
    } catch (err: unknown) {
      const msg = mensagemErroApi(err)
      toast.error(msg, { duration: 8000 })
    }
    return
  }

  if (!Number.isFinite(props.workspaceId)) {
    toast.error('Workspace inválido.')
    return
  }

  try {
    const created = await canaisStore.create({
      nome: n,
      descricao: d || null,
      workspace_id: props.workspaceId,
      endereco: payload.endereco,
      latitude: payload.latitude,
      longitude: payload.longitude,
      tempo_aviso_minutos: payload.tempo_aviso_minutos,
      horarios: payload.horarios,
    })
    toast.success('Canal criado com sucesso.')
    emit('criado', created)
    close()
  } catch (err: unknown) {
    const msg = mensagemErroApi(err)
    toast.error(msg, {
      duration: 8000
    })
  }
}
</script>

<template>
  <BaseModal v-model:open="isOpen" :title="isEdit ? 'Editar canal' : 'Criar canal'">
    <template #icon>
      <FontAwesomeIcon :icon="faWhatsapp" class="h-6 w-6 text-[#25D366]" aria-hidden="true" />
    </template>
    <template #subtitle>
      <template v-if="isEdit">
        Altere os dados do canal de atendimento e da loja.
        <span v-if="createdAtLabel" class="mt-1 block text-xs font-normal text-on-surface-variant dark:text-dark-on-surface-variant">
          Criado em {{ createdAtLabel }}
          <template v-if="canalPinia?.id"> · #{{ canalPinia.id }}</template>
        </span>
      </template>
      <template v-else>
        Preencha os dados do canal de atendimento e da loja.
      </template>
    </template>

    <div class="max-h-[min(70vh,42rem)] space-y-6 overflow-y-auto pr-1">
      <div class="space-y-4">
        <div>
          <label class="mb-2 block text-sm font-semibold text-on-surface dark:text-dark-on-surface" :for="`canal-nome-${fieldIdSuffix}`">
            Nome <span class="text-error">*</span>
          </label>
          <BaseInput
            :id="`canal-nome-${fieldIdSuffix}`"
            v-model="nome"
            type="text"
            name="canal_nome"
            placeholder="Ex: Atendimento comercial"
            autocomplete="off"
          />
        </div>

        <div>
          <label class="mb-2 block text-sm font-semibold text-on-surface dark:text-dark-on-surface" :for="`canal-descricao-${fieldIdSuffix}`">
            Descrição
          </label>
          <textarea
            :id="`canal-descricao-${fieldIdSuffix}`"
            v-model="descricao"
            name="canal_descricao"
            rows="3"
            placeholder="Descreva o uso deste canal..."
            class="w-full resize-none rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-900 placeholder:text-gray-400 transition-all focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-100 dark:border-dark-outline/50 dark:bg-dark-surface-container-low dark:text-dark-on-surface dark:placeholder:text-dark-on-surface-variant/70"
          />
        </div>
      </div>

      <div class="space-y-4 border-t border-outline-variant/15 pt-5 dark:border-dark-outline/20">
          <h3 class="text-sm font-bold text-on-surface dark:text-dark-on-surface">Localização</h3>

          <div>
            <label class="mb-2 block text-sm font-semibold text-on-surface dark:text-dark-on-surface" :for="`canal-endereco-${fieldIdSuffix}`">
              Endereço da loja <span class="text-error">*</span>
            </label>
            <BaseInput
              :id="`canal-endereco-${fieldIdSuffix}`"
              v-model="endereco"
              type="text"
              name="canal_endereco"
              placeholder="Ex: Rua Exemplo, 123 — Bairro, Cidade - UF"
              autocomplete="street-address"
            />
          </div>

          <div class="grid gap-4 sm:grid-cols-2">
            <div>
              <label class="mb-2 block text-sm font-semibold text-on-surface dark:text-dark-on-surface" :for="`canal-latitude-${fieldIdSuffix}`">
                Latitude <span class="text-error">*</span>
              </label>
              <BaseInput
                :id="`canal-latitude-${fieldIdSuffix}`"
                v-model="latitude"
                type="text"
                name="canal_latitude"
                inputmode="decimal"
                placeholder="Ex: -23.550520"
                autocomplete="off"
              />
            </div>

            <div>
              <label class="mb-2 block text-sm font-semibold text-on-surface dark:text-dark-on-surface" :for="`canal-longitude-${fieldIdSuffix}`">
                Longitude <span class="text-error">*</span>
              </label>
              <BaseInput
                :id="`canal-longitude-${fieldIdSuffix}`"
                v-model="longitude"
                type="text"
                name="canal_longitude"
                inputmode="decimal"
                placeholder="Ex: -46.633308"
                autocomplete="off"
              />
            </div>
          </div>
        </div>

        <div class="space-y-4 border-t border-outline-variant/15 pt-5 dark:border-dark-outline/20">
          <h3 class="text-sm font-bold text-on-surface dark:text-dark-on-surface">Configuração da loja</h3>

          <div>
            <label
              class="mb-2 block text-sm font-semibold text-on-surface dark:text-dark-on-surface"
              :for="`canal-tempo-aviso-${fieldIdSuffix}`"
            >
              Tempo de aviso antes de fechar (minutos) <span class="text-error">*</span>
            </label>
            <BaseInput
              :id="`canal-tempo-aviso-${fieldIdSuffix}`"
              v-model="tempoAvisoMinutos"
              type="number"
              name="canal_tempo_aviso"
              inputmode="numeric"
              placeholder="Ex: 30"
              autocomplete="off"
            />
            <p class="mt-1.5 text-xs text-on-surface-variant dark:text-dark-on-surface-variant">
              Aviso enviado antes de fechar a loja ou iniciar o horário de almoço.
            </p>
          </div>
        </div>

        <div class="space-y-4 border-t border-outline-variant/15 pt-5 dark:border-dark-outline/20">
          <div>
            <h3 class="text-sm font-bold text-on-surface dark:text-dark-on-surface">Horários de funcionamento</h3>
            <p class="mt-1 text-xs text-on-surface-variant dark:text-dark-on-surface-variant">
              Se não houver almoço no dia, deixe início e fim do almoço vazios.
            </p>
          </div>

          <div
            v-for="{ key, label } in DIAS_HORARIO"
            :key="key"
            class="space-y-3 rounded-xl border border-outline-variant/15 bg-surface-container-low/40 p-4 dark:border-dark-outline/20 dark:bg-dark-surface-container-low/40"
          >
            <div class="flex items-center justify-between gap-3">
              <p class="text-sm font-semibold text-on-surface dark:text-dark-on-surface">{{ label }}</p>
              <label class="inline-flex cursor-pointer items-center gap-2 text-sm text-on-surface dark:text-dark-on-surface">
                <input
                  v-model="horarios[key].aberto"
                  type="checkbox"
                  class="size-4 rounded border-gray-300 text-primary focus:ring-primary"
                />
                Aberto
              </label>
            </div>

            <div class="grid gap-3 sm:grid-cols-2">
              <div>
                <label
                  class="mb-1.5 block text-xs font-semibold text-on-surface dark:text-dark-on-surface"
                  :for="`canal-${key}-inicio-${fieldIdSuffix}`"
                >
                  Abertura <span class="text-error">*</span>
                </label>
                <BaseInput
                  :id="`canal-${key}-inicio-${fieldIdSuffix}`"
                  v-model="horarios[key].inicio"
                  type="time"
                  :name="`canal_${key}_inicio`"
                />
              </div>

              <div>
                <label
                  class="mb-1.5 block text-xs font-semibold text-on-surface dark:text-dark-on-surface"
                  :for="`canal-${key}-fim-${fieldIdSuffix}`"
                >
                  Fechamento <span class="text-error">*</span>
                </label>
                <BaseInput
                  :id="`canal-${key}-fim-${fieldIdSuffix}`"
                  v-model="horarios[key].fim"
                  type="time"
                  :name="`canal_${key}_fim`"
                />
              </div>

              <div>
                <label
                  class="mb-1.5 block text-xs font-semibold text-on-surface dark:text-dark-on-surface"
                  :for="`canal-${key}-inicio-almoco-${fieldIdSuffix}`"
                >
                  Início almoço
                </label>
                <BaseInput
                  :id="`canal-${key}-inicio-almoco-${fieldIdSuffix}`"
                  v-model="horarios[key].inicioAlmoco"
                  type="time"
                  :name="`canal_${key}_inicio_almoco`"
                />
              </div>

              <div>
                <label
                  class="mb-1.5 block text-xs font-semibold text-on-surface dark:text-dark-on-surface"
                  :for="`canal-${key}-fim-almoco-${fieldIdSuffix}`"
                >
                  Fim almoço
                </label>
                <BaseInput
                  :id="`canal-${key}-fim-almoco-${fieldIdSuffix}`"
                  v-model="horarios[key].fimAlmoco"
                  type="time"
                  :name="`canal_${key}_fim_almoco`"
                />
              </div>
            </div>
          </div>
        </div>
    </div>

    <template #footer>
      <div class="w-full sm:w-40">
        <BaseButton type="button" variant="secondary" @click="close">Cancelar</BaseButton>
      </div>
      <div class="w-full sm:w-44">
        <BaseButton
          type="button"
          :disabled="!formularioValido || canaisStore.pending"
          @click="onCreate"
        >
          {{ isEdit ? 'Salvar' : 'Criar canal' }}
        </BaseButton>
      </div>
    </template>
  </BaseModal>
</template>
