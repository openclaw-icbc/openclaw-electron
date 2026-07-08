<template>
  <div
    class="session-detail"
    :class="{ active }"
    @click="handleClick"
  >
    <div class="session-detail-header">
      <div class="session-detail-info-left">
        <div class="session-detail-title">{{ displayTitle }}</div>
        <div class="session-detail-key">{{ messagePreview }}</div>
      </div>
      <div class="session-detail-actions" @click.stop>
        <button class="more-btn" @click="toggleMenu" ref="menuBtnRef">
          <span class="more-dots">···</span>
        </button>
        <Transition name="menu">
          <div v-if="showMenu" class="more-menu" ref="menuRef">
            <button class="menu-item menu-item-danger" @click="handleDelete">
              <Icon name="trash" :size="14" />
              <span>删除</span>
            </button>
          </div>
        </Transition>
      </div>
    </div>
    <div class="session-detail-info">
      <span>创建时间: {{ formattedCreatedAt }}</span>
      <span> | </span>
      <span>消息数: {{ messageCount }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, onMounted, onUnmounted } from 'vue'
import type { Session } from '@/types'
import { formatDate } from '@/utils'
import Icon from '@/components/common/Icon.vue'

interface Props {
  session: Session
  active?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  active: false
})

const emit = defineEmits<{
  click: []
  delete: [sessionKey: string]
}>()

const showMenu = ref(false)
const menuBtnRef = ref<HTMLElement>()
const menuRef = ref<HTMLElement>()

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

function toggleMenu() {
  showMenu.value = !showMenu.value
}

function handleDelete() {
  showMenu.value = false
  emit('delete', props.session.key)
}

function handleClickOutside(event: MouseEvent) {
  if (
    menuRef.value && !menuRef.value.contains(event.target as Node) &&
    menuBtnRef.value && !menuBtnRef.value.contains(event.target as Node)
  ) {
    showMenu.value = false
  }
}

onMounted(() => {
  document.addEventListener('click', handleClickOutside)
})

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside)
})
</script>

<style scoped>
.session-detail {
  cursor: pointer;
  padding: 0.75rem 1rem;
  border-bottom: 1px solid hsl(var(--border) / 0.3);
  transition: background-color 0.15s ease;
  position: relative;
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
  padding-right: 1.75rem;
}

.session-detail-info-left {
  flex: 1;
  min-width: 0;
}

.session-detail-title {
  font-weight: 500;
  color: hsl(var(--foreground));
  margin-bottom: 0.25rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.session-detail-key {
  font-size: 0.75rem;
  color: hsl(var(--muted-foreground));
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* ===== More menu ===== */
.session-detail-actions {
  position: absolute;
  top: 0.375rem;
  right: 0.5rem;
  flex-shrink: 0;
}

.more-btn {
  background: none;
  border: none;
  cursor: pointer;
  padding: 0.25rem 0.5rem;
  border-radius: 0.25rem;
  color: hsl(var(--muted-foreground));
  line-height: 1;
  opacity: 1;
  transition: all 0.15s;
}

.more-btn:hover {
  background: hsl(var(--muted));
  color: hsl(var(--foreground));
}

.more-dots {
  font-size: 1.1rem;
  letter-spacing: -1px;
}

.more-menu {
  position: absolute;
  top: 100%;
  right: 0;
  margin-top: 0.25rem;
  min-width: 100px;
  background: hsl(var(--popover));
  border: 1px solid hsl(var(--border));
  border-radius: calc(var(--radius) - 2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.12);
  z-index: 50;
  padding: 0.25rem;
  overflow: hidden;
}

.menu-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  width: 100%;
  padding: 0.5rem 0.75rem;
  background: none;
  border: none;
  cursor: pointer;
  font-size: 0.8rem;
  color: hsl(var(--foreground));
  border-radius: 0.25rem;
  transition: background 0.1s;
}

.menu-item:hover {
  background: hsl(var(--muted));
}

.menu-item-danger {
  color: hsl(var(--destructive));
}

.menu-item-danger:hover {
  background: hsl(var(--destructive) / 0.1);
}

/* ===== Transitions ===== */
.menu-enter-active,
.menu-leave-active {
  transition: all 0.12s ease;
}
.menu-enter-from,
.menu-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}

.session-detail-info {
  font-size: 0.75rem;
  color: hsl(var(--muted-foreground));
  display: flex;
  gap: 0.5rem;
}
</style>
