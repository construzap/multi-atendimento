<script setup lang="ts">
import { onBeforeUnmount, watch } from 'vue'
import { EditorContent, useEditor } from '@tiptap/vue-3'
import Placeholder from '@tiptap/extension-placeholder'
import StarterKit from '@tiptap/starter-kit'

const props = withDefaults(
  defineProps<{
    modelValue: string
    id?: string
  }>(),
  {
    id: undefined
  }
)

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

const editor = useEditor({
  extensions: [
    StarterKit,
    Placeholder.configure({
      placeholder: 'Descreva o objetivo deste workspace...'
    })
  ],
  content: props.modelValue || '',
  editorProps: {
    attributes: {
      class:
        'min-h-[140px] max-w-none px-3 py-2.5 text-sm text-gray-900 focus:outline-none dark:text-dark-on-surface'
    }
  },
  onUpdate: ({ editor }) => {
    emit('update:modelValue', editor.getHTML())
  }
})

watch(
  () => props.modelValue,
  (html) => {
    const e = editor.value
    if (!e) return
    const next = html ?? ''
    if (next === e.getHTML()) return
    e.commands.setContent(next, { emitUpdate: false })
  }
)

onBeforeUnmount(() => {
  editor.value?.destroy()
})
</script>

<template>
  <div
    :id="id"
    class="overflow-hidden rounded-xl border border-gray-200 bg-gray-50 transition-colors dark:border-dark-outline/50 dark:bg-dark-surface-container-low"
  >
    <EditorContent v-if="editor" :editor="editor" class="workspace-rich-text" />
  </div>
</template>

<style scoped>
.workspace-rich-text :deep(.ProseMirror) {
  min-height: 140px;
  outline: none;
}
.workspace-rich-text :deep(.ProseMirror p.is-editor-empty:first-child::before) {
  color: rgb(156 163 175);
  content: attr(data-placeholder);
  float: left;
  height: 0;
  pointer-events: none;
}
.dark .workspace-rich-text :deep(.ProseMirror p.is-editor-empty:first-child::before) {
  color: rgb(148 163 184 / 0.7);
}
</style>
