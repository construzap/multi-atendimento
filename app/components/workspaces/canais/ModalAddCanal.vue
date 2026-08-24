<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { faWhatsapp } from '@fortawesome/free-brands-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome'
import { toast } from 'vue-sonner'
import BaseButton from '~/components/BaseButton.vue'
import BaseInput from '~/components/BaseInput.vue'
import BaseModal from '~/components/BaseModal.vue'
import type { CanalCriado } from '~/stores/canais'
import type { Canal, CanalHorarioDia, CanalHorarioDiaKey, CanalHorarios } from '#shared/types/canal'
import { CANAL_HORARIO_DIAS, ordenarCanalHorarios } from '#shared/types/canal'

type HorarioDia = CanalHorarioDia

const DIAS_HORARIO: { key: CanalHorarioDiaKey; label: string }[] = [
  { key: 'domingo', label: 'Domingo' },
  { key: 'segunda', label: 'Segunda-feira' },
  { key: 'terca', label: 'Terça-feira' },
  { key: 'quarta', label: 'Quarta-feira' },
  { key: 'quinta', label: 'Quinta-feira' },
  { key: 'sexta', label: 'Sexta-feira' },
  { key: 'sabado', label: 'Sábado' },
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

function diaUtilPadrao(): HorarioDia {
  return horarioDiaPadrao({
    aberto: true,
    inicio: '07:30',
    inicioAlmoco: '12:00',
    fimAlmoco: '13:30',
    fim: '17:30',
  })
}

function horariosPadrao(): CanalHorarios {
  const out = {} as CanalHorarios
  for (const dia of CANAL_HORARIO_DIAS) {
    if (dia === 'domingo') {
      out[dia] = horarioDiaPadrao({
        aberto: false,
        inicio: '08:00',
        fim: '12:00',
      })
    } else if (dia === 'sabado') {
      out[dia] = horarioDiaPadrao({
        aberto: true,
        inicio: '08:00',
        fim: '13:00',
      })
    } else {
      out[dia] = diaUtilPadrao()
    }
  }
  return out
}

function normalizarHorarioParaInput(valor: unknown): string {
  if (typeof valor !== 'string') return ''
  const t = valor.trim()
  if (!t) return ''
  const match = /^(\d{2}:\d{2})/.exec(t)
  return match?.[1] ?? t
}

function normalizarBooleano(valor: unknown, fallback: boolean): boolean {
  if (typeof valor === 'boolean') return valor
  if (valor === 'true') return true
  if (valor === 'false') return false
  return fallback
}

function clonarHorarios(raw: CanalHorarios): CanalHorarios {
  return ordenarCanalHorarios(JSON.parse(JSON.stringify(raw)) as CanalHorarios)
}

function horariosFromCanal(raw: CanalHorarios | null | undefined): CanalHorarios {
  const padrao = horariosPadrao()
  if (!raw) return padrao

  const cloneDia = (dia: CanalHorarioDia | undefined, fallback: HorarioDia): HorarioDia => ({
    aberto: normalizarBooleano(dia?.aberto, fallback.aberto),
    inicio: normalizarHorarioParaInput(dia?.inicio) || fallback.inicio,
    inicioAlmoco: normalizarHorarioParaInput(dia?.inicioAlmoco),
    fimAlmoco: normalizarHorarioParaInput(dia?.fimAlmoco),
    fim: normalizarHorarioParaInput(dia?.fim) || fallback.fim,
  })

  // Legado: { semana, sabado, domingo } → expande semana em seg–sex
  const rawObj = raw as Record<string, CanalHorarioDia | undefined> & {
    semana?: CanalHorarioDia
  }
  if (rawObj.semana && rawObj.segunda == null) {
    const semana = cloneDia(rawObj.semana, padrao.segunda)
    return ordenarCanalHorarios({
      domingo: cloneDia(rawObj.domingo, padrao.domingo),
      segunda: { ...semana },
      terca: { ...semana },
      quarta: { ...semana },
      quinta: { ...semana },
      sexta: { ...semana },
      sabado: cloneDia(rawObj.sabado, padrao.sabado),
    })
  }

  const out = {} as CanalHorarios
  for (const dia of CANAL_HORARIO_DIAS) {
    out[dia] = cloneDia(rawObj[dia], padrao[dia])
  }
  return out
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

/** Snapshot do canal no Pinia ao abrir o modal (restauração no cancelar/fechar). */
const snapshotCanal = ref<Canal | null>(null)
/** true após salvar com sucesso — não restaura o snapshot ao fechar. */
const edicaoCommitada = ref(false)
/** Evita loop ao preencher o form a partir do Pinia. */
let preenchendoDoPinia = false

function clonarCanal(canal: Canal): Canal {
  return JSON.parse(JSON.stringify(canal)) as Canal
}

function normalizarCoordenadaTexto(valor: string): string {
  return valor.trim().replace(',', '.').replace('−', '-')
}

function parseCoordenadaFormulario(valor: string, min: number, max: number): number | null {
  const n = Number.parseFloat(normalizarCoordenadaTexto(valor))
  if (!Number.isFinite(n) || n < min || n > max) return null
  return n
}

function montarHorariosDoFormulario(): CanalHorarios {
  return clonarHorarios(horarios.value)
}

function idCanalEmEdicao(): number | null {
  const raw = props.canalEdicaoId ?? snapshotCanal.value?.id ?? null
  if (raw == null) return null
  const n = typeof raw === 'number' ? raw : Number.parseInt(String(raw), 10)
  return Number.isFinite(n) && n > 0 ? n : null
}

function canalNoPinia(): Canal | null {
  const id = idCanalEmEdicao()
  if (id == null) return null
  return canaisStore.items.find((c) => c.id === id) ?? null
}

/** Alterna o dia com replace imutável (garante reatividade + sync no Pinia). */
function toggleDiaAberto(key: CanalHorarioDiaKey) {
  const dia = horarios.value[key]
  horarios.value = {
    ...horarios.value,
    [key]: { ...dia, aberto: !dia.aberto },
  }
}

function buildConfigPayload():
  | {
      nome?: string
      descricao?: string | null
      endereco: string | null
      latitude: number | null
      longitude: number | null
      tempo_aviso_minutos: number
      horarios: CanalHorarios
    }
  | string {
  const erroExtras = validarCamposExtras()
  if (erroExtras) return erroExtras

  const latRaw = latitude.value.trim()
  const lngRaw = longitude.value.trim()
  const avisoRaw = tempoAvisoMinutos.value.trim()
  const aviso = avisoRaw ? Number.parseInt(avisoRaw, 10) : 30

  return {
    endereco: endereco.value.trim() || null,
    latitude: latRaw ? parseCoordenadaFormulario(latitude.value, -90, 90) : null,
    longitude: lngRaw ? parseCoordenadaFormulario(longitude.value, -180, 180) : null,
    tempo_aviso_minutos: aviso,
    // Clone puro do que está na tela — fonte da verdade no save
    horarios: montarHorariosDoFormulario(),
  }
}

/** Espelha o formulário no item do Pinia enquanto o modal de edição está aberto. */
function sincronizarFormularioNoPinia() {
  if (!isEdit.value || preenchendoDoPinia) return
  const id = idCanalEmEdicao()
  if (id == null) return
  const idx = canaisStore.items.findIndex((c) => c.id === id)
  if (idx === -1) return

  const atual = canaisStore.items[idx]
  if (!atual) return

  const latRaw = latitude.value.trim()
  const lngRaw = longitude.value.trim()
  const avisoRaw = tempoAvisoMinutos.value.trim()
  const aviso = avisoRaw ? Number.parseInt(avisoRaw, 10) : 30

  canaisStore.items[idx] = {
    ...atual,
    nome: nome.value.trim() || null,
    descricao: descricao.value.trim() || null,
    endereco: endereco.value.trim() || null,
    latitude: latRaw ? parseCoordenadaFormulario(latitude.value, -90, 90) : null,
    longitude: lngRaw ? parseCoordenadaFormulario(longitude.value, -180, 180) : null,
    tempo_aviso_minutos: Number.isFinite(aviso) ? aviso : atual.tempo_aviso_minutos,
    horarios: montarHorariosDoFormulario(),
  }
}

function restaurarSnapshotNoPinia() {
  const snap = snapshotCanal.value
  if (!snap) return
  const idx = canaisStore.items.findIndex((c) => c.id === snap.id)
  if (idx === -1) return
  canaisStore.items[idx] = clonarCanal(snap)
}

function resetarCamposExtras() {
  endereco.value = ''
  latitude.value = ''
  longitude.value = ''
  tempoAvisoMinutos.value = '30'
  horarios.value = horariosPadrao()
}

function preencherDoPinia() {
  preenchendoDoPinia = true
  try {
    if (!isEdit.value) {
      nome.value = ''
      descricao.value = ''
      resetarCamposExtras()
      return
    }

    const canal = canalNoPinia() ?? snapshotCanal.value
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
  } finally {
    // nextTick seria melhor, mas microtask evita sync com form ainda “velho”
    queueMicrotask(() => {
      preenchendoDoPinia = false
    })
  }
}

function limparFormulario() {
  nome.value = ''
  descricao.value = ''
  resetarCamposExtras()
}

function abrirModal() {
  edicaoCommitada.value = false
  snapshotCanal.value = null

  if (isEdit.value && idCanalEmEdicao() != null) {
    const canal = canalNoPinia()
    if (canal) {
      // Snapshot do estado ORIGINAL (antes de qualquer draft)
      snapshotCanal.value = clonarCanal(canal)
    }
  }

  preencherDoPinia()
  // Garante Pinia = formulário logo ao abrir
  queueMicrotask(() => {
    if (isOpen.value && isEdit.value) sincronizarFormularioNoPinia()
  })
}

function fecharModal() {
  if (isEdit.value && snapshotCanal.value && !edicaoCommitada.value) {
    restaurarSnapshotNoPinia()
  }
  snapshotCanal.value = null
  edicaoCommitada.value = false
  limparFormulario()
}

watch(isOpen, (aberto) => {
  if (aberto) abrirModal()
  else fecharModal()
})

watch(
  () => props.canalEdicaoId,
  (id, prev) => {
    if (!isOpen.value || !isEdit.value) return
    if (id == null || id === prev) return
    abrirModal()
  },
)

watch(
  [nome, descricao, endereco, latitude, longitude, tempoAvisoMinutos, horarios],
  () => {
    if (!isOpen.value || !isEdit.value) return
    sincronizarFormularioNoPinia()
  },
  { deep: true },
)

function horarioValido(valor: string): boolean {
  return /^\d{2}:\d{2}$/.test(valor.trim())
}

function coordenadaValida(valor: string, min: number, max: number): boolean {
  return parseCoordenadaFormulario(valor, min, max) != null
}

/** Valida o que está na tela (formulário). */
function validarCamposExtras(): string | null {
  if (latitude.value.trim() && !coordenadaValida(latitude.value, -90, 90)) {
    return 'Latitude inválida (entre -90 e 90).'
  }
  if (longitude.value.trim() && !coordenadaValida(longitude.value, -180, 180)) {
    return 'Longitude inválida (entre -180 e 180).'
  }

  if (tempoAvisoMinutos.value.trim()) {
    const aviso = Number.parseInt(tempoAvisoMinutos.value, 10)
    if (!Number.isFinite(aviso) || aviso < 0) {
      return 'Tempo de aviso inválido (informe minutos >= 0).'
    }
  }

  for (const { key, label } of DIAS_HORARIO) {
    const dia = horarios.value[key]
    if (dia.inicio.trim() && !horarioValido(dia.inicio)) {
      return `Horário de abertura inválido (${label}).`
    }
    if (dia.fim.trim() && !horarioValido(dia.fim)) {
      return `Horário de fechamento inválido (${label}).`
    }

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

const formularioValido = computed(() => Boolean(nome.value.trim()))

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
    const idCanal = idCanalEmEdicao()
    if (!idCanal) {
      toast.error('Canal inválido para edição.')
      return
    }

    if (!Number.isFinite(props.workspaceId)) {
      toast.error('Workspace inválido.')
      return
    }

    // Último sync tela → Pinia, depois envia o clone da tela
    sincronizarFormularioNoPinia()

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
      edicaoCommitada.value = true
      snapshotCanal.value = null
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
  <BaseModal
    v-model:open="isOpen"
    :title="isEdit ? 'Editar canal' : 'Criar canal'"
    panel-class="w-full max-w-3xl"
  >
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
              Endereço da loja
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
                Latitude
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
                Longitude
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
              Tempo de aviso antes de fechar (minutos)
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

        <div class="space-y-3 border-t border-outline-variant/15 pt-5 dark:border-dark-outline/20">
          <div>
            <h3 class="text-sm font-bold text-on-surface dark:text-dark-on-surface">
              Horários de funcionamento
            </h3>
            <p class="mt-1 text-xs text-on-surface-variant dark:text-dark-on-surface-variant">
              Ative o dia para definir os horários. Sem almoço, deixe início e fim do almoço vazios.
            </p>
          </div>

          <div class="overflow-x-auto rounded-xl border border-outline-variant/20 dark:border-dark-outline/25">
            <div class="min-w-[40rem]">
              <!-- Cabeçalho (desktop) -->
              <div
                class="hidden grid-cols-[9.5rem_3.5rem_minmax(0,1fr)] gap-3 border-b border-outline-variant/15 bg-surface-container-low/60 px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-on-surface-variant dark:border-dark-outline/20 dark:bg-dark-surface-container-low/50 dark:text-dark-on-surface-variant sm:grid"
              >
                <span>Dia da semana</span>
                <span class="text-center">Ativo</span>
                <div class="grid grid-cols-4 gap-2">
                  <span>Início</span>
                  <span>Início almoço</span>
                  <span>Fim almoço</span>
                  <span>Final</span>
                </div>
              </div>

              <div
                v-for="{ key, label } in DIAS_HORARIO"
                :key="key"
                class="border-b border-outline-variant/10 px-3 py-3 last:border-b-0 dark:border-dark-outline/15"
              >
                <div
                  class="grid grid-cols-1 items-center gap-3 sm:grid-cols-[9.5rem_3.5rem_minmax(0,1fr)]"
                >
                  <p class="text-sm font-medium text-on-surface dark:text-dark-on-surface">
                    {{ label }}
                  </p>

                  <div class="flex sm:justify-center">
                    <button
                      type="button"
                      role="switch"
                      :aria-checked="horarios[key].aberto"
                      :aria-label="`${label}: ${horarios[key].aberto ? 'aberto' : 'fechado'}`"
                      class="relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                      :class="
                        horarios[key].aberto
                          ? 'bg-primary'
                          : 'bg-slate-300 dark:bg-slate-600'
                      "
                      @click.stop="toggleDiaAberto(key)"
                    >
                      <span
                        class="inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform"
                        :class="horarios[key].aberto ? 'translate-x-6' : 'translate-x-1'"
                      />
                    </button>
                  </div>

                  <div v-if="horarios[key].aberto" class="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    <div>
                      <label
                        class="mb-1 block text-[11px] font-medium text-on-surface-variant sm:hidden dark:text-dark-on-surface-variant"
                        :for="`canal-${key}-inicio-${fieldIdSuffix}`"
                      >
                        Início
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
                        class="mb-1 block text-[11px] font-medium text-on-surface-variant sm:hidden dark:text-dark-on-surface-variant"
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
                        class="mb-1 block text-[11px] font-medium text-on-surface-variant sm:hidden dark:text-dark-on-surface-variant"
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
                    <div>
                      <label
                        class="mb-1 block text-[11px] font-medium text-on-surface-variant sm:hidden dark:text-dark-on-surface-variant"
                        :for="`canal-${key}-fim-${fieldIdSuffix}`"
                      >
                        Final
                      </label>
                      <BaseInput
                        :id="`canal-${key}-fim-${fieldIdSuffix}`"
                        v-model="horarios[key].fim"
                        type="time"
                        :name="`canal_${key}_fim`"
                      />
                    </div>
                  </div>
                </div>
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
