<template>
  <div class="message-input-container">
    <div class="relative">
      <textarea
        ref="textareaRef"
        v-model="messageText"
        class="textarea pr-16"
        :placeholder="placeholder"
        rows="3"
        :disabled="disabled"
        @input="handleInput"
        @keydown="handleKeydown"
      ></textarea>
      <button
        class="btn btn-primary absolute bottom-3 right-3"
        :disabled="!canSend"
        @click="handleSend"
      >
        发送
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, nextTick, watch } from 'vue'

interface Props {
  disabled?: boolean
  placeholder?: string
}

const props = withDefaults(defineProps<Props>(), {
  disabled: true,
  placeholder: '选择或创建一个会话后开始聊天 (Ctrl+Enter 发送)'
})

const emit = defineEmits<{
  send: [message: string]
}>()

const messageText = ref('')
const textareaRef = ref<HTMLTextAreaElement>()

const canSend = computed(() => {
  return !props.disabled && messageText.value.trim().length > 0
})

function handleInput() {
  // 自动调整高度
  if (textareaRef.value) {
    textareaRef.value.style.height = 'auto'
    textareaRef.value.style.height = textareaRef.value.scrollHeight + 'px'
  }
}

function handleKeydown(event: KeyboardEvent) {
  if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
    event.preventDefault()
    handleSend()
  }
}

function handleSend() {
  if (!canSend.value) return

  const message = messageText.value.trim()
  if (message) {
    emit('send', message)
    messageText.value = ''

    // 重置高度
    if (textareaRef.value) {
      textareaRef.value.style.height = 'auto'
    }
  }
}

// 暴露 focus 方法
function focus() {
  nextTick(() => {
    textareaRef.value?.focus()
  })
}

defineExpose({
  focus
})

// 监听 disabled 变化，自动 focus
watch(() => props.disabled, (newVal, oldVal) => {
  if (oldVal && !newVal) {
    focus()
  }
})
</script>

<style scoped>
.message-input-container {
  padding: 1rem 1.25rem;
  background: hsl(var(--background));
  border-top: 1px solid hsl(var(--border));
}

.textarea {
  width: 100%;
  padding: 0.75rem;
  border: 1px solid hsl(var(--input));
  border-radius: calc(var(--radius) - 2px);
  background: hsl(var(--background));
  color: hsl(var(--foreground));
  font-size: 0.875rem;
  line-height: 1.25rem;
  resize: none;
  font-family: inherit;
  min-height: 76px;
  max-height: 200px;
  overflow-y: auto;
}

.textarea:focus {
  outline: none;
  border-color: hsl(var(--ring));
  box-shadow: 0 0 0 2px hsl(var(--ring) / 0.2);
}

.textarea:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.textarea::placeholder {
  color: hsl(var(--muted-foreground));
}
</style>
