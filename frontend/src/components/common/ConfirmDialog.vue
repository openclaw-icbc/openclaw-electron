<template>
  <Teleport to="body">
    <Transition name="dialog">
      <div v-if="open" class="dialog-overlay" @click="handleCancel">
        <div class="dialog" @click.stop>
          <h3>{{ title }}</h3>
          <p>{{ message }}</p>
          <div class="dialog-buttons">
            <button class="btn btn-secondary" @click="handleCancel">
              {{ cancelText }}
            </button>
            <button
              class="btn"
              :class="danger ? 'btn-danger' : 'btn-primary'"
              @click="handleConfirm"
            >
              {{ confirmText }}
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { ref } from 'vue'

interface Props {
  title?: string
  message?: string
  confirmText?: string
  cancelText?: string
  danger?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  title: 'Confirm',
  message: 'Are you sure?',
  confirmText: 'Confirm',
  cancelText: 'Cancel',
  danger: false,
})

const emit = defineEmits<{
  confirm: []
  cancel: []
}>()

const open = ref(false)

function show() {
  open.value = true
}

function hide() {
  open.value = false
}

function handleConfirm() {
  hide()
  emit('confirm')
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
  padding: 1rem 1.25rem 0.75rem;
  min-width: 320px;
  max-width: 420px;
  width: auto;
  height: auto;
  box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1);
}

.dialog h3 {
  margin: 0 0 0.375rem 0;
  font-size: 0.9375rem;
  font-weight: 600;
  color: hsl(var(--foreground));
  line-height: 1.4;
}

.dialog p {
  margin: 0 0 0.5rem 0;
  font-size: 0.875rem;
  color: hsl(var(--muted-foreground));
  line-height: 1.4;
}

.dialog-buttons {
  display: flex;
  gap: 0.5rem;
  justify-content: flex-end;
}

.btn-danger {
  background: hsl(var(--destructive));
  color: white;
  border: none;
  padding: 0.5rem 1rem;
  border-radius: calc(var(--radius) - 2px);
  cursor: pointer;
  font-size: 0.875rem;
  font-weight: 500;
  transition: opacity 0.15s;
}

.btn-danger:hover {
  opacity: 0.9;
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
