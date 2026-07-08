import { defineStore } from 'pinia'
import type { AgentInfo } from '@/types/team'
import type { TeamConfig } from '@/types/team'
import { fetchAgents } from '@/api/agents'

export const useAgentsStore = defineStore('agents', {
  state: () => ({
    allAgents: [] as AgentInfo[],
    loading: false,
  }),

  getters: {
    expertAgents(): AgentInfo[] {
      return this.allAgents.filter(a => !a.isTeamLead && a.id !== 'main')
    },

    getAgentById(): (id: string) => AgentInfo | undefined {
      return (id: string) => this.allAgents.find(a => a.id === id)
    },

    chatableAgents(): AgentInfo[] {
      return this.allAgents.filter(a => a.id !== 'main')
    },
  },

  actions: {
    async loadAgents(teams: TeamConfig[]) {
      try {
        this.loading = true
        const result = await fetchAgents()

        let agentsData = result
        if (result && typeof result === 'object' && !Array.isArray(result)) {
          const resp = result as { agents?: any; defaultId?: string }
          agentsData = resp.agents || []
        }

        if (!Array.isArray(agentsData)) {
          this.allAgents = []
          return
        }

        const teamLeadIds = new Set(teams.map(t => t.leadAgentId))
        const memberTeamMap = new Map<string, string>()
        for (const team of teams) {
          for (const member of team.members) {
            if (member.agentId !== team.leadAgentId) {
              memberTeamMap.set(member.agentId, team.id)
            }
          }
        }

        this.allAgents = agentsData.map((a: any) => ({
          id: a.id || '',
          name: a.identity?.name || a.name || a.id || '',
          emoji: a.identity?.emoji || '🤖',
          isTeamLead: teamLeadIds.has(a.id),
          teamId: memberTeamMap.get(a.id),
        }))
      } catch (error: any) {
        console.error('Failed to load agents:', error)
      } finally {
        this.loading = false
      }
    },
  },
})
