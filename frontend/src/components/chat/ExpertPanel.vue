<template>
  <div class="expert-panel">
    <div class="expert-panel-header">
      <h3>专家</h3>
      <button class="panel-close-btn" @click="uiStore.closeExpertPanel()">✕</button>
    </div>

    <div class="expert-panel-content">
      <div v-if="teams.length > 0" class="panel-section">
        <div class="section-title">团队</div>
        <div class="section-grid">
          <div
            v-for="team in teams"
            :key="team.id"
            class="expert-card"
            :class="{ active: isActiveTeam(team.id) }"
            @click="handleTeamClick(team)"
          >
            <AgentAvatar :name="team.name" :size="36" />
            <div class="card-info">
              <div class="card-name">{{ team.name }}</div>
              <div class="card-desc">{{ team.description }}</div>
              <div class="card-members">
                <span v-for="m in team.members" :key="m.agentId" class="member-tag">
                  <AgentAvatar :name="m.role" :size="14" />
                  {{ m.role }}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="panel-section">
        <div class="section-title">专家</div>
        <div class="section-grid">
          <div
            v-for="agent in experts"
            :key="agent.id"
            class="expert-card"
            :class="{ active: isActiveAgent(agent.id) }"
            @click="handleExpertClick(agent)"
          >
            <AgentAvatar :name="agent.name" :size="36" />
            <div class="card-info">
              <div class="card-name">{{ agent.name }}</div>
              <div v-if="agent.teamId" class="card-team-tag">
                属于 {{ getTeamName(agent.teamId) }}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useUiStore, useAgentsStore, useTeamStore, useChatStore } from '@/stores'
import type { TeamConfig, AgentInfo } from '@/types/team'
import AgentAvatar from '@/components/common/AgentAvatar.vue'

const uiStore = useUiStore()
const agentsStore = useAgentsStore()
const teamStore = useTeamStore()
const chatStore = useChatStore()

const teams = computed(() => teamStore.teams)
const experts = computed(() => agentsStore.expertAgents)

function isActiveTeam(teamId: string): boolean {
  return chatStore.currentTeamId === teamId
}

function isActiveAgent(agentId: string): boolean {
  return chatStore.currentAgentId === agentId && !chatStore.currentTeamId
}

function getTeamName(teamId: string): string {
  return teamStore.getTeamById(teamId)?.name || teamId
}

async function handleTeamClick(team: TeamConfig) {
  chatStore.switchToTeam(team.leadAgentId, team.id)
  teamStore.setActiveTeam(team.id)
  uiStore.closeExpertPanel()
}

async function handleExpertClick(agent: AgentInfo) {
  chatStore.switchToAgent(agent.id)
  teamStore.setActiveTeam(null)
  uiStore.closeExpertPanel()
}
</script>

<style scoped>
.expert-panel {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.expert-panel-header {
  padding: 1rem 1.25rem;
  border-bottom: 1px solid hsl(var(--border));
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.expert-panel-header h3 {
  font-size: 1rem;
  font-weight: 600;
  margin: 0;
}

.panel-close-btn {
  background: none;
  border: none;
  cursor: pointer;
  color: hsl(var(--muted-foreground));
  font-size: 1rem;
  padding: 0.25rem 0.5rem;
  border-radius: 0.25rem;
  line-height: 1;
}

.panel-close-btn:hover {
  background: hsl(var(--muted));
  color: hsl(var(--foreground));
}

.expert-panel-content {
  flex: 1;
  overflow-y: auto;
  padding: 1.25rem;
}

.panel-section {
  margin-bottom: 2rem;
}

.section-title {
  font-size: 0.8rem;
  color: hsl(var(--muted-foreground));
  text-transform: uppercase;
  letter-spacing: 0.05em;
  font-weight: 600;
  margin-bottom: 0.75rem;
}

.section-grid {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.expert-card {
  display: flex;
  align-items: flex-start;
  gap: 0.75rem;
  padding: 0.75rem 1rem;
  border: 1px solid hsl(var(--border));
  border-radius: calc(var(--radius) - 2px);
  cursor: pointer;
  transition: all 0.15s ease;
}

.expert-card:hover {
  background: hsl(var(--muted));
  border-color: hsl(var(--primary) / 0.3);
}

.expert-card.active {
  background: hsl(var(--primary) / 0.08);
  border-color: hsl(var(--primary));
}

.card-info {
  flex: 1;
  min-width: 0;
}

.card-name {
  font-weight: 600;
  font-size: 0.9rem;
  margin-bottom: 0.25rem;
}

.card-desc {
  font-size: 0.75rem;
  color: hsl(var(--muted-foreground));
  margin-bottom: 0.375rem;
}

.card-members {
  display: flex;
  flex-wrap: wrap;
  gap: 0.375rem;
}

.member-tag {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  font-size: 0.7rem;
  padding: 0.125rem 0.375rem;
  background: hsl(var(--muted));
  border-radius: 0.25rem;
  color: hsl(var(--muted-foreground));
}

.card-team-tag {
  font-size: 0.7rem;
  color: hsl(var(--muted-foreground));
}
</style>
