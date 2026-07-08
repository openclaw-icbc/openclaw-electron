<template>
  <div class="new-session-view">
    <div class="ns-content">
      <AgentAvatar :name="displayName" :size="48" />
      <h3 class="ns-title">{{ displayName }}</h3>
      <p class="ns-desc">{{ description }}</p>
      <div class="ns-hint">
        <span class="ns-hint-icon">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="10"/>
            <path d="M12 16v-4"/>
            <path d="M12 8h.01"/>
          </svg>
        </span>
        这是一个全新的会话，发送消息即可开始对话
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useChatStore, useAgentsStore, useTeamStore } from '@/stores'
import AgentAvatar from '@/components/common/AgentAvatar.vue'

const chatStore = useChatStore()
const agentsStore = useAgentsStore()
const teamStore = useTeamStore()

const displayName = computed(() => {
  if (chatStore.currentTeamId) {
    const team = teamStore.getTeamById(chatStore.currentTeamId)
    if (team) return team.name
  }
  if (chatStore.currentAgentId && chatStore.currentAgentId !== 'main') {
    const agent = agentsStore.getAgentById(chatStore.currentAgentId)
    if (agent) return agent.name
  }
  return '新会话'
})

const description = computed(() => {
  if (chatStore.currentTeamId) {
    const team = teamStore.getTeamById(chatStore.currentTeamId)
    if (team) return team.description || `与 ${team.name} 开始协作`
  }
  if (chatStore.currentAgentId && chatStore.currentAgentId !== 'main') {
    const agent = agentsStore.getAgentById(chatStore.currentAgentId)
    if (agent) return `与 ${agent.name} 开始一对一对话`
  }
  return '发送消息开始对话'
})
</script>

<style scoped>
.new-session-view {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100%;
  padding: 2rem;
}

.ns-content {
  text-align: center;
  max-width: 360px;
}

.ns-title {
  font-size: 1.125rem;
  font-weight: 600;
  color: hsl(var(--foreground));
  margin: 1rem 0 0.5rem;
}

.ns-desc {
  font-size: 0.875rem;
  color: hsl(var(--muted-foreground));
  margin-bottom: 1.5rem;
}

.ns-hint {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.8rem;
  color: hsl(var(--muted-foreground));
  background: hsl(var(--muted));
  padding: 0.625rem 1rem;
  border-radius: 0.5rem;
}

.ns-hint-icon {
  display: inline-flex;
  color: hsl(var(--primary));
  flex-shrink: 0;
}
</style>
