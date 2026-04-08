<template>
  <div
    class="message-item"
    :class="[
      `message-${message.role}`,
      { streaming: isActuallyStreaming, 'is-tool-call': isToolCallMessage }
    ]"
  >
    <!-- 工具调用消息：完全左对齐，无额外布局 -->
    <template v-if="isToolCallMessage">
      <div class="tool-call-container">
        <ToolCallItem :message="message" />
      </div>
    </template>

    <!-- 普通消息 -->
    <template v-else>
      <div class="message-avatar">
        {{ avatarText }}
      </div>
      <div class="message-content-wrapper">
        <div class="message-header">
          <span class="message-sender">{{ senderName }}</span>
          <span class="message-time">{{ formattedTime }}</span>
        </div>
        <div class="message-content" v-html="renderedContent"></div>
        <div v-if="message.status" class="message-status">
          <span v-if="message.status === 'sending'" class="status-sending">发送中...</span>
          <span v-else-if="message.status === 'error'" class="status-error">发送失败</span>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { Message } from '@/types'
import { renderMarkdownSync, formatTimestamp } from '@/utils'
import ToolCallItem from './ToolCallItem.vue'

interface Props {
  message: Message
  isStreaming?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  isStreaming: false
})

// 判断是否是工具调用消息
const isToolCallMessage = computed(() => {
  const type = props.message.metadata?.type
  return type === 'tool_call' || type === 'tool_result' || type === 'tool_error'
})

// 判断是否真正在流式传输（状态为streaming且isStreaming为true）
const isActuallyStreaming = computed(() => {
  return props.isStreaming && props.message.status === 'streaming'
})

const avatarText = computed(() => {
  if (props.message.role === 'user') return 'U'
  if (props.message.role === 'system') return '🔧'
  return 'A'
})

const senderName = computed(() => {
  if (props.message.role === 'user') return '你'
  if (props.message.role === 'system') {
    // 如果是工具消息，显示工具名称
    if (props.message.metadata?.type === 'tool_call' || props.message.metadata?.type === 'tool_result') {
      return `工具: ${props.message.metadata.toolName || 'unknown'}`
    }
    return '系统'
  }
  return 'Assistant'
})

const formattedTime = computed(() => {
  return formatTimestamp(props.message.timestamp)
})

const renderedContent = computed(() => {
  let content = props.message.content || ''

  // Handle array content (convert to string)
  if (Array.isArray(content)) {
    content = content.map((part: any) => {
      if (typeof part === 'string') return part
      if (part && typeof part === 'object') {
        // Handle OpenAI format content parts
        if (part.type === 'text' && part.text) return part.text
        if (part.type === 'image_url') return '[图片]'
        if (part.type === 'tool_use' || part.type === 'tool_use_call') return `[工具调用: ${part.name || part.id || 'unknown'}]`
        if (part.type === 'tool_result') return `[工具结果]`
        if (part.content) return part.content
        if (part.text) return part.text
        // For unknown object types, try to extract useful info
        if (part.type) return `[${part.type}]`
        // Skip unknown objects
        return ''
      }
      return String(part)
    }).filter(Boolean).join('')
  }

  // 处理工具调用和思考标记，使其更醒目
  content = content
    // 处理 [工具调用: xxx]
    .replace(/\[工具调用:\s*([^\]]+)\]/g, (match, toolName) => {
      return `<span class="tool-call-badge">🔧 调用工具: ${toolName}</span>`
    })
    // 处理 [工具结果]
    .replace(/\[工具结果\]/g, '<span class="tool-result-badge">📋 工具结果</span>')
    // 处理 [thinking]
    .replace(/\[thinking\]/g, '<span class="thinking-badge">💭 思考中...</span>')
    // 处理 [toolCall]...[/toolCall]
    .replace(/\[toolCall\](.*?)\[\/toolCall\]/g, (match, toolName) => {
      return `<span class="tool-call-badge">🔧 调用工具: ${toolName}</span>`
    })
    // 处理 [toolResult]
    .replace(/\[toolResult\]/g, '<span class="tool-result-badge">📋 工具结果</span>')
    // 处理单独的 [toolCall]（没有闭合标签）
    .replace(/\[toolCall\]/g, '<span class="tool-call-badge">🔧 工具调用</span>')

  // 检查是否应该显示光标：必须是流式状态且isStreaming为true
  const shouldShowCursor = isActuallyStreaming.value

  // 如果是流式消息且内容为空，显示输入提示
  if (shouldShowCursor && !content) {
    return '<span class="streaming-cursor">▊</span>'
  }

  const html = renderMarkdownSync(content)

  // 只有在真正流式传输时才添加光标
  if (shouldShowCursor) {
    return html + '<span class="streaming-cursor">▊</span>'
  }

  return html
})
</script>

<style scoped>
.message-item {
  display: flex;
  gap: 0.75rem;
  padding: 0.75rem;
  border-radius: calc(var(--radius) - 2px);
  transition: background-color 0.15s ease;
}

.message-item:hover {
  background: hsl(var(--muted) / 0.3);
}

.message-item.streaming {
  background: hsl(var(--muted) / 0.2);
}

/* 工具调用消息样式：完全左对齐 */
.message-item.is-tool-call {
  display: block;
  padding: 0;
  margin: 0;
  background: transparent;
}

.message-item.is-tool-call:hover {
  background: transparent;
}

.tool-call-container {
  width: 100%;
  text-align: left;
}

.message-avatar {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: hsl(var(--primary));
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 600;
  font-size: 0.875rem;
  flex-shrink: 0;
}

.message-user .message-avatar {
  background: hsl(var(--secondary));
}

/* 系统消息样式（不包括工具调用消息） */
.message-system:not(.is-tool-call) .message-avatar {
  background: hsl(var(--muted));
  font-size: 1.25rem;
}

.message-system:not(.is-tool-call) .message-content-wrapper {
  background: hsl(var(--muted) / 0.2);
  border-radius: calc(var(--radius) - 2px);
  padding: 0.75rem;
}

.message-system:not(.is-tool-call) .message-content {
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
  font-size: 0.8125rem;
  white-space: pre-wrap;
  word-break: break-all;
}

.message-content-wrapper {
  flex: 1;
  min-width: 0;
}

.message-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.375rem;
}

.message-sender {
  font-weight: 600;
  font-size: 0.875rem;
  color: hsl(var(--foreground));
}

.message-time {
  font-size: 0.75rem;
  color: hsl(var(--muted-foreground));
}

.message-content {
  font-size: 0.875rem;
  line-height: 1.5;
  color: hsl(var(--foreground));
  word-break: break-word;
}

.message-content :deep(p) {
  margin: 0.375rem 0;
}

.message-content :deep(p:first-child) {
  margin-top: 0;
}

.message-content :deep(p:last-child) {
  margin-bottom: 0;
}

.message-content :deep(pre) {
  background: hsl(var(--muted));
  border-radius: calc(var(--radius) - 4px);
  padding: 0.75rem;
  overflow-x: auto;
  margin: 0.5rem 0;
}

.message-content :deep(code) {
  background: hsl(var(--muted));
  padding: 0.125rem 0.25rem;
  border-radius: 0.25rem;
  font-size: 0.8125rem;
}

.message-content :deep(pre code) {
  background: transparent;
  padding: 0;
}

.message-content :deep(a) {
  color: hsl(var(--primary));
  text-decoration: underline;
}

/* 工具调用和思考标记样式 */
.message-content :deep(.tool-call-badge) {
  display: inline-block;
  background: hsl(var(--primary) / 0.1);
  border: 1px solid hsl(var(--primary) / 0.3);
  color: hsl(var(--primary));
  padding: 0.125rem 0.375rem;
  border-radius: 0.25rem;
  font-size: 0.75rem;
  font-weight: 600;
  margin: 0.25rem 0;
  white-space: nowrap;
}

.message-content :deep(.tool-result-badge) {
  display: inline-block;
  background: hsl(142, 76%, 36% / 0.1);
  border: 1px solid hsl(142, 76%, 36% / 0.3);
  color: hsl(142, 76%, 36%);
  padding: 0.125rem 0.375rem;
  border-radius: 0.25rem;
  font-size: 0.75rem;
  font-weight: 600;
  margin: 0.25rem 0;
}

.message-content :deep(.thinking-badge) {
  display: inline-block;
  background: hsl(var(--muted) / 0.3);
  color: hsl(var(--muted-foreground));
  padding: 0.125rem 0.375rem;
  border-radius: 0.25rem;
  font-size: 0.75rem;
  font-style: italic;
  margin: 0.25rem 0;
}

.streaming-cursor {
  display: inline-block;
  animation: blink 1s infinite;
  color: hsl(var(--primary));
  font-weight: bold;
}

@keyframes blink {
  0%, 50% {
    opacity: 1;
  }
  51%, 100% {
    opacity: 0;
  }
}

.message-status {
  margin-top: 0.5rem;
  font-size: 0.75rem;
}

.status-sending {
  color: hsl(var(--muted-foreground));
}

.status-error {
  color: hsl(var(--destructive));
}
</style>
