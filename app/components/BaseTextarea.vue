<script setup lang="ts">
import { computed, nextTick, onMounted, ref, useSlots, watch } from 'vue'

const props = withDefaults(
  defineProps<{
    modelValue?: string
    placeholder?: string
    id?: string
    name?: string
    autocomplete?: string
    maxlength?: number
    title?: string
    disabled?: boolean
    readonly?: boolean
    wrapperId?: string
    /** Classes extras no `<textarea>`. */
    inputClass?: string
    /** Altura mínima em px (uma linha confortável). */
    minHeightPx?: number
    /** Altura máxima em px antes de rolar por dentro. */
    maxHeightPx?: number
    /** Se true, Enter envia; Shift+Enter quebra linha. */
    submitOnEnter?: boolean
  }>(),
  {
    modelValue: '',
    placeholder: '',
    id: undefined,
    name: undefined,
    autocomplete: undefined,
    maxlength: undefined,
    title: undefined,
    disabled: false,
    readonly: false,
    wrapperId: undefined,
    inputClass: undefined,
    minHeightPx: 48,
    maxHeightPx: 160,
    submitOnEnter: true,
  },
)

const emit = defineEmits<{
  'update:modelValue': [value: string]
  submit: []
}>()

const slots = useSlots()

const hasLeading = computed(() => Boolean(slots.leading))
const hasTrailing = computed(() => Boolean(slots.trailing))

const paddingClass = computed(() => {
  const pl = hasLeading.value ? 'pl-12' : 'pl-6'
  const pr = hasTrailing.value ? 'pr-28' : 'pr-4'
  return `${pl} ${pr}`
})

function adjustHeight(el: HTMLTextAreaElement) {
  el.style.height = 'auto'
  const h = Math.min(Math.max(el.scrollHeight, props.minHeightPx), props.maxHeightPx)
  el.style.height = `${h}px`
}

function onInput(e: Event) {
  const el = e.target as HTMLTextAreaElement
  emit('update:modelValue', el.value)
  adjustHeight(el)
}

function onKeydown(e: KeyboardEvent) {
  if (e.isComposing) return
  if (!props.submitOnEnter) return
  if (e.key !== 'Enter' || e.shiftKey) return
  e.preventDefault()
  if (!String(props.modelValue ?? '').trim()) return
  emit('submit')
}

const root = ref<HTMLTextAreaElement | null>(null)

function syncHeight() {
  if (root.value) adjustHeight(root.value)
}

function focus() {
  root.value?.focus()
}

defineExpose({ focus })

watch(
  () => props.modelValue,
  () => {
    nextTick(syncHeight)
  },
)

onMounted(() => {
  nextTick(syncHeight)
})
</script>

<template>
  <div :id="wrapperId" class="relative w-full">
    <div
      v-if="$slots.leading"
      class="pointer-events-none absolute left-4 top-3 z-[1] flex items-start text-on-surface-variant dark:text-dark-on-surface-variant"
    >
      <slot name="leading" />
    </div>
    <textarea
      ref="root"
      :id="id"
      :name="name"
      :value="modelValue"
      :autocomplete="autocomplete"
      :maxlength="maxlength"
      :title="title"
      :disabled="disabled"
      :readonly="readonly"
      :placeholder="placeholder"
      rows="1"
      class="resize-none overflow-y-auto"
      :class="[
        'w-full rounded-xl border border-outline/40 bg-surface-container-low py-3 text-sm text-on-surface shadow-sm placeholder:text-on-surface-variant/70 transition-[height] focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-100 disabled:cursor-not-allowed disabled:opacity-60 read-only:cursor-default read-only:border-outline/40 read-only:bg-surface-container read-only:text-on-surface-variant dark:border-dark-outline/40 dark:bg-dark-surface-container-low dark:text-dark-on-surface dark:shadow-none dark:placeholder:text-dark-on-surface-variant/70 dark:focus:border-primary-400 dark:focus:ring-primary-900/40 dark:read-only:border-dark-outline/40 dark:read-only:bg-dark-surface-container dark:read-only:text-dark-on-surface-variant',
        paddingClass,
        inputClass,
      ]"
      @input="onInput"
      @keydown="onKeydown"
    />
    <div
      v-if="$slots.trailing"
      class="absolute right-3 top-3 z-[1] flex items-start"
    >
      <slot name="trailing" />
    </div>
  </div>
</template>
