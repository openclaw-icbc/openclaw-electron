<template>
  <div class="tool-call-item" :class="[`tool-${toolPhase}`, { expanded: isExpanded, 'has-error': hasError }]">
    <!-- 工具调用头部 -->
    <div class="tool-call-header" @click="toggleExpand">
      <div class="tool-icon">
        <!-- 搜索类工具 -->
        <svg v-if="toolKind === 'search'" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>
        </svg>
        <!-- 终端/Bash 类工具 -->
        <svg v-else-if="toolKind === 'bash' || toolKind === 'terminal'" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="4 17 10 11 4 5"/><line x1="12" x2="20" y1="19" y2="19"/>
        </svg>
        <!-- 浏览器/网络类工具 -->
        <svg v-else-if="toolKind === 'browser' || toolKind === 'web' || toolKind === 'fetch'" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/><path d="M2 12h20"/>
        </svg>
        <!-- 文件读写类工具 -->
        <svg v-else-if="toolKind === 'read' || toolKind === 'file'" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M8 13h2"/><path d="M8 17h2"/><path d="M14 13h2"/><path d="M14 17h2"/>
        </svg>
        <!-- 默认：闪电（表示执行/动作） -->
        <svg v-else width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z"/>
        </svg>
      </div>
      <div class="tool-info">
        <div class="tool-title">{{ toolTitle }}</div>
        <div class="tool-meta">
          <span class="tool-status">{{ statusText }}</span>
        </div>
      </div>
      <div class="tool-expand-icon" v-if="canExpand">
        <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
          <path :class="{ rotated: isExpanded }" d="M4 6l4 4 4-4H4z"/>
        </svg>
      </div>
    </div>

    <!-- 可展开的工具详情 -->
    <div v-if="isExpanded && canExpand" class="tool-details">
      <!-- 工具参数 -->
      <div v-if="toolArgs && Object.keys(toolArgs).length > 0" class="tool-section">
        <div class="tool-section-title">参数</div>
        <pre class="tool-section-content">{{ formatJSON(toolArgs) }}</pre>
      </div>

      <!-- 工具进度 -->
      <div v-if="toolPhase === 'update' && partialResult" class="tool-section">
        <div class="tool-section-title">执行中</div>
        <div class="tool-section-content tool-progress">
          <div class="progress-spinner"></div>
          <span>{{ partialResult }}</span>
        </div>
      </div>

      <!-- 工具结果 -->
      <div v-if="toolPhase === 'result'" class="tool-section">
        <div class="tool-section-title">
          {{ hasError ? '错误' : '结果' }}
        </div>
        <div v-if="hasError" class="tool-section-content tool-error">
          {{ errorMessage || '执行失败' }}
        </div>
        <pre v-else class="tool-section-content">{{ formatJSON(toolResult) }}</pre>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import type { Message } from '@/types'

interface Props {
  message: Message
}

const props = withDefaults(defineProps<Props>(), {})

const isExpanded = ref(false)

const toolPhase = computed(() => props.message.metadata?.phase || 'start')
const toolName = computed(() => props.message.metadata?.toolName || 'unknown')
const toolTitle = computed(() => props.message.metadata?.toolTitle || toolName.value)
const toolArgs = computed(() => props.message.metadata?.args)
const toolResult = computed(() => props.message.metadata?.result)
const partialResult = computed(() => props.message.metadata?.partialResult)
const hasError = computed(() => props.message.metadata?.isError === true)
const errorMessage = computed(() => props.message.metadata?.error)
const messageStatus = computed(() => props.message.status)

const canExpand = computed(() => {
  const hasArgs = toolArgs.value && Object.keys(toolArgs.value).length > 0
  const hasResult = toolPhase.value === 'result' && (toolResult.value != null || hasError.value)
  const hasProgress = toolPhase.value === 'update' && !!partialResult.value
  return hasArgs || hasResult || hasProgress
})

const statusText = computed(() => {
  if (hasError.value) return '执行失败'
  if (toolPhase.value === 'start') return '调用中...'
  if (toolPhase.value === 'update') return '执行中...'
  if (toolPhase.value === 'result') return '已完成'
  return ''
})

const toolKind = computed(() => {
  return props.message.metadata?.kind || ''
})

function toggleExpand() {
  if (canExpand.value) {
    isExpanded.value = !isExpanded.value
  }
}

function formatJSON(data: any): string {
  if (!data) return ''
  try {
    return JSON.stringify(data, null, 2)
  } catch {
    return String(data)
  }
}
</script>

<style scoped>
.tool-call-item {
  margin: 0.25rem 0;
  border-radius: 0.375rem;
  border: 1px solid hsl(var(--muted) / 0.6);
  background: hsl(var(--muted) / 0.15);
  overflow: hidden;
  transition: all 0.15s ease;
  width: 100%;
  max-width: 100%;
  text-align: left;
}

.tool-call-item:hover {
  border-color: hsl(var(--muted) / 0.8);
  background: hsl(var(--muted) / 0.2);
}

.tool-call-item.tool-start {
  border-left: 2px solid hsl(var(--primary) / 0.7);
}

.tool-call-item.tool-update {
  border-left: 2px solid hsl(45, 93%, 50%);
  animation: pulse-border 2s infinite;
}

.tool-call-item.tool-result {
  border-left: 2px solid hsl(142, 76%, 40%);
}

.tool-call-item.has-error {
  border-left: 2px solid hsl(var(--destructive) / 0.8);
  background: hsl(var(--destructive) / 0.08);
}

@keyframes pulse-border {
  0%, 100% { border-left-color: hsl(45, 93%, 50%); }
  50% { border-left-color: hsl(45, 93%, 40%); }
}

.tool-call-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 0.75rem;
  cursor: pointer;
  user-select: none;
}

.tool-icon {
  flex-shrink: 0;
  width: 24px;
  height: 24px;
  border-radius: 0.25rem;
  background: hsl(var(--muted) / 0.4);
  display: flex;
  align-items: center;
  justify-content: center;
  color: hsl(var(--muted-foreground));
  font-size: 0.8125rem;
}

.tool-update .tool-icon {
  background: hsl(45, 93%, 47% / 0.2);
}

.tool-result .tool-icon {
  background: hsl(142, 76%, 36% / 0.2);
}

.has-error .tool-icon {
  background: hsl(var(--destructive) / 0.2);
}

.tool-info {
  flex: 1;
  min-width: 0;
}

.tool-title {
  font-weight: 500;
  font-size: 0.8125rem;
  color: hsl(var(--foreground));
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  line-height: 1.4;
}

.tool-meta {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  font-size: 0.75rem;
  color: hsl(var(--muted-foreground));
  margin-top: 0.125rem;
}

.tool-status {
  color: hsl(var(--muted-foreground));
}

.tool-update .tool-status {
  color: hsl(45, 93%, 50%);
}

.tool-result .tool-status {
  color: hsl(142, 76%, 45%);
}

.has-error .tool-status {
  color: hsl(var(--destructive) / 0.9);
}

.tool-expand-icon {
  flex-shrink: 0;
  color: hsl(var(--muted-foreground));
  transition: transform 0.2s ease;
  opacity: 0.6;
}

.tool-expand-icon svg path {
  transition: transform 0.2s ease;
  transform-origin: center;
}

.tool-expand-icon svg path.rotated {
  transform: rotate(180deg);
}

.tool-details {
  border-top: 1px solid hsl(var(--muted) / 0.4);
  background: hsl(var(--background) / 0.5);
}

.tool-section {
  padding: 0.5rem 0.75rem;
}

.tool-section:not(:last-child) {
  border-bottom: 1px solid hsl(var(--muted) / 0.3);
}

.tool-section-title {
  font-size: 0.6875rem;
  font-weight: 600;
  color: hsl(var(--muted-foreground));
  margin-bottom: 0.375rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.tool-section-content {
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
  font-size: 0.8125rem;
  color: hsl(var(--foreground));
  background: hsl(var(--muted) / 0.25);
  padding: 0.625rem;
  border-radius: 0.25rem;
  overflow-x: auto;
  white-space: pre-wrap;
  word-break: break-all;
  margin: 0;
  line-height: 1.4;
}

.tool-progress {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  background: transparent;
  padding: 0;
}

.progress-spinner {
  width: 14px;
  height: 14px;
  border: 1.5px solid hsl(var(--muted) / 0.4);
  border-top-color: hsl(45, 93%, 50%);
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.tool-error {
  background: hsl(var(--destructive) / 0.12);
  color: hsl(var(--destructive));
  border: 1px solid hsl(var(--destructive) / 0.4);
}
</style>
