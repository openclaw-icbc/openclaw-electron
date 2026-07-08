<template>
  <div class="agent-selector">
    <button class="selector-btn" @click.stop="toggleDropdown" ref="btnRef">
      <AgentAvatar :name="currentName" :size="18" />
      <span class="selector-label">{{ currentName }}</span>
      <span class="selector-arrow">▾</span>
    </button>

    <Transition name="dropdown">
      <div v-if="showDropdown" class="selector-dropdown" ref="dropdownRef" @click.stop>
        <div
          class="dropdown-item"
          :class="{ active: isMainSelected }"
          @click="selectMain()"
        >
          <AgentAvatar name="默认助手" :size="18" />
          <span>默认助手</span>
        </div>

        <template v-if="teams.length > 0">
          <div class="dropdown-divider"></div>
          <div class="dropdown-section-title">团队</div>
          <div
            v-for="team in teams"
            :key="`team-${team.id}`"
            class="dropdown-item"
            :class="{ active: isActiveTeam(team.id) }"
            @click="selectTeam(team)"
          >
            <AgentAvatar :name="team.name" :size="18" />
            <span>{{ team.name }}</span>
          </div>
        </template>

        <div class="dropdown-divider"></div>
        <div class="dropdown-section-title">专家</div>
        <div
          v-for="agent in chatableAgents"
          :key="`agent-${agent.id}`"
          class="dropdown-item"
          :class="{ active: isActiveAgent(agent.id) }"
          @click="selectAgent(agent.id)"
        >
          <AgentAvatar :name="agent.name" :size="18" />
          <span>{{ agent.name }}</span>
        </div>
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useChatStore, useAgentsStore, useTeamStore } from '@/stores'
import type { TeamConfig } from '@/types/team'
import AgentAvatar from '@/components/common/AgentAvatar.vue'

const chatStore = useChatStore()
const agentsStore = useAgentsStore()
const teamStore = useTeamStore()

const showDropdown = ref(false)
const btnRef = ref<HTMLElement>()
const dropdownRef = ref<HTMLElement>()

const teams = computed(() => teamStore.teams)
const chatableAgents = computed(() => agentsStore.expertAgents)

const isMainSelected = computed(() => {
  return !chatStore.currentTeamId && (chatStore.currentAgentId === 'main' || !chatStore.currentAgentId)
})

const isActiveTeam = (teamId: string) => chatStore.currentTeamId === teamId

const isActiveAgent = (agentId: string) => {
  return chatStore.currentAgentId === agentId && !chatStore.currentTeamId
}

const currentName = computed(() => {
  if (chatStore.currentTeamId) {
    return teamStore.activeTeam?.name || '团队'
  }
  if (!chatStore.currentAgentId || chatStore.currentAgentId === 'main') return '默认助手'
  const agent = agentsStore.getAgentById(chatStore.currentAgentId)
  return agent?.name || '未知'
})

function toggleDropdown() {
  showDropdown.value = !showDropdown.value
}

function selectMain() {
  showDropdown.value = false
  chatStore.switchToMain()
  teamStore.setActiveTeam(null)
}

function selectTeam(team: TeamConfig) {
  showDropdown.value = false
  chatStore.switchToTeam(team.leadAgentId, team.id)
  teamStore.setActiveTeam(team.id)
}

function selectAgent(agentId: string) {
  showDropdown.value = false
  chatStore.switchToAgent(agentId)
  teamStore.setActiveTeam(null)
}

function handleClickOutside(event: MouseEvent) {
  if (
    dropdownRef.value && !dropdownRef.value.contains(event.target as Node) &&
    btnRef.value && !btnRef.value.contains(event.target as Node)
  ) {
    showDropdown.value = false
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
.agent-selector {
  position: relative;
  display: inline-flex;
  align-items: center;
}

.selector-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.25rem 0.5rem;
  background: hsl(var(--muted));
  border: 1px solid hsl(var(--border));
  border-radius: calc(var(--radius) - 2px);
  cursor: pointer;
  font-size: 0.8rem;
  color: hsl(var(--foreground));
  transition: background-color 0.15s ease;
}

.selector-btn:hover {
  background: hsl(var(--accent));
}

.selector-label {
  max-width: 100px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.selector-arrow {
  font-size: 0.7rem;
  color: hsl(var(--muted-foreground));
}

.selector-dropdown {
  position: absolute;
  bottom: 100%;
  left: 0;
  margin-bottom: 0.5rem;
  min-width: 200px;
  max-height: 350px;
  overflow-y: auto;
  background: hsl(var(--popover));
  border: 1px solid hsl(var(--border));
  border-radius: calc(var(--radius) - 2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  z-index: 100;
  padding: 0.25rem 0;
}

.dropdown-section-title {
  font-size: 0.7rem;
  color: hsl(var(--muted-foreground));
  padding: 0.375rem 0.75rem 0.125rem;
  font-weight: 600;
}

.dropdown-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 0.75rem;
  cursor: pointer;
  font-size: 0.8rem;
  color: hsl(var(--foreground));
  transition: background-color 0.1s ease;
}

.dropdown-item:hover {
  background: hsl(var(--accent));
}

.dropdown-item.active {
  background: hsl(var(--accent));
  font-weight: 600;
}

.dropdown-divider {
  height: 1px;
  background: hsl(var(--border));
  margin: 0.25rem 0;
}

.dropdown-enter-active,
.dropdown-leave-active {
  transition: all 0.15s ease;
}

.dropdown-enter-from,
.dropdown-leave-to {
  opacity: 0;
  transform: translateY(4px);
}
</style>
