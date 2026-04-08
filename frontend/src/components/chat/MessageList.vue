<template>
  <div ref="containerRef" class="message-list">
    <div v-if="loading" class="message-list-loading">
      <div class="spinner"></div>
      <div>加载消息中...</div>
    </div>

    <div v-else-if="messages.length === 0" class="message-list-empty">
      <p>暂无消息</p>
    </div>

    <div v-else class="message-list-content">
      <MessageItem
        v-for="message in messages"
        :key="message.id"
        :message="message"
        :is-streaming="message.id === streamingMessageId"
      />

      <!-- 思考指示器 -->
      <div v-if="showThinking" class="thinking-indicator">
        <div class="thinking-dots">
          <span></span>
          <span></span>
          <span></span>
        </div>
        <span>AI 正在思考...</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, nextTick, computed } from 'vue'
import type { Message } from '@/types'
import MessageItem from './MessageItem.vue'

interface Props {
  messages: Message[]
  loading?: boolean
  thinkingMessageId?: string | null
  streamingMessageId?: string | null
}

const props = withDefaults(defineProps<Props>(), {
  loading: false,
  thinkingMessageId: null,
  streamingMessageId: null
})

const containerRef = ref<HTMLElement>()
const showThinking = computed(() => !!props.thinkingMessageId)

// 检测用户是否手动滚动（距离底部超过150px）
const isUserScrolledUp = computed(() => {
  if (!containerRef.value) return false
  const threshold = 150
  return containerRef.value.scrollHeight - containerRef.value.scrollTop - containerRef.value.clientHeight > threshold
})

// 上一次的消息数量，用于检测新消息
const previousMessageCount = ref(0)

// 自动滚动到底部
const scrollToBottom = (force = false) => {
  nextTick(() => {
    if (containerRef.value) {
      // force=true时强制滚动（新消息、流式状态变化等）
      // force=false时，只在用户没有向上滚动时才滚动
      if (force || !isUserScrolledUp.value) {
        containerRef.value.scrollTop = containerRef.value.scrollHeight
      }
    }
  })
}

// 监听消息变化
watch(() => props.messages, (newMessages, oldMessages) => {
  const currentCount = newMessages.length
  const previousCount = previousMessageCount.value

  // 消息数量增加（新消息），强制滚动
  if (currentCount > previousCount) {
    console.log('📜 New message added, forcing scroll to bottom')
    scrollToBottom(true)
  } else if (currentCount === previousCount && props.streamingMessageId) {
    // 消息数量未变但有流式消息，说明是内容更新
    // 只在用户没有向上滚动时滚动
    console.log('📜 Streaming content update, conditional scroll')
    scrollToBottom(false)
  }

  previousMessageCount.value = currentCount
}, { deep: true })

// 监听流式消息ID变化
watch(() => props.streamingMessageId, () => {
  scrollToBottom()
})

// 监听思考状态变化
watch(() => props.thinkingMessageId, () => {
  scrollToBottom()
})

defineExpose({
  scrollToBottom
})
</script>

<style scoped>
.message-list {
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow-y: auto;
}

.message-list-loading,
.message-list-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: hsl(var(--muted-foreground));
}

.spinner {
  width: 32px;
  height: 32px;
  border: 3px solid hsl(var(--muted) / 0.3);
  border-top-color: hsl(var(--primary));
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
  margin-bottom: 1rem;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.message-list-content {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  padding: 0.5rem 0;
  align-items: flex-start; /* 确保所有子元素左对齐 */
}

.thinking-indicator {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 1rem;
  background: hsl(var(--muted) / 0.3);
  border-radius: calc(var(--radius) - 2px);
  margin-bottom: 0.5rem;
}

.thinking-dots {
  display: flex;
  gap: 0.25rem;
}

.thinking-dots span {
  width: 8px;
  height: 8px;
  background: hsl(var(--primary));
  border-radius: 50%;
  animation: bounce 1.4s infinite ease-in-out both;
}

.thinking-dots span:nth-child(1) {
  animation-delay: -0.32s;
}

.thinking-dots span:nth-child(2) {
  animation-delay: -0.16s;
}

@keyframes bounce {
  0%, 80%, 100% {
    transform: scale(0);
  }
  40% {
    transform: scale(1);
  }
}
</style>
