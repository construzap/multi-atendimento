<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import BaseButton from '~/components/BaseButton.vue'
import BaseModal from '~/components/BaseModal.vue'

const props = defineProps<{
  open: boolean
  enviando?: boolean
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
  confirmar: [payload: { data: string; hora: string; duracaoMinutos: number }]
}>()

const MESES = [
  'janeiro',
  'fevereiro',
  'março',
  'abril',
  'maio',
  'junho',
  'julho',
  'agosto',
  'setembro',
  'outubro',
  'novembro',
  'dezembro',
]
const SEMANA = ['seg', 'ter', 'qua', 'qui', 'sex', 'sáb', 'dom']
const HORARIOS_RAPIDOS = ['08:00', '09:00', '10:00', '14:00', '15:00', '16:00', '18:00']
const DURACOES = [15, 30, 35, 45, 60, 90]

const CAMPO =
  'w-full rounded-lg border border-outline/30 bg-white px-3 py-2.5 text-sm text-on-surface outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:opacity-50 dark:border-dark-outline/30 dark:bg-dark-surface-container-low dark:text-dark-on-surface'

const data = ref('')
const dataTexto = ref('')
const hora = ref('')
const horaTexto = ref('')
const duracaoMinutos = ref(35)
const mesVisivel = ref({ ano: 2026, mes: 1 })

const podeConfirmar = computed(() => {
  if (props.enviando) return false
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data.value)) return false
  if (!/^\d{2}:\d{2}$/.test(hora.value)) return false
  const minutos = Number(duracaoMinutos.value)
  return Number.isInteger(minutos) && minutos >= 1 && minutos <= 480
})

const tituloMes = computed(() => {
  const nome = MESES[mesVisivel.value.mes - 1] ?? ''
  return `${nome} ${mesVisivel.value.ano}`
})

type DiaGrade = { iso: string; numero: number; fora: boolean }

const grade = computed<DiaGrade[]>(() => {
  const { ano, mes } = mesVisivel.value
  const primeiro = new Date(ano, mes - 1, 1)
  const inicio = (primeiro.getDay() + 6) % 7
  const diasNoMes = new Date(ano, mes, 0).getDate()
  const diasMesAnterior = new Date(ano, mes - 1, 0).getDate()
  const celulas: DiaGrade[] = []

  for (let i = 0; i < inicio; i += 1) {
    const numero = diasMesAnterior - inicio + 1 + i
    const dataAnterior = new Date(ano, mes - 2, numero)
    celulas.push({ iso: dataLocalIso(dataAnterior), numero, fora: true })
  }
  for (let dia = 1; dia <= diasNoMes; dia += 1) {
    celulas.push({ iso: dataLocalIso(new Date(ano, mes - 1, dia)), numero: dia, fora: false })
  }
  let seguinte = 1
  while (celulas.length % 7 !== 0) {
    const dataSeguinte = new Date(ano, mes, seguinte)
    celulas.push({ iso: dataLocalIso(dataSeguinte), numero: seguinte, fora: true })
    seguinte += 1
  }
  return celulas
})

function hojeBrasil(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())
}

function dataLocalIso(data: Date): string {
  const ano = data.getFullYear()
  const mes = String(data.getMonth() + 1).padStart(2, '0')
  const dia = String(data.getDate()).padStart(2, '0')
  return `${ano}-${mes}-${dia}`
}

function isoParaBr(iso: string): string {
  const [ano, mes, dia] = iso.split('-')
  if (!ano || !mes || !dia) return ''
  return `${dia}/${mes}/${ano}`
}

function brParaIso(texto: string): string | null {
  const match = texto.match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
  if (!match) return null
  const dia = Number(match[1])
  const mes = Number(match[2])
  const ano = Number(match[3])
  if (mes < 1 || mes > 12 || dia < 1 || ano < 2000 || ano > 2100) return null
  const conferida = new Date(ano, mes - 1, dia)
  if (conferida.getFullYear() !== ano || conferida.getMonth() !== mes - 1 || conferida.getDate() !== dia) {
    return null
  }
  return dataLocalIso(conferida)
}

function somarDias(iso: string, dias: number): string {
  const [ano, mes, dia] = iso.split('-').map(Number)
  return dataLocalIso(new Date(ano!, (mes ?? 1) - 1, (dia ?? 1) + dias))
}

function focarMes(iso: string) {
  const [ano, mes] = iso.split('-').map(Number)
  if (!ano || !mes) return
  mesVisivel.value = { ano, mes }
}

function aplicarData(iso: string) {
  data.value = iso
  dataTexto.value = isoParaBr(iso)
  focarMes(iso)
}

function aoDigitarData(evento: Event) {
  const digits = (evento.target as HTMLInputElement).value.replace(/\D/g, '').slice(0, 8)
  let texto = digits
  if (digits.length > 2) texto = `${digits.slice(0, 2)}/${digits.slice(2)}`
  if (digits.length > 4) texto = `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`
  dataTexto.value = texto
  if (digits.length < 8) {
    data.value = ''
    return
  }
  const iso = brParaIso(texto)
  if (!iso) {
    data.value = ''
    return
  }
  aplicarData(iso)
}

function normalizarHora(bruto: string): string | null {
  const digits = bruto.replace(/\D/g, '').slice(0, 4)
  if (!digits) return null
  let hh = ''
  let mm = '00'
  if (digits.length <= 2) {
    hh = digits.padStart(2, '0')
  } else if (digits.length === 3) {
    hh = digits.slice(0, 1).padStart(2, '0')
    mm = digits.slice(1)
  } else {
    hh = digits.slice(0, 2)
    mm = digits.slice(2)
  }
  const horaNum = Number(hh)
  const minutoNum = Number(mm)
  if (horaNum > 23 || minutoNum > 59) return null
  return `${hh}:${mm}`
}

function aoDigitarHora(evento: Event) {
  const digits = (evento.target as HTMLInputElement).value.replace(/\D/g, '').slice(0, 4)
  horaTexto.value = digits.length > 2 ? `${digits.slice(0, 2)}:${digits.slice(2)}` : digits
  hora.value = digits.length >= 3 ? (normalizarHora(digits) ?? '') : ''
}

function aoSairHora() {
  const normalizada = normalizarHora(horaTexto.value)
  if (!normalizada) {
    hora.value = ''
    return
  }
  hora.value = normalizada
  horaTexto.value = normalizada
}

function escolherHorario(valor: string) {
  hora.value = valor
  horaTexto.value = valor
}

function mudarMes(delta: number) {
  const dataBase = new Date(mesVisivel.value.ano, mesVisivel.value.mes - 1 + delta, 1)
  mesVisivel.value = { ano: dataBase.getFullYear(), mes: dataBase.getMonth() + 1 }
}

watch(
  () => props.open,
  (aberto) => {
    if (!aberto) return
    const hoje = hojeBrasil()
    data.value = hoje
    dataTexto.value = isoParaBr(hoje)
    hora.value = ''
    horaTexto.value = ''
    duracaoMinutos.value = 35
    focarMes(hoje)
  },
)

function fechar() {
  if (props.enviando) return
  emit('update:open', false)
}

function confirmar() {
  if (!podeConfirmar.value) return
  emit('confirmar', {
    data: data.value,
    hora: hora.value,
    duracaoMinutos: Number(duracaoMinutos.value),
  })
}
</script>

<template>
  <BaseModal
    :open="open"
    title="Agendar reunião"
    panel-class="w-full max-w-md"
    :close-on-backdrop="!enviando"
    :close-on-escape="!enviando"
    :show-close="!enviando"
    @update:open="emit('update:open', $event)"
    @close="fechar"
  >
    <div class="space-y-5">
      <div class="space-y-2">
        <span class="text-[11px] font-semibold uppercase tracking-wide text-on-surface-variant dark:text-dark-on-surface-variant">
          Data
        </span>
        <div class="flex gap-2">
          <button
            type="button"
            class="rounded-full border border-outline/30 px-3 py-1 text-xs font-medium text-on-surface hover:bg-surface-container-high disabled:opacity-50 dark:border-dark-outline/30 dark:text-dark-on-surface dark:hover:bg-dark-surface-container-high"
            :disabled="enviando"
            @click="aplicarData(hojeBrasil())"
          >
            Hoje
          </button>
          <button
            type="button"
            class="rounded-full border border-outline/30 px-3 py-1 text-xs font-medium text-on-surface hover:bg-surface-container-high disabled:opacity-50 dark:border-dark-outline/30 dark:text-dark-on-surface dark:hover:bg-dark-surface-container-high"
            :disabled="enviando"
            @click="aplicarData(somarDias(hojeBrasil(), 1))"
          >
            Amanhã
          </button>
        </div>
        <input
          :value="dataTexto"
          type="text"
          inputmode="numeric"
          autocomplete="off"
          placeholder="dd/mm/aaaa"
          maxlength="10"
          :disabled="enviando"
          :class="CAMPO"
          aria-label="Data da reunião"
          @input="aoDigitarData"
        />

        <div class="rounded-xl border border-outline/25 p-2 dark:border-dark-outline/30">
          <div class="mb-2 flex items-center justify-between px-1">
            <button
              type="button"
              class="flex h-9 w-9 items-center justify-center rounded-lg text-on-surface hover:bg-surface-container-high disabled:opacity-50 dark:text-dark-on-surface dark:hover:bg-dark-surface-container-high"
              aria-label="Mês anterior"
              :disabled="enviando"
              @click="mudarMes(-1)"
            >
              <span class="material-symbols-outlined text-[20px]" aria-hidden="true">chevron_left</span>
            </button>
            <p class="text-sm font-semibold capitalize text-on-surface dark:text-dark-on-surface">
              {{ tituloMes }}
            </p>
            <button
              type="button"
              class="flex h-9 w-9 items-center justify-center rounded-lg text-on-surface hover:bg-surface-container-high disabled:opacity-50 dark:text-dark-on-surface dark:hover:bg-dark-surface-container-high"
              aria-label="Próximo mês"
              :disabled="enviando"
              @click="mudarMes(1)"
            >
              <span class="material-symbols-outlined text-[20px]" aria-hidden="true">chevron_right</span>
            </button>
          </div>
          <div class="grid grid-cols-7 gap-1 text-center">
            <span
              v-for="diaSemana in SEMANA"
              :key="diaSemana"
              class="py-1 text-[10px] font-semibold uppercase text-on-surface-variant dark:text-dark-on-surface-variant"
            >
              {{ diaSemana }}
            </span>
            <button
              v-for="dia in grade"
              :key="dia.iso + (dia.fora ? '-fora' : '')"
              type="button"
              class="mx-auto flex h-10 w-10 items-center justify-center rounded-full text-sm transition-colors disabled:opacity-50"
              :class="
                dia.iso === data
                  ? 'bg-primary font-semibold text-white'
                  : dia.iso === hojeBrasil()
                    ? 'ring-1 ring-primary text-on-surface hover:bg-surface-container-high dark:text-dark-on-surface dark:hover:bg-dark-surface-container-high'
                    : dia.fora
                      ? 'text-on-surface-variant/50 hover:bg-surface-container-high dark:text-dark-on-surface-variant/40 dark:hover:bg-dark-surface-container-high'
                      : 'text-on-surface hover:bg-surface-container-high dark:text-dark-on-surface dark:hover:bg-dark-surface-container-high'
              "
              :aria-pressed="dia.iso === data"
              :aria-label="isoParaBr(dia.iso)"
              :disabled="enviando"
              @click="aplicarData(dia.iso)"
            >
              {{ dia.numero }}
            </button>
          </div>
        </div>
      </div>

      <div class="space-y-2">
        <span class="text-[11px] font-semibold uppercase tracking-wide text-on-surface-variant dark:text-dark-on-surface-variant">
          Horário
        </span>
        <input
          :value="horaTexto"
          type="text"
          inputmode="numeric"
          autocomplete="off"
          placeholder="08:00"
          maxlength="5"
          :disabled="enviando"
          :class="CAMPO"
          aria-label="Horário da reunião"
          @input="aoDigitarHora"
          @blur="aoSairHora"
        />
        <div class="flex flex-wrap gap-2">
          <button
            v-for="opcao in HORARIOS_RAPIDOS"
            :key="opcao"
            type="button"
            class="rounded-full border px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-50"
            :class="
              hora === opcao
                ? 'border-primary bg-primary text-white'
                : 'border-outline/30 text-on-surface hover:bg-surface-container-high dark:border-dark-outline/30 dark:text-dark-on-surface dark:hover:bg-dark-surface-container-high'
            "
            :aria-pressed="hora === opcao"
            :disabled="enviando"
            @click="escolherHorario(opcao)"
          >
            {{ opcao }}
          </button>
        </div>
      </div>

      <div class="space-y-2">
        <span class="text-[11px] font-semibold uppercase tracking-wide text-on-surface-variant dark:text-dark-on-surface-variant">
          Duração (minutos)
        </span>
        <div class="flex flex-wrap gap-2">
          <button
            v-for="minutos in DURACOES"
            :key="minutos"
            type="button"
            class="rounded-full border px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-50"
            :class="
              duracaoMinutos === minutos
                ? 'border-primary bg-primary text-white'
                : 'border-outline/30 text-on-surface hover:bg-surface-container-high dark:border-dark-outline/30 dark:text-dark-on-surface dark:hover:bg-dark-surface-container-high'
            "
            :aria-pressed="duracaoMinutos === minutos"
            :disabled="enviando"
            @click="duracaoMinutos = minutos"
          >
            {{ minutos }} min
          </button>
        </div>
        <input
          v-model.number="duracaoMinutos"
          type="number"
          min="1"
          max="480"
          step="5"
          inputmode="numeric"
          :disabled="enviando"
          :class="CAMPO"
          aria-label="Duração em minutos"
        />
      </div>
    </div>

    <template #footer>
      <div class="w-full sm:w-36">
        <BaseButton type="button" variant="secondary" :disabled="enviando" @click="fechar">
          Cancelar
        </BaseButton>
      </div>
      <div class="w-full sm:w-40">
        <BaseButton type="button" :disabled="!podeConfirmar" @click="confirmar">
          {{ enviando ? 'Enviando…' : 'Agendar' }}
        </BaseButton>
      </div>
    </template>
  </BaseModal>
</template>
