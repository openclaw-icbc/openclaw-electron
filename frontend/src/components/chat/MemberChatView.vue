<template>
  <div class="member-chat-view">
    <div v-if="loading" class="member-loading">
      <span>加载中...</span>
    </div>
    <div v-else-if="messages.length === 0" class="member-empty">
      <span>暂无会话记录</span>
    </div>
    <div v-else class="member-messages" ref="messagesContainer">
      <div
        v-for="msg in messages"
        :key="msg.id"
        class="member-message"
        :class="`role-${msg.role}`"
      >
        <div class="msg-role-label">{{ msg.role === 'user' ? '用户' : msg.role === 'assistant' ? '助手' : '系统' }}</div>
        <div class="msg-content">{{ msg.content }}</div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, nextTick } from 'vue'
import type { Message } from '@/types/chat'

interface Props {
  agentId: string
  messages: Message[]
  loading?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  loading: false,
})

const messagesContainer = ref<HTMLElement>()

watch(() => props.messages, async () => {
  await nextTick()
  if (messagesContainer.value) {
    messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight
  }
}, { deep: true })
</script>

<style scoped>
.member-chat-view {
  flex: 1;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.member-loading,
.member-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 2rem;
  color: hsl(var(--muted-foreground));
  font-size: 0.8rem;
}

.member-messages {
  flex: 1;
  overflow-y: auto;
  padding: 0.75rem;
}

.member-message {
  margin-bottom: 0.75rem;
  padding: 0.5rem 0.75rem;
  border-radius: 0.5rem;
  font-size: 0.8rem;
  line-height: 1.4;
}

.role-user {
  background: hsl(var(--primary) / 0.1);
  border-left: 2px solid hsl(var(--primary));
}

.role-assistant {
  background: hsl(var(--muted));
  border-left: 2px solid hsl(var(--accent));
}

.role-system {
  background: hsl(var(--muted) / 0.5);
  border-left: 2px solid hsl(var(--border));
}

.msg-role-label {
  font-size: 0.7rem;
  font-weight: 600;
  color: hsl(var(--muted-foreground));
  margin-bottom: 0.25rem;
}

.msg-content {
  white-space: pre-wrap;
  word-break: break-word;
  color: hsl(var(--foreground));
}
</style>
