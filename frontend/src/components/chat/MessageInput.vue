<template>
  <div class="message-input-container">
    <div class="relative">
      <textarea
        ref="textareaRef"
        v-model="messageText"
        class="textarea pr-16"
        :placeholder="placeholder"
        rows="3"
        :disabled="disabled || isSending"
        @input="handleInput"
        @keydown="handleKeydown"
      ></textarea>
      <button
        v-if="!isSending"
        class="btn btn-primary absolute bottom-3 right-3"
        :disabled="!canSend"
        @click="handleSend"
      >
        发送
      </button>
      <button
        v-else
        class="btn btn-stop absolute bottom-3 right-3"
        :disabled="!canAbort"
        @click="handleAbort"
        title="停止生成"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
          <rect x="6" y="6" width="12" height="12" rx="1" />
        </svg>
        <span class="ml-1">停止</span>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, nextTick, watch } from 'vue'

interface Props {
  disabled?: boolean
  placeholder?: string
  canAbort?: boolean
  isSending?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  disabled: true,
  placeholder: '选择或创建一个会话后开始聊天 (Ctrl+Enter 发送)',
  canAbort: false,
  isSending: false
})

const emit = defineEmits<{
  send: [message: string]
  abort: []
}>()

const messageText = ref('')
const textareaRef = ref<HTMLTextAreaElement>()

const canSend = computed(() => {
  return !props.disabled && !props.isSending && messageText.value.trim().length > 0
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

function handleAbort() {
  if (!props.canAbort) return
  emit('abort')
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

.btn-stop {
  width: auto;
  min-width: 70px;
  height: 32px;
  padding: 0.8px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: hsl(var(--destructive));
  color: white;
  border: none;
  border-radius: calc(var(--radius) - 2px);
  cursor: pointer;
  transition: all 0.15s ease;
}

.btn-stop:hover:not(:disabled) {
  background: hsl(var(--destructive) / 0.8);
  transform: scale(1.05);
}

.btn-stop:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
