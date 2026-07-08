<template>
  <span
    class="agent-avatar"
    :style="{ width: `${size}px`, height: `${size}px`, background: avatarColor }"
    :title="name || emoji"
  >
    <span class="avatar-initial">{{ initial }}</span>
  </span>
</template>

<script setup lang="ts">
import { computed } from 'vue'

interface Props {
  name?: string
  emoji?: string   // 保留兼容，但不再显示
  size?: number
}

const props = withDefaults(defineProps<Props>(), {
  name: '',
  emoji: '',
  size: 28,
})

const initial = computed(() => {
  const n = props.name || props.emoji || '?'
  // 取第一个字符，中文取第一个字
  return n.charAt(0).toUpperCase()
})

// 基于名称的确定性颜色
const avatarColor = computed(() => {
  const colors = [
    '#4F46E5', '#7C3AED', '#DB2777', '#DC2626',
    '#EA580C', '#D97706', '#65A30D', '#059669',
    '#0891B2', '#2563EB', '#4338CA', '#9333EA',
    '#C026D3', '#E11D48', '#0D9488', '#0284C7',
  ]
  const str = props.name || props.emoji || 'default'
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash)
  }
  return colors[Math.abs(hash) % colors.length]
})
</script>

<style scoped>
.agent-avatar {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  flex-shrink: 0;
}

.avatar-initial {
  color: white;
  font-weight: 600;
  line-height: 1;
  font-size: 75%;
}
</style>
