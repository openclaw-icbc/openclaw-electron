<template>
  <Teleport to="body">
    <Transition name="dialog">
      <div v-if="open" class="dialog-overlay" @click="handleCancel">
        <div class="dialog" @click.stop>
          <h3>{{ title }}</h3>
          <p v-if="message">{{ message }}</p>
          <div class="dialog-input-wrapper">
            <input
              ref="inputRef"
              v-model="inputValue"
              type="text"
              class="dialog-input"
              :placeholder="placeholder"
              @keyup.enter="handleConfirm"
              @keyup.esc="handleCancel"
            />
          </div>
          <div class="dialog-buttons">
            <button class="btn btn-secondary" @click="handleCancel">
              {{ cancelText }}
            </button>
            <button class="btn btn-primary" @click="handleConfirm" :disabled="!inputValue.trim()">
              {{ confirmText }}
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, nextTick } from 'vue'

interface Props {
  title?: string
  message?: string
  placeholder?: string
  defaultValue?: string
  confirmText?: string
  cancelText?: string
}

const props = withDefaults(defineProps<Props>(), {
  title: '请输入',
  message: '',
  placeholder: '',
  defaultValue: '',
  confirmText: '确定',
  cancelText: '取消'
})

const emit = defineEmits<{
  confirm: [value: string]
  cancel: []
}>()

const open = ref(false)
const inputValue = ref('')
const inputRef = ref<HTMLInputElement | null>(null)

function show() {
  inputValue.value = props.defaultValue || ''
  open.value = true
  // 自动聚焦输入框
  nextTick(() => {
    inputRef.value?.focus()
    inputRef.value?.select()
  })
}

function hide() {
  open.value = false
}

function handleConfirm() {
  const value = inputValue.value.trim()
  if (!value) return
  hide()
  emit('confirm', value)
}

function handleCancel() {
  hide()
  emit('cancel')
}

defineExpose({
  show,
  hide
})
</script>

<style scoped>
.dialog-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.dialog {
  background: white;
  border-radius: calc(var(--radius) - 2px);
  padding: 1.25rem 1.5rem;
  min-width: 340px;
  max-width: 440px;
  width: auto;
  max-height: 200px;
  box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1);
}

.dialog h3 {
  margin: 0 0 0.5rem 0;
  font-size: 0.9375rem;
  font-weight: 600;
  color: hsl(var(--foreground));
  line-height: 1.4;
}

.dialog p {
  margin: 0 0 0.625rem 0;
  font-size: 0.875rem;
  color: hsl(var(--muted-foreground));
  line-height: 1.4;
}

.dialog-input-wrapper {
  margin-bottom: 0.75rem;
}

.dialog-input {
  width: 100%;
  padding: 0.5rem 0.625rem;
  font-size: 0.875rem;
  border: 1px solid hsl(var(--border));
  border-radius: calc(var(--radius) - 2px);
  background: hsl(var(--background));
  color: hsl(var(--foreground));
  box-sizing: border-box;
  height: 2rem;
}

.dialog-input:focus {
  outline: none;
  border-color: hsl(var(--ring));
  box-shadow: 0 0 0 2px hsl(var(--ring) / 0.2);
}

.dialog-buttons {
  display: flex;
  gap: 0.5rem;
  justify-content: flex-end;
}

.dialog-enter-active,
.dialog-leave-active {
  transition: opacity 0.3s ease;
}

.dialog-enter-from,
.dialog-leave-to {
  opacity: 0;
}
</style>
