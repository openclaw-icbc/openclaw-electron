<template>
  <div
    class="session-detail"
    :class="{ active }"
    @click="handleClick"
  >
    <div class="session-detail-header">
      <div>
        <div class="session-detail-title">{{ displayTitle }}</div>
        <div class="session-detail-key">{{ messagePreview }}</div>
      </div>
      <div class="session-detail-arrow">→</div>
    </div>
    <div class="session-detail-info">
      <span>创建时间: {{ formattedCreatedAt }}</span>
      <span> | </span>
      <span>消息数: {{ messageCount }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { Session } from '@/types'
import { formatDate, escapeHtml } from '@/utils'

interface Props {
  session: Session
  active?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  active: false
})

const emit = defineEmits<{
  click: []
}>()

const displayTitle = computed(() => {
  return props.session.label || props.session.key
})

const messagePreview = computed(() => {
  const count = props.session.messageCount || 0
  if (props.session.lastMessage && count > 0) {
    const preview = props.session.lastMessage.substring(0, 60)
    return props.session.lastMessage.length > 60
      ? preview + '...'
      : preview
  }
  return '暂无消息'
})

const formattedCreatedAt = computed(() => {
  if (props.session.createdAt) {
    return formatDate(props.session.createdAt)
  }
  return '未知'
})

const messageCount = computed(() => {
  return props.session.messageCount || 0
})

function handleClick() {
  emit('click')
}
</script>

<style scoped>
.session-detail {
  cursor: pointer;
  padding: 0.75rem 1rem;
  border-bottom: 1px solid hsl(var(--border) / 0.3);
  transition: background-color 0.15s ease;
}

.session-detail:hover {
  background: hsl(var(--sidebar-hover));
}

.session-detail.active {
  background: hsl(var(--sidebar-active));
}

.session-detail-header {
  display: flex;
  justify-content: space-between;
  align-items: start;
  margin-bottom: 0.5rem;
}

.session-detail-title {
  font-weight: 500;
  color: hsl(var(--foreground));
  margin-bottom: 0.25rem;
}

.session-detail-key {
  font-size: 0.75rem;
  color: hsl(var(--muted-foreground));
}

.session-detail-arrow {
  font-size: 1.25rem;
  color: hsl(var(--muted-foreground));
  opacity: 0.5;
}

.session-detail-info {
  font-size: 0.75rem;
  color: hsl(var(--muted-foreground));
  display: flex;
  gap: 0.5rem;
}
</style>
