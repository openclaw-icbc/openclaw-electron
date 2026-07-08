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
        v-for="message in sortedMessages"
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

// 直接使用插入顺序渲染消息
// 消息在 store 中已按正确的时间顺序插入（文本 → 工具 → 工具后文本）
// 之前按类型优先级排序会破坏这个顺序，导致所有文本消息排到工具消息前面
const sortedMessages = computed(() => props.messages)

// 检测用户是否手动滚动（距离底部超过150px）
const isUserScrolledUp = computed(() => {
  if (!containerRef.value) return false
  const threshold = 150
  return containerRef.value.scrollHeight - containerRef.value.scrollTop - containerRef.value.clientHeight > threshold
})

// 上一次的消息数量，用于检测新消息
const previousMessageCount = ref(0)

// 上一次的消息数组引用，用于检测会话切换
const previousMessagesRef = ref<Message[] | null>(null)

// 跟踪滚动高度，用于检测内容增长时的自动滚动
const lastScrollHeight = ref(0)
// 跟踪滚动位置，用于区分"内容增长"和"用户手动滚动"
const lastScrollTop = ref<number | null>(null)

// 自动滚动到底部
// 使用 setTimeout(0) 而非 nextTick：nextTick 只保证 Vue DOM patch 完成，
// 但 MessageItem 的 v-html（markdown 渲染）注入后浏览器可能还需要额外的 reflow，
// setTimeout(0) 确保所有布局和渲染都已完成后再读取 scrollHeight
const scrollToBottom = (force = false) => {
  nextTick(() => {
    setTimeout(() => {
      if (containerRef.value) {
        if (force || !isUserScrolledUp.value) {
          containerRef.value.scrollTop = containerRef.value.scrollHeight
        }
        // 在 DOM 更新后记录最新的滚动高度和位置
        lastScrollHeight.value = containerRef.value.scrollHeight
        lastScrollTop.value = containerRef.value.scrollTop
      }
    }, 0)
  })
}

// 监听消息变化
watch(() => props.messages, (newMessages) => {
  const currentCount = newMessages.length
  const prevRef = previousMessagesRef.value

  // 检测是否切换了会话（数组引用不同且引用非首次设置）
  const isSessionSwitch = prevRef !== null && newMessages !== prevRef

  if (isSessionSwitch || currentCount > previousMessageCount.value) {
    // 切换会话 或 新消息，强制滚动到底部
    scrollToBottom(true)
  } else if (currentCount === previousMessageCount.value && props.streamingMessageId) {
    // 消息数量未变但有流式消息，说明是内容更新
    // 在 DOM 完全稳定后检测内容增长
    const prevHeight = lastScrollHeight.value
    const prevTop = lastScrollTop.value
    nextTick(() => {
      setTimeout(() => {
        if (!containerRef.value) return
        const newHeight = containerRef.value.scrollHeight
        const newTop = containerRef.value.scrollTop
        const contentGrew = newHeight > prevHeight
        // 如果 scrollTop 没变，说明用户没有手动滚动，是内容增长撑大了容器
        const userScrolled = prevTop !== null && newTop !== prevTop

        if (contentGrew && !userScrolled) {
          // 内容增长且用户未手动滚动 → 强制跟随到底部
          containerRef.value.scrollTop = newHeight
        } else if (!isUserScrolledUp.value) {
          containerRef.value.scrollTop = newHeight
        }
        lastScrollHeight.value = newHeight
        lastScrollTop.value = newTop
      }, 0)
    })
  }

  previousMessageCount.value = currentCount
  previousMessagesRef.value = newMessages
}, { deep: true })

// 监听流式消息ID变化（如从工具消息切换到 after-tool 文本消息）
watch(() => props.streamingMessageId, () => {
  scrollToBottom(true)
})

// 监听思考状态变化
watch(() => props.thinkingMessageId, () => {
  scrollToBottom(true)
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
