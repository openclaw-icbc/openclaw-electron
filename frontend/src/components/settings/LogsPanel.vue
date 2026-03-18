<template>
  <div class="logs-panel">
    <h4 class="text-base font-semibold mb-4">客户端日志</h4>

    <ConfirmDialog
      ref="confirmDialogRef"
      title="确认清除"
      message="确定要清除所有日志吗？"
      confirm-text="清除"
      cancel-text="取消"
      @confirm="onConfirmClear"
    />

    <div class="logs-content-wrapper">
      <div class="logs-controls">
        <select v-model="localFilter" class="select">
          <option value="">所有级别</option>
          <option value="info">信息</option>
          <option value="warn">警告</option>
          <option value="error">错误</option>
          <option value="debug">调试</option>
        </select>
        <input
          v-model.number="localLimit"
          type="number"
          class="input w-24"
          min="10"
          max="5000"
        />
        <button class="btn btn-sm" @click="handleRefresh">刷新</button>
        <button class="btn btn-sm" @click="handleClear">清除日志</button>
      </div>
      <pre class="logs-content">{{ logsText }}</pre>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { useLogsStore } from '@/stores'
import ConfirmDialog from '@/components/common/ConfirmDialog.vue'

const logsStore = useLogsStore()
const { logs, filter, limit } = storeToRefs(logsStore)

const localFilter = ref(filter.value)
const localLimit = ref(limit.value)
const confirmDialogRef = ref<InstanceType<typeof ConfirmDialog> | null>(null)

const logsText = computed(() => {
  return logs.value
    .map(log => {
      const timestamp = new Date(log.timestamp).toISOString()
      return `[${timestamp}] [${log.level.toUpperCase()}] [${log.source}] ${log.message}`
    })
    .join('\n')
})

watch(localFilter, (value) => {
  logsStore.setFilter(value)
})

watch(localLimit, (value) => {
  logsStore.setLimit(value)
})

async function handleRefresh() {
  await logsStore.refresh()
}

function handleClear() {
  confirmDialogRef.value?.show()
}

async function onConfirmClear() {
  await logsStore.clearLogs()
}
</script>

<style scoped>
.logs-content-wrapper {
  display: flex;
  flex-direction: column;
  height: 500px;
}

.logs-controls {
  display: flex;
  gap: 0.75rem;
  margin-bottom: 1rem;
  align-items: center;
}

.select,
.input {
  padding: 0.5rem 0.75rem;
  border: 1px solid hsl(var(--input));
  border-radius: calc(var(--radius) - 4px);
  background: hsl(var(--background));
  color: hsl(var(--foreground));
  font-size: 0.875rem;
}

.logs-content {
  flex: 1;
  background: hsl(var(--muted) / 0.3);
  border: 1px solid hsl(var(--border));
  border-radius: calc(var(--radius) - 4px);
  padding: 1rem;
  overflow-y: auto;
  font-family: 'Courier New', monospace;
  font-size: 0.75rem;
  line-height: 1.4;
  color: hsl(var(--foreground));
  margin: 0;
}
</style>
