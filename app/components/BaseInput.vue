<script setup lang="ts">
import { computed, useSlots } from 'vue'

withDefaults(
  defineProps<{
    modelValue?: string
    type?: string
    placeholder?: string
    id?: string
    name?: string
    disabled?: boolean
    readonly?: boolean
    wrapperId?: string
  }>(),
  {
    modelValue: '',
    type: 'text',
    placeholder: '',
    id: undefined,
    name: undefined,
    disabled: false,
    readonly: false,
    wrapperId: undefined,
  },
)

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

const slots = useSlots()

const hasTrailing = computed(() => Boolean(slots.trailing))

function onInput(e: Event) {
  const el = e.target as HTMLInputElement
  emit('update:modelValue', el.value)
}
</script>

<template>
  <div :id="wrapperId" class="relative w-full">
    <div
      v-if="$slots.leading"
      class="pointer-events-none absolute left-4 top-1/2 z-[1] flex -translate-y-1/2 items-center text-gray-400"
    >
      <slot name="leading" />
    </div>
    <input
      :id="id"
      :name="name"
      :type="type"
      :value="modelValue"
      :disabled="disabled"
      :readonly="readonly"
      :placeholder="placeholder"
      :class="[
        'w-full rounded-xl border border-gray-200 bg-gray-50 py-3.5 pl-12 text-sm text-gray-900 placeholder:text-gray-400 transition-all focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-100 disabled:cursor-not-allowed disabled:opacity-60 read-only:cursor-default read-only:border-gray-200 read-only:bg-gray-100 read-only:text-gray-700 dark:border-dark-outline/50 dark:bg-dark-surface-container-low dark:text-dark-on-surface dark:placeholder:text-dark-on-surface-variant/70 dark:read-only:bg-dark-surface-container-high dark:read-only:text-dark-on-surface',
        hasTrailing ? 'pr-12' : 'pr-4',
      ]"
      @input="onInput"
    />
    <div
      v-if="$slots.trailing"
      class="absolute right-3 top-1/2 z-[1] flex -translate-y-1/2 items-center"
    >
      <slot name="trailing" />
    </div>
  </div>
</template>
