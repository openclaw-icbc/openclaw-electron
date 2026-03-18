<template>
  <div
    class="message-item"
    :class="[
      `message-${message.role}`,
      { streaming: isStreaming }
    ]"
  >
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
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { Message } from '@/types'
import { renderMarkdownSync, formatTimestamp } from '@/utils'

interface Props {
  message: Message
  isStreaming?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  isStreaming: false
})

const avatarText = computed(() => {
  return props.message.role === 'user' ? 'U' : 'A'
})

const senderName = computed(() => {
  return props.message.role === 'user' ? '你' : 'Assistant'
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

  // 如果是流式消息且内容为空，显示输入提示
  if (props.isStreaming && !content) {
    return '<span class="streaming-cursor">▊</span>'
  }

  const html = renderMarkdownSync(content)

  // 如果正在流式传输，添加光标
  if (props.isStreaming) {
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
