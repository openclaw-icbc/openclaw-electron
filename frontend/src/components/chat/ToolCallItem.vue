<template>
  <div class="tool-call-item" :class="[`tool-${toolPhase}`, { expanded: isExpanded, 'has-error': hasError }]">
    <!-- 工具调用头部 -->
    <div class="tool-call-header" @click="toggleExpand">
      <div class="tool-icon">
        <component :is="toolIcon" />
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
  return toolArgs.value && Object.keys(toolArgs.value).length > 0
})

const statusText = computed(() => {
  if (hasError.value) return '执行失败'
  if (toolPhase.value === 'start') return '调用中...'
  if (toolPhase.value === 'update') return '执行中...'
  if (toolPhase.value === 'result') return '已完成'
  return ''
})

const toolIcon = computed(() => {
  // 根据工具类型返回不同图标
  const kind = props.message.metadata?.kind
  if (kind === 'search') return 'SearchIcon'
  if (kind === 'bash') return 'TerminalIcon'
  if (kind === 'browser') return 'GlobeIcon'
  return 'ToolIcon'
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

<script lang="ts">
// 图标组件
const SearchIcon = {
  template: `
    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
      <path d="M11.742 10.344a6.5 6.5 0 1 0-1.397 1.398h-.001c.03.04.062.078.098.115l3.85 3.85a1 1 0 0 0 1.415-1.414l-3.85-3.85a1.007 1.007 0 0 0-.115-.1zM12 6.5a5.5 5.5 0 1 1-11 0 5.5 5.5 0 0 1 11 0z"/>
    </svg>
  `
}

const TerminalIcon = {
  template: `
    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
      <path d="M6 12.796V3.204L11.481 8 6 12.796zm.659.753 5.48-4.796a1 1 0 0 0 0-1.506L6.66 2.451C6.011 1.885 5 2.345 5 3.204v9.592a1 1 0 0 0 1.659.753z"/>
    </svg>
  `
}

const GlobeIcon = {
  template: `
    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
      <path d="M8 0a8 8 0 1 0 0 16A8 8 0 0 0 8 0zM4.285 12.433c.378-.377.888-.591 1.416-.591.529 0 .963.233 1.274.615.09.109.135.237.135.376 0 .273-.22.494-.494.494H4.285zm8.43 0c-.378-.377-.888-.591-1.416-.591-.529 0-.963.233-1.274.615-.09.109-.135.237-.135.376 0 .273.22.494.494.494h2.332zM8 1.07c-2.34 0-4.38 1.17-5.5 2.93h11C12.38 2.24 10.34 1.07 8 1.07zM2.5 5.5c-.28 0-.5.22-.5.5s.22.5.5.5h11c.28 0 .5-.22.5-.5s-.22-.5-.5-.5h-11zm0 3c-.28 0-.5.22-.5.5s.22.5.5.5h11c.28 0 .5-.22.5-.5s-.22-.5-.5-.5h-11zm0 3c-.28 0-.5.22-.5.5s.22.5.5.5h11c.28 0 .5-.22.5-.5s-.22-.5-.5-.5h-11z"/>
    </svg>
  `
}

const ToolIcon = {
  template: `
    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
      <path d="M8.186 1.113a.5.5 0 0 0-.372 0L1.846 3.5l2.404.961L10.404 2l-2.218-.887zm3.564 1.426L5.596 5 8 5.961 14.154 3.5l-2.404-.961zm3.25 1.7-6.5 2.6v7.922l6.5-2.6V4.24zM7.5 14.762V6.838L1 4.239v7.923l6.5 2.6zM7.443.184a1.5 1.5 0 0 1 1.114 0l7.129 2.852A.5.5 0 0 1 16 3.5v8.662a1 1 0 0 1-.629.928l-7.185 2.874a.5.5 0 0 1-.372 0L.63 13.09a1 1 0 0 1-.63-.928V3.5a.5.5 0 0 1 .314-.464L7.443.184z"/>
    </svg>
  `
}

export default {
  components: {
    SearchIcon,
    TerminalIcon,
    GlobeIcon,
    ToolIcon
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
  color: hsl(45, 93%, 50%);
}

.tool-result .tool-icon {
  background: hsl(142, 76%, 36% / 0.2);
  color: hsl(142, 76%, 45%);
}

.has-error .tool-icon {
  background: hsl(var(--destructive) / 0.2);
  color: hsl(var(--destructive) / 0.9);
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
