<template>
  <Teleport to="body">
    <Transition name="dialog">
      <div v-if="open" class="dialog-overlay" @click="handleClose">
        <div class="dialog" @click.stop>
          <div class="dialog-header">
            <h3 class="dialog-title">设置</h3>
            <button class="dialog-close-btn" @click="handleClose">×</button>
          </div>

          <div class="dialog-nav">
            <div
              v-for="tab in tabs"
              :key="tab.key"
              class="tabs-trigger"
              :class="{ active: activeTab === tab.key }"
              @click="switchTab(tab.key)"
            >
              <span class="text-base">{{ tab.icon }}</span>
              <span class="text-sm font-medium">{{ tab.label }}</span>
            </div>
          </div>

          <div class="dialog-content custom-scrollbar">
            <SessionsPanel v-if="activeTab === 'sessions'" />
            <CronPanel v-else-if="activeTab === 'cron'" />
            <ConfigPanel v-else-if="activeTab === 'config'" />
            <LogsPanel v-else-if="activeTab === 'logs'" />
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { storeToRefs } from 'pinia'
import { useUiStore } from '@/stores'

// 占位组件 - 后续实现
import SessionsPanel from './SessionsPanel.vue'
import CronPanel from './CronPanel.vue'
import ConfigPanel from './ConfigPanel.vue'
import LogsPanel from './LogsPanel.vue'

const uiStore = useUiStore()
const { settingsDialogOpen: open, settingsActiveTab: activeTab } = storeToRefs(uiStore)

const tabs = [
  { key: 'sessions', icon: '📋', label: '对话列表' },
  { key: 'cron', icon: '⏰', label: '定时任务' },
  { key: 'config', icon: '⚙️', label: '配置' },
  { key: 'logs', icon: '📝', label: '日志' }
]

function handleClose() {
  uiStore.closeSettings()
}

function switchTab(key: string) {
  uiStore.switchSettingsTab(key)
}
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
  width: 90vw;
  height: 80vh;
  max-width: 900px;
  max-height: 700px;
  display: flex;
  flex-direction: column;
  box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1);
}

.dialog-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem 1.5rem;
  border-bottom: 1px solid hsl(var(--border));
}

.dialog-title {
  font-size: 1.125rem;
  font-weight: 600;
  margin: 0;
}

.dialog-close-btn {
  width: 32px;
  height: 32px;
  border: none;
  background: none;
  font-size: 1.5rem;
  cursor: pointer;
  border-radius: 0.25rem;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background-color 0.15s ease;
}

.dialog-close-btn:hover {
  background: hsl(var(--muted));
}

.dialog-nav {
  display: flex;
  border-bottom: 1px solid hsl(var(--border));
  padding: 0 1rem;
}

.tabs-trigger {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem 1rem;
  cursor: pointer;
  border-bottom: 2px solid transparent;
  transition: all 0.15s ease;
}

.tabs-trigger:hover {
  background: hsl(var(--muted) / 0.5);
}

.tabs-trigger.active {
  border-bottom-color: hsl(var(--primary));
}

.dialog-content {
  flex: 1;
  overflow-y: auto;
  padding: 1.5rem;
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
